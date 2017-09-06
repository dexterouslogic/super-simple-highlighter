class RuntimeCallback {
  /**
   * Fired when a profile that has this extension installed first starts up.
   * This event is not fired when an incognito profile is started, even if this
   * extension is operating in 'split' incognito mode.
   * 
   * @static
   * @returns {Promise}
   * @memberof RuntimeCallback
   */
  static onStartup() {
    // remove entries in which the number of 'create' doc == number of 'delete' docs
    return new DB().removeAllSuperfluousDocuments()
  }

  /**
   * Fired when a message is sent from either an extension process (by runtime.sendMessage) or a content script (by tabs.sendMessage).
   * 
   * @static
   * @param {any} [message] - The message sent by the calling script.
   * @param {Object} sender 
   * @param {Function} sendResponse - Function to call (at most once) when you have a response. The argument should be any JSON-ifiable object.
   *  If you have more than one onMessage listener in the same document, then only one may send a response.
   *  This function becomes invalid when the event listener returns, unless you return true from the event listener to indicate you wish to send a 
   *  response asynchronously (this will keep the message channel open to the other end until sendResponse is called). 
   * @memberof RuntimeCallback
   */
  static onMessage(message, sender, sendResponse) {
    switch (message.id) {
      case RuntimeCallback.MESSAGE.DELETE_HIGHLIGHT:
        // message.highlightId is the document id to be deleted
        return ChromeTabs.queryActiveTab().then(tab => {
          if (!tab) {
            return
          }

          return new Highlighter(tab.id).delete(message.highlightId)
        })

      default:
        throw `Unhandled message: sender=${sender}, id=${message.id}`
    }
  }
}

// messages sent to the event page (from content script)
RuntimeCallback.MESSAGE = {
  DELETE_HIGHLIGHT: 'on_click_delete_highlight',
}

//

class StorageCallback {
  /**
   * Fired when one or more items change.
   * 
   * @static
   * @param {Object} changes - Object mapping each key that changed to its corresponding storage.StorageChange for that item.
   * @param {string} areaName - The name of the storage area ("sync", "local" or "managed") the changes are for.
   * @returns {Promise}
   * @memberof StorageCallback
   */
  static onChanged(changes, areaName) {
    // Content of context menu depends on the highlight styles
    if (areaName !== 'sync' || !changes.highlightDefinitions) {
      return Promise.resolve()
    }

    // unhandled promise
    return ChromeContextMenus.create()
  }
}

//

class CommandsCallback {
  /**
   * Fired when a registered command is activated using a keyboard shortcut.
   * 
   * @callback
   * @static
   * @param {string} command 
   * @memberof CommandsCallback
   */
  static onCommand(command) {
    // all commands require active tab
    return ChromeTabs.queryActiveTab().then(activeTab => {
      if (!activeTab) {
        return Promise.reject(new Error('no active tab'))
      }

      const tabs = new ChromeTabs(activeTab.id)
      const highlighter = new Highlighter(activeTab.id)

      switch (command) {
        case CommandsCallback.COMMAND.UNDO:
          return highlighter.undo()

        case CommandsCallback.COMMAND.DELETE:
          return tabs.getHoveredHighlightID().then(docId => {
            if (!docId) {
              return
            }

            return highlighter.delete(docId)
          })

        default:
          // parse command id string
          const re = new RegExp(`^${CommandsCallback.COMMAND.APPLY}\\.(\\d+)$`)
          const match = re.exec(command)

          if (!match || match.length !== 2) {
            return Promise.reject(new Error("unknown command " + command))
          }

          const index = parseInt(match[1])
          const storage = new ChromeStorage()

          // name of class that new highlight should adopt
          let highlightClassName

          // convert to object
          return new ChromeHighlightStorage().getAll().then(items => {
            const highlightDefinitions = items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]

            if (!highlightDefinitions || highlightDefinitions.length <= index) {
              return Promise.reject(new Error("Unable to match command index to definition"));
            }

            highlightClassName = highlightDefinitions[index].className

            // const match = DB.formatMatch(activeTab.url)
            // if (!match) {
            //     return Promise.reject(new Error());
            // }

            return tabs.getSelectionRange()
          }).then(xrange => {
            if (!xrange) {
              return Promise.reject(new Error())
            }

            // non collapsed selection means create new highlight
            if (!xrange.collapsed) {
              // requires selection text
              return tabs.getRangeText(xrange).then(text => {
                if (!text) {
                  return Promise.reject(new Error())
                }

                // create new document for highlight,
                // then update DOM
                return highlighter.create(
                  xrange,
                  DB.formatMatch(activeTab.url),
                  text,
                  highlightClassName
                )
              }).then(() => {
                // remove selection?
                return storage.get(ChromeStorage.KEYS.UNSELECT_AFTER_HIGHLIGHT).then(value => {
                  if (!value) {
                    return
                  }

                  // clear selection
                  return tabs.selectHighlight()
                })
              })
            } else {
              // collapsed selection range means update 
              // the hovered highlight (if possible)
              return tabs.getHoveredHighlightID().then(docId => {
                if (!docId) {
                  return
                }

                // if the hovered highlight has a different style to the shortcut request, update
                // it. If not, remove the highlight.

                /// get doc associated with highlight, identified by id
                return new DB().getDocument(docId).then(doc => {
                  if (doc[DB.DOCUMENT.NAME.CLASS_NAME] !== highlightClassName) {
                    // different class. update.
                    return highlighter.update(doc._id, highlightClassName)
                  }

                  // the 'toggle' nature of this means it only makes sense 'unselectAfterHighlight' is true.
                  // Otherwise it's too easy to make multiple highlights over the same range.
                  return storage.get(ChromeStorage.KEYS.UNSELECT_AFTER_HIGHLIGHT).then(value => {
                    if (!value) {
                      return
                    }

                    // remove the highlight, then select the text it spanned
                    return highlighter.delete(doc._id).then(() => {
                      return tabs.selectRange(doc[DB.DOCUMENT.NAME.RANGE])
                    })
                  })
                })
              })
            }// end else
          }) // end then
      } // end switch
    }) // end then
  }
} // end class

// static

CommandsCallback.COMMAND = {
  // delete the highlight of the highlight hovered on the currently active tab
  DELETE: 'delete_hovered_highlight',
  UNDO: 'undo_last_create_highlight',
  // formatted
  APPLY: 'apply_highlight'
}

//

/**
 * @typedef Details
 * @prop {number} tabId - The ID of the tab in which the navigation occurs.
 * @prop {string} url 
 * @prop {number} processId - The ID of the process that runs the renderer for this frame.
 * @prop {number} frameId - 0 indicates the navigation happens in the tab content window; a positive value indicates navigation in a subframe. Frame IDs are unique within a tab.
 * @prop {double} timeStamp - The time when the document finished loading, in milliseconds since the epoch.
 * @memberof WebNavigationCallback
 */

class WebNavigationCallback {
  /**
   * Fired when a document, including the resources it refers to, is completely loaded and initialized.
   * 
   * @static
   * @param {Details} details 
   * @return {Promise}
   * @memberof WebNavigationCallback
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

    let matchedDocs

    return  ChromeContextMenus.create().then(() => {
      return db.getMatchingDocuments(DB.formatMatch(details.url))
    }).then(docs => {
      matchedDocs = docs
      console.log(`Matched ${matchedDocs.length} document(s) for ${details.url}`)

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
      const errorCreateDocIds = new Set()

      return tabs.executeDefaultScript().then(() => {
        return tabs.playbackDocuments(matchedDocs, errorDoc => {
          // method only called if there's an error. called multiple times
          if (errorDoc[DB.DOCUMENT.NAME.VERB] === DB.DOCUMENT.VERB.CREATE) {
            errorCreateDocIds.add(errorDoc._id)
          }
        })
      }).then(sum => {
        const pageAction = new ChromePageAction(details.tabId)

        if (sum > 0) {
          pageAction.show()
        }

        if (errorCreateDocIds.size > 0) {
          // remove 'create' docs for which a matching 'delete' doc exists
          for (const doc of matchedDocs.filter(d => d[DB.DOCUMENT.NAME.VERB] === DB.DOCUMENT.VERB.DELETE)) {
            errorCreateDocIds.delete(doc.correspondingDocumentId)

            if (errorCreateDocIds.size === 0) {
              break
            }
          }

          // any remaining entries are genuinely invalid
          if (errorCreateDocIds.size > 0) {
            console.warn(`Error replaying ${errorCreateDocIds.size} 'create' document(s) [${Array.from(errorCreateDocIds).join('\n')}]`)

            pageAction.setTitle(chrome.i18n.getMessage("page_action_title_not_in_dom"))

            return pageAction.setIcon({
              path: {
                  19: "static/images/popup/19_warning.png",
                  38: "static/images/popup/38_warning.png",
              }
            })            
          }
        }
      })
    })
  }
}

//

// runtime
chrome.runtime.onStartup.addListener(RuntimeCallback.onStartup)
chrome.runtime.onMessage.addListener(RuntimeCallback.onMessage)

// storage
chrome.storage.onChanged.addListener(StorageCallback.onChanged)

// commands
chrome.commands.onCommand.addListener(CommandsCallback.onCommand)

// context menus
chrome.contextMenus.onClicked.addListener(ChromeContextMenus.onClicked)

// web navigation
chrome.webNavigation.onCompleted.addListener(WebNavigationCallback.onCompleted, {
  url: [{
      schemes: [
        'http',
        'https',
        'file'
      ]
  }]
})

// /**
//  * Singleton class
//  * 
//  * @class ChromeEventPage
//  */
// class ChromeEventPage {
//   constructor() {

//   }
// }

// // singleton instance
// const $ = new ChromeEventPage()