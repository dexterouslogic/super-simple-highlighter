/*
 * This file is part of Super Simple Highlighter.
 * 
 * Super Simple Highlighter is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * Super Simple Highlighter is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with Foobar.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Coordinating class for manipulating highlights in the database AND the content page
 * 
 * @class Highlighter
 */
class Highlighter {
  /**
   * Creates an instance of Highlight.
   * @param {Array<number>|number} [tabId] - id or (in case of delete method) array, of ids of tabs of associated tabs
   * @memberof Highlighter
   */
  constructor(tabId) {
    this.tabId = tabId
  }

  /**
  * 
  * 
  * 
  * @param {Object} xrange - range of highlight
  * @param {string} match - match string to identify related highlights. Usually processed from url
  * @param {string} text - text of highlight
  * @param {string} className - class name identifying highlight style to apply to DOM element, and in database also
  * @returns {Promise}
  * @memberof Highlighter
  */
  create(xrange, match, text, className) {
    if (xrange.collapsed) {
      return Promise.reject(new Error("Collapsed range"))
    }

    // requires single tab id
    const tabs = new ChromeTabs((typeof this.tabId === 'number' && this.tabId) || this.tabId[0])
    const db = new DB()

    // document to create
    let doc = {}

    // if this is the first create document to be posted, we want the title too
    return db.getMatchingSum(match).then(sum => {
      if (sum != 0) {
        // resolve to undefined title
        return Promise.resolve()
      }

      // get tab's title
      return tabs.get()
    }).then(tab => {
      // not being collapsed is implicit
      delete xrange.collapsed

      // ignore tabs where the title == url (i.e. not explicity defined)
      const optional = {}
      if (tab && tab.title !== tab.url) {
        optional.title = tab.title
      }

      return db.putCreateDocument(match, xrange, className, text, optional)
    }).then(response => {
      doc = {
        id: response.id,
        rev: response.rev
      }

      // use the new document's id for the element id of the (first) highlight element
      try {
        return tabs.createHighlight(xrange, className, doc.id)
      } catch (e) {
        // always rejects
        return db.removeDB(doc.id, doc.rev).then(() => {
          return Promise.reject(new Error(`Exception creating highlight in DOM - Removing associated document: ${e}`))
        })
      }
    }).then(ok => {
      // a false response means something went wrong.
      // Delete document from db
      if (!ok) {
        // always rejects
        return db.removeDB(doc.id, doc.rev).then(() => {
          return Promise.reject(new Error(`Error creating highlight in DOM - Removing associated document`))
        })
      }

      // (re) show page action on success
      chrome.pageAction.show(tabs.tabId)
    })
    
    // .then(() => {
    //   return db.closeDB()
    // }).catch(e => {
    //   return db.closeDB().then(() => { throw(e)} )
    // })
  }

  /**
   * Update the highlight by changing its class name, first by revising its 'create' document, then in DOM
   * 
   * @param {string} docId - id of 'create' document to change
   * @param {string} className - new class name defining highlight style
   * @returns {Promise}
   * @memberof Highlighter
   */
  update(docId, className) {
    return new DB().updateCreateDocument(docId, { className: className }).then(({ ok }) => {
      if (!ok) {
        return Promise.reject(new Error("Response not OK"));
      }

      // document updated - now update DOM
      const tabs = new ChromeTabs((typeof this.tabId === 'number' && this.tabId) || this.tabId[0])
      return tabs.updateHighlight(docId, className)
    }).then(ok => {
      if (!ok) {
        return Promise.reject(new Error("Error updating highlight in DOM"));
      }
    })
  }

  /**
   * Delete a highlight in the database, and in the page DOM.
   * NB: this.tabId can be array|undefined. If undefined, query api for tab with match name.
   * 
   * @param {string} docId - id of the document representing the highlight to remove
   * @returns {Promise<Object>} ok/id/rev object
   * @memberof Highlighter
   */
  delete(docId) {
    const db = new DB()

    // make array
    let tabIds = (typeof this.tabId === 'number' && [this.tabId]) || this.tabId

    // match property of the document representing the highlight to be deleted
    let match

    // make sure original document exists, and store its 'match' property
    return db.getDocument(docId).then(doc => {
      console.assert(doc.verb === 'create')

      match = doc.match

      // if its also the last 'create' document we can delete it directly
      return db.getMatchingDocuments(match, {
        descending: false,
        verbs: DB.DOCUMENT.VERB.CREATE
      }).then(docs => {
        console.assert(docs.length >= 1)
        const lastDoc = docs[docs.length - 1]

        // if the last non-delete document was our 'create' doc we can delete directly
        if (lastDoc._id === doc._id) {
          console.log('Highlight is the latest "create" document - removing directly')
          return db.removeDB(doc._id, doc._rev)
        } else {
          // post an additional 'delete' document
          return db.postDeleteDocument(docId)
        }
      })
    }).then(({ ok }) => {
      if (!ok) {
        // 'delete' document wasn't posted
        return Promise.reject(new Error("Error removing document"))
      }

      // if the tab id is undefined, *try* to query it from the match title
      if (typeof tabIds === 'undefined') {
        return ChromeTabs.query({
          url: encodeURI(match),
          status: 'complete'
        }).then(tabs => {
          // update tabIds argument array
          tabIds = tabs.map(tab => tab.id).filter(tabId => tabId !== chrome.tabs.TAB_ID_NONE)
        })
      }
    }).then(() => {
      // if tab specified, try and remove highlight from DOM (result ignored)
      console.assert(Array.isArray(tabIds))

      // ignores errors
      return Promise.all(tabIds.map(tabId => {
        return new ChromeTabs(tabId).removeHighlight(docId).catch(() => { /* */ })
      }))
    }).then(() => {
      // Get sum of create(+1) & delete(-1) verbs for a specific match
      // If equal, there are no highlights for the page, so the page action can be removed,
      // and the remaining documents are useless
      return db.getMatchingSum(match)
    }).then(sum => {
      console.log(`Sum: ${sum} [${match}]`);

      if (sum > 0) {
        // empty doc implies no matching documents needed to be removed (not an error)
        return []
      }

      console.log(`Removing all documents for ${match}`);

      for (const id of tabIds) {
        chrome.pageAction.hide(id)
      }

      // can delete all documents (for this match)
      // return array of objects {ok,id,rev} for each removed doc
      return db.removeMatchingDocuments(match)
    })
  }

  /**
   * Delete all documents associated with a 'match'
   * 
   * @param {string} match - match string identifying highlights to remove
   * @returns {Promise<Boolean[]>} - array of bool for each deleted highlight in the tab
   * @memberof Highlighter
   */
  deleteMatching(match) {
    return new DB().removeMatchingDocuments(match).then(responses => {
      const tabs = new ChromeTabs((typeof this.tabId === 'number' && this.tabId) || this.tabId[0])

      chrome.pageAction.hide(tabs.tabId)

      // Response is an array containing the id and rev of each deleted document.
      // We can use id to remove highlights in the DOM (although some won't match)
      return Promise.all(responses
        .filter(r => r.ok)
        .map(({ id }) => tabs.removeHighlight(id))
      )
    })
  }

  /**
   * Undo the last undoable document in the journal (by negating it)
   * 
   * @memberof Highlighter
   */
  undo() {
    const tabs = new ChromeTabs((typeof this.tabId === 'number' && this.tabId) || this.tabId[0])
    
    return tabs.get().then(({ url }) => {
      // build match using tab's url, and get the last document
      const match = DB.formatMatch(url)

      return new DB().getMatchingDocuments(match, { descending: true })
    }).then(docs => {
      // find last 'undoable' document that has not already been negated 
      let deletedDocIds = new Set()

      for (const doc of docs) {
        switch (doc.verb) {
          case DB.DOCUMENT.VERB.DELETE:
            deletedDocIds.add(doc.correspondingDocumentId)
            break

          case DB.DOCUMENT.VERB.CREATE:
            // is it already deleted?
            if (!deletedDocIds.has(doc._id)) {
              // add a negating document
              return this.delete(doc._id)
            }
            break

          default:
            console.error(`unknown verb ${doc.verb}`)
        }
      }

      return Promise.reject(new Error("No create documents to undo."))

      // THIS CRASHES CHROME

      // var latestCreateDoc = docs.find(function (doc) {
      // 	switch (doc.verb) {
      // 	case "delete":
      // 		deletedDocumentIds.add(doc.correspondingDocumentId);
      // 		return false;
      //
      // 	case "create":
      // 		// is it already deleted?
      // 		return deletedDocumentIds.has(doc._id) === false
      // 	}
      // });
      //
      // if (lastCreateDoc) {
      // 	// add a negating document
      // 	return _eventPage.deleteHighlight(tabId, lastCreateDoc._id);
      // } else {
      // 	return Promise.reject("No create documents to undo.");
      // }
    })
  }
}