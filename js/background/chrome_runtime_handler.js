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
 * Singleton class for chrome.runtime callback methods
 * 
 * @class ChromeRuntimeHandler
 */
class ChromeRuntimeHandler {
  /**
   * Add static methods of this class as listeners
   * 
   * @static
   * @memberof ChromeRuntimeHandler
   */
  static addListeners() {
    chrome.runtime.onStartup.addListener(ChromeRuntimeHandler.onStartup)
    chrome.runtime.onMessage.addListener(ChromeRuntimeHandler.onMessage)
  }

  /**
   * Fired when a profile that has this extension installed first starts up.
   * This event is not fired when an incognito profile is started, even if this
   * extension is operating in 'split' incognito mode.
   * 
   * @static
   * @returns {Promise}
   * @memberof ChromeRuntimeHandler
   */
  static onStartup() {
    // remove entries in which the number of 'create' doc == number of 'delete' docs
    return new DB().removeAllSuperfluousDocuments()
  }

  /**
   * Fired when a message is sent from either an extension process (by runtime.sendMessage) or a content script (by tabs.sendMessage).
   * 
   * @static
   * @param {{id: string}} [message] - The message sent by the calling script.
   * @param {Object} sender 
   * @param {Function} sendResponse - Function to call (at most once) when you have a response. The argument should be any JSON-ifiable object.
   *  If you have more than one onMessage listener in the same document, then only one may send a response.
   *  This function becomes invalid when the event listener returns, unless you return true from the event listener to indicate you wish to send a 
   *  response asynchronously (this will keep the message channel open to the other end until sendResponse is called). 
   * @memberof ChromeRuntimeHandler
   */
  static onMessage(message, sender, sendResponse) {
    let response
    let asynchronous = false

    switch (message.id) {
      case ChromeRuntimeHandler.MESSAGE.DELETE_HIGHLIGHT:
        // message.highlightId is the document id to be deleted
        asynchronous = true

        ChromeTabs.queryActiveTab().then(tab => {
          if (!tab) {
            return
          }

          const highlightId = /** @type {{id: string, highlightId: string}} */ (message).highlightId
          return new Highlighter(tab.id).delete(highlightId)
        }).then(() => {
          sendResponse(true)
        }).catch(() => {
          sendResponse(false)
        })
        break

      default:
        throw `Unhandled message: sender=${sender}, id=${message.id}`
    }

    if (!asynchronous) {
      sendResponse(response)
    }
    
    return asynchronous
  }
}

// static properties

// messages sent to the event page (from content script)
ChromeRuntimeHandler.MESSAGE = {
  DELETE_HIGHLIGHT: 'delete_highlight',
}
