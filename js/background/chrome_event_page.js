/**
 * Singleton class
 * 
 * @class ChromeEventPage
 */
class ChromeEventPage {
  constructor() {
    // handler for clicked context menu items
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      // callback calls back into this
      return ChromeContextMenus.onClicked(info, tab, { $: this })
    })
  }

  //

  /**
   * 
   * 
   * @param {number} tabId - id of tab to send message to, to create highlight in DOM 
   * @param {Object} xrange - range of highlight
   * @param {string} match - match string to identify related highlights. Usually processed from url
   * @param {string} text - text of highlight
   * @param {string} className - class name identifying highlight style to apply to DOM element, and in database also
   * @returns {Promise}
   * @memberof ChromeEventPage
   */
  createHighlight(tabId, xrange, match, text, className) {
    if (xrange.collapsed) {
      return Promise.reject(new Error("Collapsed range"))
    }

    const db = new DB()
    const tabs = new ChromeTabs(tabId)

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
      chrome.pageAction.show(tabId)
    })
  }

  /**
   * Update the highlight by changing its class name, first by revising its 'create' document, then in DOM
   * 
   * @param {number} tabId - id of tab containing highlight
   * @param {string} docId - id of 'create' document to change
   * @param {string} className - new class name defining highlight style
   * @returns {Promise}
   * @memberof ChromeEventPage
   */
  updateHighlight(tabId, docId, className) {
    return new DB().updateCreateDocument(docId, { className: className }).then(({ ok }) => {
      if (!ok) {
        return Promise.reject(new Error("Response not OK"));
      }

      // document updated - now update DOM
      return new ChromeTabs(tabId).updateHighlight(docId, className)
    }).then(ok => {
      if (!ok) {
        return Promise.reject(new Error("Error updating highlight in DOM"));
      }
    })
  }

  /**
   * Delete a highlight in the database, and in the page DOM
   * 
   * @param {string} docId - id of the document representing the highlight to remove
   * @param {Array<number>|number} [tabIds] - id or array of ids of tabs of associated tabs, whose DOM should contain the highlight.  If undefined, query api for tab with match name.
   * @returns {Promise<Object>} ok/id/rev object
   * @memberof ChromeEventPage
   */
  deleteHighlight(docId, tabIds) {
    const db = new DB()

    // make array
    tabIds = (typeof tabIds === 'number' && [tabIds]) || tabIds

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
        return new ChromeTabs(tabId).deleteHighlight(docId).catch(() => { /* */ })
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
   * @param {number} tabId - id of tab containing highlights to delete
   * @param {string} match - match string identifying highlights to remove
   * @returns {Promise<Boolean[]>} - array of bool for each deleted highlight in the tab
   * @memberof ChromeEventPage
   */
  deleteHighlights(tabId, match) {
    return new DB().removeMatchingDocuments(match).then(responses => {
      chrome.pageAction.hide(tabId)

      // Response is an array containing the id and rev of each deleted document.
      // We can use id to remove highlights in the DOM (although some won't match)
      const tabs = new ChromeTabs(tabId)

      return Promise.all(responses
        .filter(r => r.ok)
        .map(({ id }) => tabs.deleteHighlight(id))
      )
    })
  }
}

// singleton instance
var $ = new ChromeEventPage()