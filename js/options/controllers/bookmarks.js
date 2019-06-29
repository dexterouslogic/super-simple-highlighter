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

// 'bookmarksControllers' module containing a single controller, named 'bookmarks'
angular.module('bookmarksControllers', []).controller('bookmarks', ["$scope", function ($scope) {
  class Controller {
    /**
     * @typedef {Object} Scope
     * @prop {string} documentFilterText - current text of filter input element
		 * @prop {Filters} filters - filter predicate functions
     * @prop {Options} options - watched options specific to scope
     * @prop {Group[]} groupedDocs - 
     * @memberof Controller
     */

     /**
      * @typedef {Object} Filters
      * @prop {Function} group - filter predicate called on individual groups
      * @prop {Function} document - filter predicate called on individual documents of a group
      * @memberof Controller
      */

    /**
     * @typedef {Object} Options
     * @prop {string} groupBy
     * @prop {boolean} ascendingOrder
     * @prop {boolean} showPageText
     */

    /**
		 * Creates an instance of Controller.
     * 
		 * @param {Scope} scope - controller $scope
		 * @memberof Controller
		 */
    constructor(scope) {
      this.scope = scope

      this.scope.documentFilterText = ""
      this.scope.filters = {
        // filter predicate called on individual groups
        // (delegates to document filter)
        group: (group) => group.docs.some(doc => this.scope.filters.document(doc)),
    
        // filter predicate called on individual documents of a group
        document: (doc) => {
            const t = this.scope.documentFilterText.toLowerCase()

            // always check title & match (url), optionally check page text objects
            return t.length === 0 ||
                (typeof doc.title === 'string' && doc.title.toLowerCase().indexOf(t) != -1) ||
                (doc.match.toLowerCase().indexOf(t) != -1) || (
                    this.scope.options.showPageText &&
                    doc.texts.some(o => {
                        // text may have introduced undefined (see context_menus)
                        return typeof o.text === 'string' && o.text.toLowerCase().indexOf(t) != -1
                    })
                )
        }
      }

      for (const func of [
        this.onClickRemoveHighlight,
        this.onClickRemoveAllHighlights,
        this.onClickRemoveAllBookmarks,
      ]) {
				this.scope[func.name] = func.bind(this)
      }

      // manually add event listeners to mouseenter/leave on div containing bookmarks tab
      // TODO: move to HTML
      const bookmarksElm = document.querySelector('#bookmarks')

      bookmarksElm.addEventListener('mouseenter', this.onMouseEnterBookmarks, 
        // @ts-ignore
        { capture: true, passive: true })
      bookmarksElm.addEventListener('mouseleave', this.onMouseLeaveBookmarks, 
        // @ts-ignore
        { capture: true, passive: true })

      // docs before grouping
      /** @type {DB.Document[]} */
      this.ungroupedDocs = []
    }

    /**
     * Asyc initializer
     * 
     * @returns {Promise}
     * @memberof Controller
     */
    init() {
      const db = new DB()

      // build default options object
      return new ChromeStorage().get([
        ChromeStorage.KEYS.OPTIONS.BOOKMARKS_GROUP_BY,
        ChromeStorage.KEYS.OPTIONS.BOOKMARKS_ASCENDING_ORDER,
        ChromeStorage.KEYS.OPTIONS.BOOKMARKS_SHOW_PAGE_TEXT,
      ]).then(items => {
        // initialize options of scope
        this.scope.options = {
            groupBy: items[ChromeStorage.KEYS.OPTIONS.BOOKMARKS_GROUP_BY],
            ascendingOrder: items[ChromeStorage.KEYS.OPTIONS.BOOKMARKS_ASCENDING_ORDER],
            showPageText: items[ChromeStorage.KEYS.OPTIONS.BOOKMARKS_SHOW_PAGE_TEXT], 
        }
        
        // get an array of each unique match, and the number of associated documents (which is of no use)
        return db.getSums()
      }).then(rows => {
        // the key for each row (item in the array) is the 'match' for each document, 
        // and the value is the sum ('create'+1, 'delete'-1)
        const o = {
          descending: false,
          limit: 1
        }

        return Promise.all(rows
          .filter(({ value }) => value > 0)
          .map(({ key }) => db.getMatchingDocuments(key, o))
        )
      }).then(docsArray => {
        // each entry in docs array is an array containing at most one doc
        const docs = docsArray
            .filter(a => a.length === 1)
            .map(a => a[0])

        // first doc should always be a 'create'
        console.assert(docs.every(d => d[DB.DOCUMENT.NAME.VERB] === DB.DOCUMENT.VERB.CREATE))

        // if we're grouping by last_date (date of the last non-deleted 'create' document),
        // or showing text for each highlight, we need to get all create documents too
        return Promise.all(docs.map(d => {
            return db.getMatchingDocuments(d[DB.DOCUMENT.NAME.MATCH], {excludeDeletedDocs: true}).then(a => {
                // if the first create document has a corresponding delete document, then the title (stored only
                // on the first document) will be removed along with the create document.
                console.assert(a.length >= 1)
                
                // So we go through this dance.
                if (a.length >= 1 && a[0]._id !== d._id) {
                    a[0][DB.DOCUMENT.NAME.TITLE] = d[DB.DOCUMENT.NAME.TITLE]
                }

                return a
            })
        }))
      }).then(docs => {
        // we have an array of array of createDocs

        // add temporary properties to first doc of each
        docs = docs.filter(a => a.length >= 1)
        
        for (const a of docs) {
            // numeric date of creation of latest 'create' doc
            a[0].lastDate = a[a.length - 1].date
            // array of each text item for the page's 'create' docs, and its className (aka highlight style)
            a[0].texts = a.map(doc => {
                return {
                    // text might be undefined if info.selectedText was undefined in context_menus.js (for some reason)
                    text: doc.text,
                    docId: doc._id,
                    date: doc.date,
                    className: doc.className,
                }
            })
        }

        this.ungroupedDocs = docs.map(a => a[0])

        // group the documents by their title (if possible), and get a sorted array
        this.groupDocuments()
        this.scope.$apply()

        // After the initial update, watch for changes to options object
        this.scope.$watchCollection('options', this.onOptionsCollectionChanged.bind(this))
      })
    } // end init()

    // grouping methods

    /**
     * @typedef {Object} Group
     * @prop {DB.Document[]} docs
     * @prop {string} [title]
     * @prop {*} [value] - value used to derive title (then deleted)
     */

    /**
     * Group an array of documents by a common property
     * 
     * @param {any} [docs=this.ungroupedDocs] - array of 'create' documents for the first of its matches 
     * @param {Object} options {
     *       groupBy = this.scope.options.groupBy || 'title',
     *       reverse = (typeof this.scope.options.ascendingOrder === 'boolean' && !this.scope.options.ascendingOrder) || true
     *     } 
     * @memberof Controller
     */
    groupDocuments(docs = this.ungroupedDocs, {
      groupBy = this.scope.options.groupBy || 'title',
      reverse = !this.scope.options.ascendingOrder
    } = {}){
      const groups = {}

      /** @type {Group} */
      const untitledGroup = {
        // value: chrome.i18n.getMessage('untitled_page_group'),
        docs: []
      }
      
      /** @type {Group} */
      const numberGroup = { 
        docs: [],
        value: "#",// chrome.i18n.getMessage('untitled_page_group'),
      }
            
      // remove docs with empty text, and iterate
      for (const doc of docs.filter(d => d.texts.length > 0)) {
        // the name can determine the group to place the doc in, and (if string and the group doesn't yet exist) its 'value' (aka group title)
        const name = (() => {
          switch (groupBy) {
              case Controller.GROUP_BY.TITLE:
                const title = doc.title

                // upper case first letter, or undefined if empty
                return (typeof doc.title === 'string' && 
                  doc.title.length >= 1 && 
                  doc.title[0].toUpperCase()) || undefined

            case Controller.GROUP_BY.FIRST_DATE:
                // days since epoch
                return Math.floor(new Date(doc.date).getTime() / 8.64e7)

            case Controller.GROUP_BY.LAST_DATE:
                // days since epoch
                return Math.floor(new Date(doc.lastDate).getTime() / 8.64e7)

            default:
                console.assert(false)
          }
        })()

        // the group the doc should go in (create if required)
        const group = (() => {
          switch (typeof name) {
            case 'undefined':
              return untitledGroup

            case 'string':
              // if the string (single letter) is a digit
              if (groupBy === Controller.GROUP_BY.TITLE && !isNaN(parseInt(name, 10))) {
                return numberGroup
              }

            // fallthrough to default

            default:
              // create the group if it doesn't already exist
              if (!groups.hasOwnProperty(name)) {
                groups[name] = {
                  docs: [],
                  value: name,      // formatted later (if not string)
                }
              }

              return groups[name]
          }
        })()

        // add document to the correct group
        group.docs.push(doc)
      } // end for 

      // convert to array
      let groupedDocs = Object.getOwnPropertyNames(groups)
        .sort()
        .map(value => groups[value])

      // add number and untitled groups
      Array.prototype.push.apply(groupedDocs, [
          numberGroup,
          untitledGroup
      ].filter(({docs}) => docs.length > 0))

      for (const group of groupedDocs) {
        // format group title as text, using 'value'
        switch (typeof group.value) {
          case 'undefined':
            group.title = undefined
            break

          case 'number':
            // value is days since epoch
            group.title = new Date(group.value * 8.64e7).toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
            break

          case 'string':
            // value is the first letter of group title
            group.title = group.value
            break
        }

        // no longer need value property
        delete group.value

        // sort documents in-place within group
        group.docs.sort((() => {
          // return a specific comparison func
          switch (groupBy) {
            case Controller.GROUP_BY.TITLE:
              return (d1, d2) => {
                // title may be undefined 
                if (typeof d1 === 'undefined' && typeof d2 === 'undefined') {
                  return 0;
                }

                return (d1.title || "").localeCompare(d2.title || "")
              }

            case Controller.GROUP_BY.FIRST_DATE:
              return (d1, d2) => d1.date - d2.date
            case Controller.GROUP_BY.LAST_DATE:
              return (d1, d2) => d1.lastDate - d2.lastDate
          }
        })())
      } // end for

      if (reverse) {
        // reverse groups in-place
        for (const group of groupedDocs.reverse()) {
          // reverse docs of each group in place
          group.docs.reverse()
        }
      }
      
      this.scope.groupedDocs = groupedDocs
    } // end groupDocuments()

    // watch collection handlers

    /**
     * scope.options collection changed
     * 
     * @param {Options} newOptions 
     * @param {Options} oldOptions 
     * @returns {Promise}
     * @memberof Controller
     */
    onOptionsCollectionChanged(newOptions, oldOptions) {
      // update storage
      return new ChromeStorage().set({
          [ChromeStorage.KEYS.OPTIONS.BOOKMARKS_GROUP_BY]: newOptions.groupBy,
          [ChromeStorage.KEYS.OPTIONS.BOOKMARKS_ASCENDING_ORDER]: newOptions.ascendingOrder,
          [ChromeStorage.KEYS.OPTIONS.BOOKMARKS_SHOW_PAGE_TEXT]: newOptions.showPageText,
      }).then(() => {
          // only these need to cause update
          // if (newValue.groupBy === oldValue.groupBy &&
          //     newValue.ascendingOrder === oldValue.ascendingOrder) {
          //     return
          // }

          // rebuild group documents array based on new options
          this.groupDocuments()
          this.scope.$apply()
      })
    }

    // mouse events

    /**
     * Mouse entered a child of the bookmarks div
     * 
     * @memberof Controller
     */
    onMouseEnterBookmarks() {
      const target = /** @type {HTMLElement} **/ (event.target)
      
      if (!target.classList.contains('page-text-list-item')) {
          return
      }
  
      // TODO: add/remove button elements dynamically

      // remove hysteresis timer
      if (typeof target[Controller.HYSTERESIS_TIMER.ID] === 'number') {
          clearTimeout(target[Controller.HYSTERESIS_TIMER.ID])
          
          delete target[Controller.HYSTERESIS_TIMER.ID]
      }
  
      // show close button
      const elm = /** @type {HTMLButtonElement} **/ (target.querySelector('.list-item-close'))
      elm.style.setProperty('opacity', '1')
    }

    /**
     * Mouse left a child of the bookmarks div
     * 
     * @memberof Controller
     */
    onMouseLeaveBookmarks() {
      const target = /** @type {HTMLElement} **/ (event.target)
      
      if (!target.classList.contains('page-text-list-item')) {
          return
      }
  
      const elm = /** @type {HTMLButtonElement} **/ (target.querySelector('.list-item-close'))
  
      // add a timeout once we leave the element. If we return we cancel the transition out
      target[Controller.HYSTERESIS_TIMER.ID] = setTimeout(() => {
          // transition out wasn't cancelled
          delete target[Controller.HYSTERESIS_TIMER.ID]
  
          elm.style.setProperty('opacity', '0')
      }, Controller.HYSTERESIS_TIMER.TIMEOUT);
    }

    // click handlers

    /**
     * Button on the text of each highlight was clicked
     *
     * @param {string} docId - id of doc that defines the actual highlight
     * @param {DB.Document} initialDoc - initial doc for the page, containing array of text objects for all the highlights
     * @returns {Promise}
     */
    onClickRemoveHighlight(docId, initialDoc) {
      // use highlighter with no tabId, so it finds the tab with the matching url
      return new Highlighter().delete(docId).then(() => {
        const idx = initialDoc.texts.findIndex(t => t.docId === docId)
        console.assert(idx !== -1)

        // splice out of array of highlights (i.e. texts)
        initialDoc.texts.splice(idx, 1)

        // regroup
        this.groupDocuments()
        this.scope.$apply()
      })
    }

    /**
     * Clicked 'remove all highlights for this site' button (x)
     * 
     * @param {DB.Document} doc - document defining the match string to use to identify highlights to remove
     * @param {Group} group - group containing this doc
     * @returns {Promise}
     * @memberof Controller
     */
    onClickRemoveAllHighlights(doc, group) {
      if (!window.confirm(chrome.i18n.getMessage("confirm_remove_all_highlights"))) {
          return Promise.resolve()
      }

      // var match = this.scope.rows[index].key;
      return new DB().removeMatchingDocuments(doc.match).then(() => {
          // remove the corresponding doc from our 'this.scope.groupedDocs' via the handy reference
          const index = group.docs.indexOf(doc)
          if (index === -1) {
              return Promise.reject(new Error("document not found"))
          }

          group.docs.splice(index, 1)

          this.scope.$apply()
      })
    }

    /**
     * Clicked 'remove all pages' button.
     * 
     * @returns {Promise}
     * @memberof Controller
     */
    onClickRemoveAllBookmarks() {
      if (!window.confirm(chrome.i18n.getMessage("confirm_remove_all_pages"))) {
        return Promise.resolve()
      }

      // destroy the database. It will be lazily recreated
      return new DB().destroyDB().then(() => {
        this.scope.groupedDocs = []
        this.scope.$apply()
     })
    }
  } // end class

  // static properties

  Controller.GROUP_BY = {
    TITLE: 'title',
    FIRST_DATE: 'first_date',
    LAST_DATE: 'last_date',
  }

  Controller.HYSTERESIS_TIMER = {
    ID: 'hysteresisTimerID',
    TIMEOUT: 500,
  }

  // init
  // unhandled promise
  new Controller($scope).init()
}])