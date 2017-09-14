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
 * Manager of event page context menu things
 * 
 * @class ChromeContextMenusHandler
 */
class ChromeContextMenusHandler {
  /**
   * Add static methods of class as listeners
   * 
   * @static
   * @memberof ChromeContextMenusHandler
   */
  static addListeners() {
    chrome.contextMenus.onClicked.addListener(ChromeContextMenusHandler.onClicked)
  }

  /**
   * Create (or recreate) the page action menu
   * 
   * @static
   * @param {Object} options [{containsHighlights=false}={}] 
   * @returns 
   * @memberof ChromeContextMenusHandler
   */
  static createPageActionMenu({containsHighlights = false} = {}) {
    // @ts-ignore
    return ChromeContextMenusHandler.remove(Object.values(ChromeContextMenusHandler.ID.PAGE_ACTION)).then(() => {
      const template = { contexts: ['page_action'] },
        items = [{
          id: ChromeContextMenusHandler.ID.PAGE_ACTION.OPEN_BOOKMARKS,
          title: chrome.i18n.getMessage("bookmarks"),
        }]

      // if (!containsHighlights) {
      //   items.unshift(
      //     {
      //       id: ChromeContextMenusHandler.ID.PAGE_ACTION.HIGHLIGHTS_COUNT,
      //       enabled: false,
      //       title: chrome.i18n.getMessage("pageaction_no_highlights"),
      //     },
      //     {
      //       type: "separator",
      //       id: ChromeContextMenusHandler.ID.PAGE_ACTION.SEPARATOR_HIGHLIGHTS_COUNT,
      //     })
      // }

      return ChromeContextMenusHandler.create(items.map(i => Object.assign({}, template, i)))
    })
  }

  /**
   * Create (or recreate) a context menu, based on currently stored highlight definitions, and commands
   * 
   * @static
   * @returns {Promise}
   * @memberof ChromeContextMenusHandler
   */
  static createSelectionMenu() {
    // id of root of context menu
    let parentId, allCommands

    const template = { contexts: ['selection'] }
    
    // remove all current entries
    return ChromeContextMenusHandler.remove(ChromeContextMenusHandler.ID.SELECTION.PARENT).then(() => {
      // get parent context menu item (root)
      return ChromeContextMenusHandler.create(Object.assign({}, template, {
        id: ChromeContextMenusHandler.ID.SELECTION.PARENT,
        title: chrome.runtime.getManifest().name,
      }))
    }).then(([id]) => parentId = id).then(() => {
      // get commands to get shortcut keys
      console.assert(parentId === ChromeContextMenusHandler.ID.SELECTION.PARENT)

      return new Promise(resolve => { chrome.commands.getAll(c => resolve(c))} )
    }).then(c => {
      allCommands = c

      // get all highlight definitions
      return new ChromeHighlightStorage().getAll().then(items => {
        return items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]
      })
    }).then(highlightDefinitions => {
      // map to array of promise-returnign functions to be run sequentially
      const pfuncs = highlightDefinitions.map((hd, idx) => {
        return () => {
          // form title
          let title = hd.title
          
          // add shortcut to title if present. index within commands should match index of definition
          // TODO: something better
          if (idx < allCommands.length && allCommands[idx].shortcut && allCommands[idx].shortcut.length > 0) {
            title += ` \t${allCommands[idx].shortcut}`
          }

          // id of each definition is string of format 'create_highlight.[definition class name]'
          return ChromeContextMenusHandler.create(Object.assign({}, template, {
            id: `${ChromeContextMenusHandler.ID.SELECTION.CREATE_HIGHLIGHT}.${hd.className}`,
            parentId: parentId,
            title: title,
          }))
        }
      })

      return PromiseUtils.serial(pfuncs)
    })
  }

  /**
   * Remove context menu items serially
   * 
   * @static
   * @param {string|number|(string|number)[]} menuItemId - items to remove
   * @param {{catchError: false}} options
   * @returns {Promise}
   * @memberof ChromeContextMenusHandler
   */
  static remove(menuItemId, {catchError = false} = {}) {
    const pfuncs = (Array.isArray(menuItemId) ? menuItemId : [menuItemId]).map(id => function() {
      return new Promise((resolve, reject) => {
        chrome.contextMenus.remove(id, () => {
          if (chrome.runtime.lastError && catchError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }
  
          resolve()
        })
      })
    })

    return PromiseUtils.serial(pfuncs)
  }

  /**
   * Remove all items in context menu
   * 
   * @static
   * @returns {Promise}
   * @memberof ChromeContextMenusHandler
   */
  static removeAll() {
    return new Promise(resolve => { 
      chrome.contextMenus.removeAll(() => {
        resolve()
      })
    })
  }

  /**
   * Promisified wrapper for chrome.contextMenus.create
   * 
   * @private
   * @static
   * @param {Object|Object[]} properties - chrome.contextMenu.createProperties object OR array of objects (processed sequentially)
   * @returns {Promise<string|number>[]} - array of promises with id of item 
   * @memberof ChromeContextMenusHandler
   */
  static create(properties) {
    const pfuncs = (Array.isArray(properties) ? properties : [properties]).map(p => function() {
      return new Promise((resolve, reject) => {
        const id = chrome.contextMenus.create(p, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }
  
          resolve(id)
        })
      })
    })

    return PromiseUtils.serial(pfuncs)
  }
  
  //

  /**
   * Called when context menu clicked
   * 
   * @typedef {Object} Info
   * @prop {string|number} [menuItemId]
   * @prop {boolean} editable
   * @prop {string} [frameUrl]
   * @prop {string} [selectionText]
   * 
   * @static
   * @callback
   * @param {Info} info - nformation about the item clicked and the context where the click happened.
   * @param {Object} [tab] - The details of the tab where the click took place. If the click did not take place in a tab, this parameter will be missing.
   * @returns {Promise}
   * @memberof ChromeContextMenusHandler
   */
  static onClicked(info, tab) {
    switch (info.menuItemId) {
      case ChromeContextMenusHandler.ID.SELECTION.OPEN_BOOKMARKS:
        return ChromeTabs.create({ 
          openerTabId: tab.id,
          url: 'options.html#bookmarks'
        })
    
      default:
        // parse the formatted menu item id into its verb & parameter parts (if possible)
        const match = new RegExp("^(.+)\\.(.+)").exec(/** @type {string} */ (info.menuItemId))
      
        if (!match || match.length !== 3) {
            return Promise.resolve()
        }

        switch (match[1]) {
          case ChromeContextMenusHandler.ID.SELECTION.CREATE_HIGHLIGHT:
            // states in which a highlight can't be created
            if (info.editable) {
              window.alert(chrome.i18n.getMessage("alert_create_highlight_in_editable"))
              break
            }

            // can't create highlight in frames that aren't top level frames, or in editable textareas
            if (info.frameUrl && info.frameUrl !== tab.url){
              window.alert(chrome.i18n.getMessage("alert_create_highlight_in_subframe"))
              break
            }

            // get the selection range (_xpath) from content script
            const tabs = new ChromeTabs(tab.id)
            
            // highlight definition class name
            const className = match[2]
            
            return tabs.getSelectionRange().then(xrange => {
                if (xrange.collapsed) {
                    return Promise.reject(new Error())
                }
                
                // create new document for highlight, then update DOM
                return new Highlighter(tab.id).create(
                    xrange,
                    DB.formatMatch(tab.url, info.frameUrl),
                    info.selectionText, 
                    className
                )
            }).then(() => new ChromeStorage().get(ChromeStorage.KEYS.UNSELECT_AFTER_HIGHLIGHT)).then(value => {
                if (!value) {
                    return
                }

                // clear selection
                return tabs.selectHighlight()
            })
        
          default:
            return Promise.reject(new Error(`Unhandled menu item id: ${info.menuItemId}`))
        }// end switch

        return Promise.resolve()
    } // end switch
  } // end onClicked()
}

// static

ChromeContextMenusHandler.ID = {
  SELECTION: {
    // required (but unused) id of parent menu item
    PARENT: 'sos',
    // prefix of each create highlight menu item ('create_highlight.[className]')
    CREATE_HIGHLIGHT: 'create_highlight'
  },

  PAGE_ACTION: {
    // HIGHLIGHTS_COUNT: "highlights-count",
    // SEPARATOR_HIGHLIGHTS_COUNT: "separator-highlights-count",

    // open options at bookmarks tab
    OPEN_BOOKMARKS: 'open_bookmarks',
  }
}
