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
 * @class ChromeContextMenus
 */
class ChromeContextMenus {
  /**
   * Add static methods of class as listeners
   * 
   * @static
   * @memberof ChromeContextMenus
   */
  static addListeners() {
    chrome.contextMenus.onClicked.addListener(ChromeContextMenus.onClicked)
  }

  /**
   * Create (or recreate) a context menu, based on currently stored highlight definitions, and commands
   * 
   * @static
   * @returns {Promise}
   * @memberof ChromeContextMenus
   */
  static create() {
    // id of root of context menu
    let parentId
    // all commands
    let allCommands
    
    // remove all current entries
    return ChromeContextMenus.removeAll().then(() => {
      // page action menu
      return ChromeContextMenus._create({
        contexts: ['page_action'],
        id: ChromeContextMenus.ID.OPEN_BOOKMARKS,
        title: chrome.i18n.getMessage("bookmarks"),
      })
    }).then(() => {
      // get parent context menu item (root)
      return ChromeContextMenus._create({
        id: ChromeContextMenus.ID.PARENT,
        title: chrome.runtime.getManifest().name,
        contexts: ["selection"],
      })
    }).then(id => {
      parentId = id
    }).then(() => {
      // get commands to get shortcut keys
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
          return ChromeContextMenus._create({
            id: `${ChromeContextMenus.ID.CREATE_HIGHLIGHT}.${hd.className}`,
            parentId: parentId,
            title: title,
            contexts: ['selection']
          })
        }
      })

      return PromiseUtils.serial(pfuncs)
    })
  }

  /**
   * Remove all items in context menu
   * 
   * @static
   * @returns {Promise}
   * @memberof ChromeContextMenus
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
   * @param {Object} properties - chrome.contextMenu.createProperties
   * @returns {Promise<string|number>} - id of item 
   * @memberof ChromeContextMenus
   */
  static _create(properties) {
    return new Promise((resolve, reject) => {
      const parentId = chrome.contextMenus.create(properties, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }

        resolve(parentId)
      })
    })
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
   * @memberof ChromeContextMenus
   */
  static onClicked(info, tab) {
    switch (info.menuItemId) {
      case ChromeContextMenus.ID.OPEN_BOOKMARKS:
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
          case ChromeContextMenus.ID.CREATE_HIGHLIGHT:
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

ChromeContextMenus.ID = {
  // required (but unused) id of parent menu item
  PARENT: 'sos',

  // open options at bookmarks tab
  OPEN_BOOKMARKS: 'open_bookmarks',
  
  // prefix of each create highlight menu item ('create_highlight.[className]')
  CREATE_HIGHLIGHT: 'create_highlight'
}
