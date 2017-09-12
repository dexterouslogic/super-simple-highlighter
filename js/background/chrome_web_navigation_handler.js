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
 * Singleton class for chrome.webNavigation callback methods
 * 
 * @class ChromeWebNavigationHandler
 */
class ChromeWebNavigationHandler {
  /**
   * Add static methods of this class as listeners
   * 
   * @static
   * @memberof ChromeWebNavigationHandler
   */
  static addListeners() {
    chrome.webNavigation.onCompleted.addListener(ChromeWebNavigationHandler.onCompleted, {
      url: [{ schemes: ChromeWebNavigationHandler.COMPLETED_URL_SCHEMES }]
    })
  }

  /**
   * Fired when a document, including the resources it refers to, is completely loaded and initialized.
   * 
   * @typedef Details
   * @prop {number} tabId - The ID of the tab in which the navigation occurs.
   * @prop {string} url 
   * @prop {number} processId - The ID of the process that runs the renderer for this frame.
   * @prop {number} frameId - 0 indicates the navigation happens in the tab content window; a positive value indicates navigation in a subframe. Frame IDs are unique within a tab.
   * @prop {double} timeStamp - The time when the document finished loading, in milliseconds since the epoch.
   * 
   * @static
   * @param {Details} details 
   * @return {Promise}
   * @memberof ChromeWebNavigationHandler
   */
  static onCompleted(details) {
    // 0 indicates the navigation happens in the tab content window
    if (details.frameId !== 0) {
      return Promise.resolve()
    }

    // get all the documents with our desired highlight key, in increasing order
    // query for all documents with this key
    const db = new DB()
    const tabs = new ChromeTabs(details.tabId)
    const match = DB.formatMatch(details.url)

    let matchedDocs
    // return ChromeContextMenusHandler.createPageActionMenu()
    // create selection and page action menus (#highlights unknown currently)
    return ChromeContextMenusHandler.createSelectionMenu().then(() => {
      return db.getMatchingDocuments(match)
    }).then(docs => {
      matchedDocs = docs
      console.log(`Matched ${matchedDocs.length} doc(s) using match "${match}" formatted from "${details.url}"`)

      // configure and show page action
      if (matchedDocs.length === 0) {
        return
      }

      const doc = matchedDocs[0]

      // if the first document is a 'create' document without a title, update it now
      if (doc[DB.DOCUMENT.NAME.VERB] === DB.DOCUMENT.VERB.CREATE &&
        typeof doc[DB.DOCUMENT.NAME.TITLE] === 'undefined') {
        // promise resolves when tab title obtained
        return tabs.get().then(({ title, url }) => {
          // ignore tabs where the title == url (i.e. not explicity defined)
          if (title === url) {
            return
          }

          return db.updateCreateDocument(doc._id, { title: title })
        })
      }
    }).then(() => {
      // set of ids of 'create' documents that reported errors, and did NOT have a corresponding
      // 'delete' document (i.e. implying it's not really an error)
      const invalidDocIds = new Set()

      return tabs.executeDefaultScript().then(() => {
        return tabs.playbackDocuments(matchedDocs, errorDoc => {
          // method only called if there's an error. called multiple times
          if (errorDoc[DB.DOCUMENT.NAME.VERB] === DB.DOCUMENT.VERB.CREATE) {
            invalidDocIds.add(errorDoc._id)
          }
        })
      }).then(sum => {
        const pageAction = new ChromePageAction(details.tabId)

        if (sum > 0) {
          pageAction.show()
        }

        // recreate the page action with the correct number of highlights
        return ChromeContextMenusHandler.createPageActionMenu({highlightsCount : sum}).then(() => {
          if (invalidDocIds.size === 0) {
            return
          }

          // remove 'create' docs for which a matching 'delete' doc exists
          for (const doc of matchedDocs.filter(d => d[DB.DOCUMENT.NAME.VERB] === DB.DOCUMENT.VERB.DELETE)) {
            invalidDocIds.delete(doc.correspondingDocumentId)

            if (invalidDocIds.size === 0) {
              break
            }
          }

          // any remaining entries are genuinely invalid
          if (invalidDocIds.size > 0) {
            console.info(`Problem playing ${invalidDocIds.size} 'create' doc(s) ${JSON.stringify(Array.from(invalidDocIds), null, ' ')}`)

            pageAction.setTitle(chrome.i18n.getMessage("page_action_title_not_in_dom"))

            return pageAction.setIcon({
              path: {
                  19: "static/images/popup/19_warning.png",
                  38: "static/images/popup/38_warning.png",
              }
            })            
          }
        })
      })
    })
  }
}

// static properties

// types of url to listen for 'completed' event
ChromeWebNavigationHandler.COMPLETED_URL_SCHEMES = [
  'http',
  'https',
  'file'
]