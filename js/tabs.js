
// https://hackernoon.com/functional-javascript-resolving-promises-sequentially-7aac18c4431e
const promiseSerial = funcs =>
  funcs.reduce((promise, func) =>
    promise.then(result => func().then(Array.prototype.concat.bind(result))),
    Promise.resolve([])
  )

class Tabs {
  /**
   * Creates an instance of Tabs
   * 
   * @param {number} tabId - id of tab that all instance methods target 
   * @memberof Tabs
   */
  constructor(tabId) {
    this.tabId = tabId
  }

  /**
   * @typedef {Object} Tab
   */

  /**
   * @typedef {Object} QueryInfo
   * @prop {boolean} [active] - Whether the tabs are active in their windows.
   * @prop {string|string[]} [url] - Match tabs against one or more URL patterns. Note that fragment identifiers are not matched.
   * @prop {string} [status] - Whether the tabs have completed loading. ('loading' or 'complete')
   * @prop {boolean} [currentWindow] - Whether the tabs are in the current window.
   */
  
   /**
   * Gets all tabs that have the specified properties, or all tabs if no properties are specified.
   * 
   * @static
   * @param {QueryInfo} [info] - chrome.tabs query info object
   * @returns {Promise<Tab[]>} array of tabs
   * @memberof Tabs
   */
  static query(info) {
    return new Promise(resolve => {
      chrome.tabs.query(info, tabs => resolve(tabs))
    })
  }

  /**
   * Get the tab that is active in the current window
   * 
   * @static
   * @returns {Promise<Tab>} tab, or null
   * @memberof Tabs
   */
  static queryActiveTab() {
    return Tabs.query({
      active: true,
      currentWindow: true 
    }).then(tabs => {
      return tabs.length > 0 ? tabs[0] : null
    })
  }

  //

  /**
   * @typedef {Object} ExecuteScriptDetails
   * @prop {boolean} [allFrames=false] - If true implies that the JavaScript or CSS should be injected into all frames of current page
   */

  /**
   * Injects JavaScript code into a page.
   * 
   * @param {string|string[]} files - JavaScript or CSS file to inject. If array, files are injected sequentially
   * @param {ExecuteScriptDetails} [details] - injection details
   * @returns {Promise}
   * @memberof Tabs
   */
  executeScript(files, details = {}) {
    if (Array.isArray(files)) {
      // map to array of promise-returning functions
      const funcs = files.map(f => {
        return () => this.executeScript(f, details)
      })

      // execute each script in series
      return promiseSerial(funcs)
    }

    return new Promise((resolve, reject) => {
      chrome.tabs.executeScript(
        this.tabId,
        Object.assign({file: files}, details), 
        result => { 
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }

          resolve(result)
        }
      )
    })
  }

  /**
   * Execute the standard set of scripts on the tab's content page
   * 
   * @param {ExecuteScriptDetails} [details={}] - injection details
   * @returns 
   * @memberof Tabs
   */
  executeDefaultScript(details = {}) {
    return this.executeScript(Tabs.DEFAULT_SCRIPTS, details)
  }

  //

  /**
   * TODO
   * @typedef {Object} Message
   * @prop {string} id - predefined type of message
   */

  /**
   * Send a message synchronously to a tab
   * Executes default scripts if response implies there was no handler
   * 
   * @param {Object} message - message sent to tab content script
   * @param {Object} [options] [{ executeDefaultScript = false }={}] 
   * @returns {Promise<*>} message response
   * @memberof Tabs
   */
  sendMessage(message, { executeDefaultScript = false } = {}) {
    return (executeDefaultScript ? this.executeDefaultScript() : Promise.resolve()).then(() => {
      return this.sendMessageInternal(message)
    }).catch(e => {
      if (!executeDefaultScript) {
        return this.sendMessage(message, { executeDefaultScript: true })
      }
      
      throw (e)
    })
  }
  
  /**
   * Companion method for `sendMessage()`
   * 
   * @private
   * @param {Object} message - object of any shape
   * @returns {Promise<*>} resolves if no last error defined and the result is defined (handled)
   * @memberof Tabs
   */
  sendMessageInternal(message) {
    return new Promise((resolve, reject) => {
      // send message to page
      chrome.tabs.sendMessage(this.tabId, message, response => {
        // explicit error
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }

        // all messages must send back a defined result (even if null)
        if (typeof response !== 'undefined') {
          resolve(response)
          return
        }

        // not handling message is a rejection case
        reject(new Error("Undefined response"))
      })
    })
  }

  //

  /**
   * @typedef {Object} XRange 
   * @prop {boolean} [collapsed]
   * @prop {string} startContainerPath - xPath for node within which the Range starts.
   * @prop {number} startOffset - number representing where in the startContainer the Range starts.
   * @prop {string} endContainerPath - xPath for node within which the Range end.
   * @prop {number} endOffset - number representing where in the endContainer the Range ends.
   */

  /**
   * Create a highlight in the DOM
   * 
   * @param {XRange} range - range object with xPath selection range
   * @param {string} className - name of class defining style of highlight
   * @param {string} highlightId - unique id for highlight, usually same as 'create' document's Id
   * @returns {Promise<boolean>} true if highlight span could be created 
   * @memberof Tabs
   */
  createHighlight(range, className, highlightId) {
    return this.sendMessage({
      id: Tabs.MESSAGE_ID.CREATE_HIGHLIGHT,
      range: range,
      highlightId: highlightId,
      className: className
    })
  }

  /**
   * Update a highlight's className in the DOM
   * 
   * @param {string} highlightId - unique id for highlight, usually same as 'create' document's Id
   * @param {string} className - name of class defining style of highlight
   * @returns {Promise<boolean>} true if update succeeded
   * @memberof Tabs
   */
  updateHighlight(highlightId, className) {
    return this.sendMessage({
      id: Tabs.MESSAGE_ID.UPDATE_HIGHLIGHT,
      highlightId: highlightId,
      className: className
    })
  }

  /**
   * Delete highlight in DOM
   * 
   * @param {string} highlightId - unique id for highlight, usually same as 'create' document's Id
   * @returns {Promise<boolean>} true if delete succeeded
   * @memberof Tabs
   */
  deleteHighlight(highlightId) {
    return this.sendMessage({
      id: Tabs.MESSAGE_ID.DELETE_HIGHLIGHT,
      highlightId: highlightId,
    })
  }

  //

  /**
   * Get a range object representing the current selection of the content's document
   * 
   * @returns {Promise<XRange>} - XRange object (even if no selection)
   * @memberof Tabs
   */
  getSelectionRange() {
    return this.sendMessage({
      id: Tabs.MESSAGE_ID.GET_SELECTION_RANGE
    })
  }

  /**
   * Get the text of a range in the content's document
   * 
   * @param {XRange} xrange - range to query
   * @returns {Promise<string|Null>} text of selection, or null if not found
   * @memberof Tabs
   */
  getRangeText(xrange) {
    return this.sendMessage({
      id: Tabs.MESSAGE_ID.GET_RANGE_TEXT,
      xrange: xrange,
    })
  }

  /**
   * Select the text of a highlight in the content's document
   * 
   * @param {string} [highlightId] - #id of highlight in DOM. If undefined, clear document's selection
   * @returns {Promise<XRange|Null>} xrange of selected highlight, or null if no highlight was supplied
   * @memberof Tabs
   */
  selectHighlight(highlightId) {
    const message = { id: Tabs.MESSAGE_ID.SELECT_HIGHLIGHT }

    if (highlightId) {
      message.highlightId = highlightId
    }

    return this.sendMessage(message)
  }

  // /** 
  //  * @typedef {Object} Document
  //  * @prop {string} verb - create or delete 

  //  * @prop {string} _id - id of document
  //  * @prop {string} _rev - revision of document
  //  * 
  //  * @prop {string} match - string formed by processing the associated page's url
  //  * @prop {number} date - date of document put/post, as ns since 1970
  //  * @prop {Object} [range] - creation document range with xPath 
  //  * @prop {string} [className] - className identifying style of create highlight. Used in DOM
  //  * @prop {string} [text] - text within create highlight
  //  * @prop {string} [title] - title of page highlight was created from
  //  * @prop {string} [correspondingDocumentId] - id of 'create' doc associated with this `delete` doc
  //  */

  /**
   * 
   * 
   * @param {Object[]} documents - array of documents to play back serially 
   * @param {Function} [onPlaybackError] - method called after each document that doesn't play back successfully
   * @returns {Promise<number>} sum of create/delete documents, where create is +1, delete is -1. If zero, no highlights. Rejects if any create/delete method rejects.
   * @memberof Tabs
   */
  playbackDocuments(documents, onPlaybackError) {
    let sum = 0

    // map to array of functions that return a promise
    const funcs = documents.map(doc => {
      return () => {
        // main promise
        const promise = (() => {
          switch (doc[DB.DOCUMENT.NAME.VERB]) {
            case DB.DOCUMENT.VERB.CREATE:
              sum++
    
              // each highlight's unique id (#id) is the document's _id
              return this.createHighlight(
                doc[DB.DOCUMENT.NAME.RANGE],
                doc[DB.DOCUMENT.NAME.CLASS_NAME],
                doc._id
              )

            case DB.DOCUMENT.VERB.DELETE:
              sum--

              return this.deleteHighlight(doc[DB.DOCUMENT.NAME.CORRESPONDING_DOC_ID])

            default:
              console.error('unknown verb')
              return Promise.resolve(false)
          }
        })()

        // wrapper (note that thrown errors are unhandled)
        return promise.then(ok => {
          if (!ok && onPlaybackError) {
            onPlaybackError(doc)
          }
        })
      }
    })

    // return sum
    return promiseSerial(funcs).then(() => sum)
  }
}

// static properties

Tabs.DEFAULT_SCRIPTS = [
  "js/chrome_storage.js", "js/chrome_highlight_storage.js",
  
  "js/string_utils.js",
  "js/stylesheet.js",
  "js/content_script/range_utils.js",
  "js/content_script/highlighter.js",
  "js/content_script/content_script.js"
]

Tabs.MESSAGE_ID = {
  CREATE_HIGHLIGHT: 'create_highlight',
  UPDATE_HIGHLIGHT: 'update_highlight',
  DELETE_HIGHLIGHT: 'delete_highlight',
  GET_SELECTION_RANGE: 'get_selection_range',
  GET_RANGE_TEXT: 'get_range_text',
  SELECT_HIGHLIGHT: 'select_highlight'
}