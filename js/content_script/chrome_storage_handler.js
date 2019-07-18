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
 * Handlers for events from chrome.storage
 * 
 * @class ChromeStorageHandler
 */
class ChromeStorageHandler {
  /**
   * Creates an instance of ChromeStorageHandler.
   * @param {StyleSheetManager} styleSheetManager 
   * @memberof ChromeStorageHandler
   */
  constructor(styleSheetManager) {
    this.styleSheetManager = styleSheetManager
  }

  /**
   * Synchronous init
   * 
   * @returns {ChromeStorageHandler}
   * @memberof ChromeStorageHandler
   */
  init() {
    // listeners
    chrome.storage.onChanged.addListener(this.onStorageChanged.bind(this))
    
    // add the style element to the page, via a dummy storage change event
    this.onStorageChanged()

    return this
  }

  // event handlers

  /**
   * Fired when one or more items change.
   * 
   * @param {Object} [changes] - Object mapping each key that changed to its corresponding storage.StorageChange for that item.
   * @param {string} [areaName='sync'] - The name of the storage area ("sync", "local" or "managed") the changes are for.
   * @returns {Promise}
   * @memberof ChromeStorageHandler
   */
  onStorageChanged(changes, areaName='sync') {
    if (areaName !== 'sync') {
      return Promise.resolve()
    }
    
    let enableHighlightBoxShadow

    // if changes isn't defined (which only happens when we manually call this), load values from storage
    return (typeof changes === 'object' ?
      Promise.resolve(changes) :
      new ChromeHighlightStorage().getAll().then(items => {
        // form changes object with the current values from storage
        return {
          [ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE]: {
              newValue: items[ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE]
          },
          [ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]: {
              newValue: items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]
          },
        }
      }).then(c => changes = c)
    ).then(() => {
      return new ChromeStorage().get(ChromeStorage.KEYS.ENABLE_HIGHLIGHT_BOX_SHADOW)
    }).then(enable => {
      enableHighlightBoxShadow = enable 
      
      // 1 - process shared style first
      return new Promise(resolve => {
        const change = changes[ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE]
        
        if (!change) {
          resolve()
          return
        }
        
        const className = this.styleSheetManager.sharedHighlightClassName

        if (change.oldValue) {
          this.styleSheetManager.deleteRule(className)
        }

        if (change.newValue) {
          return this.styleSheetManager.setRule({
            className: className,
            style: change.newValue,
            disableBoxShadow: !enableHighlightBoxShadow
          }).then(() => {
            resolve()
          })
        }

        resolve()
      })
    }).then(() => {
      // 2 - process specific highlight styles
      const change = changes[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]

      if (!change) {
        return
      }

      if (change.oldValue) {
        for (const highlightDefinition of change.oldValue) {
          this.styleSheetManager.deleteRule(highlightDefinition.className)
        }
      }

      if (change.newValue) {
        for (const highlightDefinition of change.newValue) {
            highlightDefinition.disableBoxShadow = !enableHighlightBoxShadow
        }

        return Promise.all(change.newValue.map(hd => this.styleSheetManager.setRule(hd, true)))
      }
    }).then(() => {
      // the contents of the style element are correct, but currently only in the DOM. To be included
      // in a saved file they need to be explicitly be made the text node content of the style element.
      this.styleSheetManager.textualizeStyleElement()
    })
  } // end onStorageChange()
}
