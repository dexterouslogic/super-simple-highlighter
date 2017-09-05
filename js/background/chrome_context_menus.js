class ChromeContextMenus {
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
    let commands
    
    // remove all current entries
    return new Promise(resolve => { chrome.contextMenus.removeAll(() => resolve()) }).then(() => {
      // get parent context menu item (root)
      return new Promise((resolve, reject) => {
        parentId = chrome.contextMenus.create({
          type: 'normal',
          id: ChromeContextMenus.ID.PARENT,
          title: chrome.runtime.getManifest().name,
          contexts: ["selection"],
        }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }

          resolve(parentId)
        })
      })
    }).then(() => {
      // get commands to get shortcut keys
      return new Promise(resolve => { chrome.commands.getAll(c => resolve(c))} )
    }).then(c => {
      commands = c

      // get all highlight definitions
      return new ChromeHighlightStorage().getAll().then(items => {
        return items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]
      })
    }).then(highlightDefinitions => {
      // map to array of promise-returnign functions to be run sequentially
      const pfuncs = highlightDefinitions.map((hd, idx) => {
        return () => {
          // form title
          const title = (() => {
            const items = [hd.title]

            // add shortcut to title if present. index within commands should match index of definition
            // TODO: something better
            if (idx < commands.length && commands[idx].shortcut && commands[idx].shortcut.length > 0) {
              items.push(`[${commands[idx].shortcut}]`)
            }

            return items.join(' ')
          })()

          // id of each definition is string of format 'create_highlight.[definition class name]'
          return new Promise((resolve, reject) => {
            chrome.contextMenus.create({
              type: 'normal',
              id: `${ChromeContextMenus.ID.CREATE_HIGHLIGHT}.${hd.className}`,
              parentId: parentId,
              title: title,
              contexts: ['selection']
            }, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
                return
              }

              resolve()
            })
          })
        }
      })

      // https://hackernoon.com/functional-javascript-resolving-promises-sequentially-7aac18c4431e
      const promiseSerial = funcs =>
        funcs.reduce((promise, func) =>
          promise.then(result => func().then(Array.prototype.concat.bind(result))),
          Promise.resolve([])
        )
      
      return promiseSerial(pfuncs)
    })
  }

  //

  /**
   * Called when context menu clicked
   * 
   * @callback
   * @param {Object} info - nformation about the item clicked and the context where the click happened.
   * @param {Object} [tab] - The details of the tab where the click took place. If the click did not take place in a tab, this parameter will be missing.
   * @param {Object} callbacks - { $ } 
   * @returns {Promise}
   * @memberof ChromeContextMenus
   */
  /**
   * 
   * 
   * @static
   * @param {any} info 
   * @param {any} tab 
   
   * @returns 
   * @memberof ChromeContextMenus
   */
  static onClicked(info, tab, { $=undefined } = {}) {
    // parse the formatted menu item id into its verb & parameter parts (if possible)
    const match = new RegExp("^(.+)\\.(.+)").exec(info.menuItemId)
  
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
        const storage = new ChromeStorage()
        
        // highlight definition class name
        const className = match[2]
        
        return tabs.getSelectionRange().then(xrange => {
            if (xrange.collapsed) {
                return Promise.reject(new Error())
            }
            
            // create new document for highlight, then update DOM
            return $ ? $.createHighlight(
                tab.id,
                xrange,
                DB.formatMatch(tab.url, info.frameUrl),
                info.selectionText, 
                className
            ) : Promise.reject(new Error('no event page'))
        }).then(() => storage.get(ChromeStorage.KEYS.UNSELECT_AFTER_HIGHLIGHT)).then(value => {
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
  }
}

// static

ChromeContextMenus.ID = {
  // required (but unused) id of parent menu item
  PARENT: 'sos',
  // prefix of each create highlight menu item ('create_highlight.[className]')
  CREATE_HIGHLIGHT: 'create_highlight'
}
