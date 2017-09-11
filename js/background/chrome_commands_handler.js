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
 * Singleton class for chrome.commands callback methods
 * 
 * @class ChromeCommandsHandler
 */
class ChromeCommandsHandler {
  /**
   * Add static methods of this class as listeners
   * 
   * @static
   * @memberof ChromeCommandsHandler
   */
  static addListeners() {
    chrome.commands.onCommand.addListener(ChromeCommandsHandler.onCommand)
  }

  /**
   * Fired when a registered command is activated using a keyboard shortcut.
   * 
   * @callback
   * @static
   * @param {string} command 
   * @memberof ChromeCommandsHandler
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
        case ChromeCommandsHandler.COMMAND.UNDO:
          return highlighter.undo()

        case ChromeCommandsHandler.COMMAND.DELETE:
          return tabs.getHoveredHighlightID().then(docId => {
            if (!docId) {
              return
            }

            return highlighter.delete(docId)
          })

        default:
          // parse command id string
          const re = new RegExp(`^${ChromeCommandsHandler.COMMAND.APPLY}\\.(\\d+)$`)
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

// static properties

ChromeCommandsHandler.COMMAND = {
  // delete the highlight of the highlight hovered on the currently active tab
  DELETE: 'delete_hovered_highlight',
  UNDO: 'undo_last_create_highlight',
  // formatted
  APPLY: 'apply_highlight'
}
