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
 * Manager class for chrome.tabs related things
 * 
 * @class ChromeTabs
 */
class ChromeTabs {
  /**
   * Creates an instance of Tabs
   * 
   * @param {number} tabId - id of tab that all instance methods target 
   * @memberof ChromeTabs
   */
  constructor(tabId) {
    /**
     * id of tab that all instance methods target 
     * @type {number}
     * @public
     */
    this.tabId = tabId
  }

  /**
   * @typedef {Object} Tab
   * @prop {number} id - tab id
   * @prop {string} url - tab url
   * @prop {string} title - tab title
   * @memberof ChromeTabs
   */

  /**
   * @typedef {Object} QueryInfo
   * @prop {boolean} [active] - Whether the tabs are active in their windows.
   * @prop {string|string[]} [url] - Match tabs against one or more URL patterns. Note that fragment identifiers are not matched.
   * @prop {string} [status] - Whether the tabs have completed loading. ('loading' or 'complete')
   * @prop {boolean} [currentWindow] - Whether the tabs are in the current window.
   * @memberof ChromeTabs
   */
  
   /**
   * Gets all tabs that have the specified properties, or all tabs if no properties are specified.
   * 
   * @static
   * @param {QueryInfo} [info] - chrome.tabs query info object
   * @returns {Promise<Tab[]>} array of tabs
   * @memberof ChromeTabs
   */
  static query(info) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query(info, tabs => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }

        resolve(tabs)
      })
    })
  }

  /**
   * Get the tab that is active in the current window
   * 
   * @static
   * @returns {Promise<Tab>} tab, or null
   * @memberof ChromeTabs
   */
  static queryActiveTab() {
    return ChromeTabs.query({
      active: true,
      currentWindow: true 
    }).then(tabs => {
      return tabs.length > 0 ? tabs[0] : null
    })
  }

  //

  /**
   * Retrieves details about the specified tab
   * 
   * @returns {Promise<Tab>} tab, or null
   * @memberof ChromeTabs
   */
  get() {
    return new Promise((resolve, reject) => {
      chrome.tabs.get(this.tabId, tab => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }

        resolve(tab)
      })
    })
  }

  /**
   * Creates a new tab
   * 
   * @typedef {Object} CreateProperties
   * @prop {string} [url]
   * @prop {integer} [openerTabId]
   * 
   * @static
   * @param {CreateProperties} properties 
   * @returns {Promise<Tab>}
   * @memberof ChromeTabs
   */
  static create(properties) {
    return new Promise((resolve, reject) => {
      chrome.tabs.create(properties, tab => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }

        resolve(tab)
      })
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
   * @memberof ChromeTabs
   */
  executeScript(files, details = {}) {
    if (Array.isArray(files)) {
      // map to array of promise-returning functions
      const pfuncs = files.map(f => {
        return () => this.executeScript(f, details)
      })

      // execute each script in series
      return PromiseUtils.serial(pfuncs)
    }

    return new Promise((resolve, reject) => {
      // console.log(`Executing scripts: ${files}`)

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
   * @memberof ChromeTabs
   */
  executeDefaultScript(details = {}) {
    return this.executeScript(ChromeTabs.DEFAULT_SCRIPTS, details)
  }

  //

  /**
   * @typedef {Object} MessageOptions
   * @prop {boolean} [ping] - send ping before each message
   * @memberof ChromeTabs
   */

  /**
   * Send message to content script
   *
   * @private
   * @param {string} id - id of message to send
   * @param {Object} [message] - message to send
   * @param {MessageOptions} [options={ ping = true }] 
   * @returns 
   * @memberof ChromeTabs
   */
  sendMessage(id, message = {}, { ping = true } = {}) {
    return (ping ? 
      this._sendMessage({ id: ChromeTabs.MESSAGE_ID.PING}) :
      Promise.resolve(true)
    ).then(pong => {
      if (!pong) {
        return this.executeDefaultScript()
      }
    }).then(() => {
      // send message copy with the id set on it
      return this._sendMessage(Object.assign({ id: id }, message))
    })
  }

  /**
   * Companion method for `sendMessage()`
   * 
   * @private
   * @param {Object} message - object of any shape
   * @returns {Promise<*>} resolves if no last error defined and the result is defined (handled)
   * @memberof ChromeTabs
   */
  _sendMessage(message) {
    return new Promise((resolve, reject) => {
      // send message to page
      chrome.tabs.sendMessage(this.tabId, message, response => {
        // explicit error
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }

        resolve(response)
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
   * @param {number} [version] - 'version' of document used to create tab. If < 4, assumes compat behaviour
   * @param {MessageOptions} [options] - message options
   * @returns {Promise<boolean>} true if highlight span could be created 
   * @memberof ChromeTabs
   */
  createHighlight(range, className, highlightId, version, options) {
    return this.sendMessage(ChromeTabs.MESSAGE_ID.CREATE_HIGHLIGHT, {
      range: range,
      highlightId: highlightId,
      className: className,
      version: version,
    }, options)
  }

  /**
   * Update a highlight's className in the DOM
   * 
   * @param {string} highlightId - unique id for highlight, usually same as 'create' document's Id
   * @param {string} className - name of class defining style of highlight
   * @param {MessageOptions} [options] - message options
   * @returns {Promise<boolean>} true if update succeeded
   * @memberof ChromeTabs
   */
  updateHighlight(highlightId, className, options ) {
    return this.sendMessage(ChromeTabs.MESSAGE_ID.UPDATE_HIGHLIGHT, {
      highlightId: highlightId,
      className: className
    }, options)
  }

  /**
   * remove highlight in DOM
   * 
   * @param {string} highlightId - unique id for highlight, usually same as 'create' document's Id
   * @param {MessageOptions} [options] - message options
   * @returns {Promise<boolean>} true if delete succeeded
   * @memberof ChromeTabs
   */
  removeHighlight(highlightId, options) {
    return this.sendMessage(ChromeTabs.MESSAGE_ID.REMOVE_HIGHLIGHT, {
      highlightId: highlightId,
    }, options)
  }

  //

  /**
   * Get a range object representing the current selection of the content's document
   * 
   * @returns {Promise<XRange>} - XRange object (even if no selection)
   * @memberof ChromeTabs
   */
  getSelectionRange(options) {
    return this.sendMessage(ChromeTabs.MESSAGE_ID.GET_SELECTION_RANGE)
  }

  /**
   * Get the text of a range in the content's document
   * 
   * @param {XRange} range - range to query
   * @returns {Promise<string|Null>} text of selection, or null if not found
   * @memberof ChromeTabs
   */
  getRangeText(range) {
    return this.sendMessage(ChromeTabs.MESSAGE_ID.GET_RANGE_TEXT,{
      range: range,
    })
  }

  /**
   * Select the text of a highlight in the content's document
   * 
   * @param {string} [highlightId] - #id of highlight in DOM. If undefined, clear document's selection
   * @returns {Promise<XRange|Null>} xrange of selected highlight, or null if no highlight was supplied
   * @memberof ChromeTabs
   */
  selectHighlight(highlightId) {
    const message = {}

    if (highlightId) {
      message.highlightId = highlightId
    }

    return this.sendMessage(ChromeTabs.MESSAGE_ID.SELECT_HIGHLIGHT, message)
  }

  /**
   * Select a range of text in the document
   * 
   * @param {XRange} [range] - range to select. clear selection if undefined
   * @returns {Promise<XRange|Null>} xrange of selected highlight, or null if no highlight was supplied
   * @memberof ChromeTabs
   */
  selectRange(range) {
    const message = {}
    
    if (range) {
      message.range = range
    }
    
    return this.sendMessage(ChromeTabs.MESSAGE_ID.SELECT_RANGE, message)
  }

  /**
   * Query DOM whether a highlight exists
   * 
   * @param {string} highlightId - #id of highlight (aka 'create' doc _id)
   * @returns {Promise<boolean>} true if in DOM, else false
   * @memberof ChromeTabs
   */
  isHighlightInDOM(highlightId) {
    return this.sendMessage(ChromeTabs.MESSAGE_ID.IS_HIGHLIGHT_IN_DOM, {
      highlightId: highlightId,
    })
  }

  /**
   * Scroll document to a highlight
   * 
   * @param {string} highlightId - #id of highlight (aka 'create' doc _id)
   * @returns {Promise<boolean>} true if element found, else false
   * @memberof ChromeTabs
   */
  scrollToHighlight(highlightId) {
    return this.sendMessage(ChromeTabs.MESSAGE_ID.SCROLL_TO_HIGHLIGHT, {
        highlightId: highlightId
    });
  }

  /**
   * Get a value of an attribute in the document's DOM
   * 
   * @param {string} xpathExpression - xPath for element to evaluate
   * @param {string} attributeName - name of attribute
   * @returns {Promise<string|Null>} value of attribute, or null if no element/attribute
   * @memberof ChromeTabs
   */
  getNodeAttributeValue(xpathExpression, attributeName) {
    return this.sendMessage(ChromeTabs.MESSAGE_ID.GET_NODE_ATTRIBUTE_VALUE, {
      xpathExpression: xpathExpression,
      attributeName: attributeName,
    })
  }


  /**
   * @typedef {Object} Offset
   * @prop {number} top 
   * @prop {number} left 
   */

  /**
   * Get the bounding client rect of a highlight in the document
   * 
   * @param {string} highlightId - #id of highlight (aka 'create' doc _id)
   * @returns {Promise<Offset|Null>}
   * @memberof ChromeTabs
   */
  getHighlightOffset(highlightId) {
    return this.sendMessage(ChromeTabs.MESSAGE_ID.GET_HIGHLIGHT_OFFSET, {
      highlightId: highlightId,
    })
  }

  /**
   * Get the #id of the highlight that is currently being hovered over
   * 
   * @returns {Promise<String>} id or empty string if none
   * @memberof ChromeTabs
   */
  getHoveredHighlightID() {
    return this.sendMessage(ChromeTabs.MESSAGE_ID.GET_HOVERED_HIGHLIGHT_ID)
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
   * @memberof ChromeTabs
   */
  playbackDocuments(documents, onPlaybackError) {
    let sum = 0

    // map to array of functions that return a promise
    return PromiseUtils.serial(documents.map(doc => {
      return () => {
        // main promise
        const promise = (() => {
          switch (doc[DB.DOCUMENT.NAME.VERB]) {
            case DB.DOCUMENT.VERB.CREATE:
              sum++
    
              // compat (tag name, workarounds) depends on whether it was created with ssh v4+
              // If not present, assume v3
              const version = doc[DB.DOCUMENT.NAME.VERSION] || 3;

              // each highlight's unique id (#id) is the document's _id
              return this.createHighlight(
                doc[DB.DOCUMENT.NAME.RANGE],
                doc[DB.DOCUMENT.NAME.CLASS_NAME],
                doc._id,
                version)

            case DB.DOCUMENT.VERB.DELETE:
              sum--

              return this.removeHighlight(doc[DB.DOCUMENT.NAME.CORRESPONDING_DOC_ID])

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
    })).then(() => sum)
  }

  /**
	 * Get a sort comparison function, which takes a document and returns a promise that resolves to a comparable value
   * 
	 * @param {string} sortby - type of sort
	 * @return {Function<Promise<*>>} Function that returns a promise that gets a comparable value
	 */
	getComparisonFunction(sortby) {
		switch(sortby) {
        case "time":
            // simply order by creation time (which it probably already does)
            return doc => Promise.resolve(doc.date)
			
        case "location":
            return doc => {
                // resolve to top of bounding client rect
                return this.isHighlightInDOM(doc._id).then(isInDOM => {
                    return isInDOM ?
                      this.getHighlightOffset(doc._id) :
                      Promise.reject(new Error())
                }).then(offset => offset.top)
            }

        case "style":
            // items are ordered by the index of its associated style. Build a map for faster lookup
            let map = new Map()

            return doc => {
                if (map.size === 0) {
                    return new ChromeHighlightStorage().getAll().then(items => {
                        // key is definition className, value is the index that occupies
                        items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS].forEach(({className}, index) => {
                            map.set(className, index)
                        })
                    }).then(() => map.get(doc.className))
                }

                return Promise.resolve(map.get(doc.className))
            }

		default:
			throw "Unknown type";
		}
  }
  
  /**
   * Get an overview of the tab's highlights as formatted text 
   * 
	 * @param {string} format one of [markdown]
	 * @param {Function} [comparator] function that returns a promise that resolves to a comparible value
   * @param {Boolean} [invert] invert the document order
	 * @returns {Promise<string>} overview correctly formatted as a string
   * @memberof ChromeTabs
   */
  getFormattedOverviewText(format, comparator,/* filterPredicate,*/ invert) {
    let tab
    const titles = new Map()

    return this.get().then(t => {
      tab = t

      return new ChromeHighlightStorage().getAll()
        .then(items => items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS])
    }).then(definitions => {
      // map the highlight class name to its display name, for later usage
      for (const d of definitions) {
          titles.set(d.className, d.title)
      }

      // get documents associated with the tab's url
      // get only the create docs that don't have matched delete doc
      return new DB().getMatchingDocuments(DB.formatMatch(tab.url), { excludeDeletedDocs: true })
    }).then(docs => {
      // filter
      // if (filterPredicate) {
      //   docs = docs.filter(filterPredicate)
      // }
      
      // sort - main promise (default to native order)
      return (comparator && DB.sortDocuments(docs, comparator)) || Promise.resolve(docs)
    }).then(docs => {
      if (invert) {
        docs.reverse()
      }

      switch (format) {
        case ChromeTabs.OVERVIEW_FORMAT.MARKDOWN:
        case ChromeTabs.OVERVIEW_FORMAT.MARKDOWN_NO_FOOTER:
            let markdown = `# [${tab.title}](${tab.url})`
            let currentClassName

            // iterate each highlight
            for (const {className, text} of docs) {
                // only add a new heading when the class of the header changes
                if (className != currentClassName) {
                    markdown += `\n\n## ${titles.get(className)}`

                    currentClassName = className
                } else {
                    // only seperate subsequent list items
                    markdown += "\n"
                }

                // each highlight is an unordered list item
                markdown += `\n* ${text}`
            }

            // footer
            if (format !== ChromeTabs.OVERVIEW_FORMAT.MARKDOWN_NO_FOOTER) {
                markdown += `\n\n---\n${chrome.i18n.getMessage("overview_footer", [
                  chrome.i18n.getMessage("extension_name"),
                  chrome.i18n.getMessage("extension_webstore_url"),
                  chrome.i18n.getMessage("copyright_year"),
                  chrome.i18n.getMessage("extension_author"),
                  chrome.i18n.getMessage("extension_author_url")
              ])}`
            }

            return Promise.resolve(markdown)

        default:
            return Promise.reject(new Error('unknown format'))
      }
    })
  }
}

// static properties

ChromeTabs.OVERVIEW_FORMAT = {
  MARKDOWN: 'markdown',
  MARKDOWN_NO_FOOTER: 'markdown-no-footer',
}

ChromeTabs.DEFAULT_SCRIPTS = [
  "js/shared/chrome_tabs.js", // just for static properties

  "js/shared/chrome_storage.js", 
  "js/shared/chrome_highlight_storage.js",
  
  "js/shared/utils.js",
  "js/shared/style_sheet_manager.js",

  "js/content_script/marker.js",
  "js/content_script/dom_events_handler.js",
  "js/content_script/chrome_storage_handler.js",
  "js/content_script/chrome_runtime_handler.js",
  "js/content_script/main.js",
]

ChromeTabs.MESSAGE_ID = {
  PING: 'ping',
  CREATE_HIGHLIGHT: 'create_highlight',
  UPDATE_HIGHLIGHT: 'update_highlight',
  REMOVE_HIGHLIGHT: 'remove_highlight',
  GET_SELECTION_RANGE: 'get_selection_range',
  GET_RANGE_TEXT: 'get_range_text',
  SELECT_HIGHLIGHT: 'select_highlight',
  SELECT_RANGE: 'select_range',
  IS_HIGHLIGHT_IN_DOM: 'is_highlight_in_dom',
  SCROLL_TO_HIGHLIGHT: 'scroll_to_highlight',
  GET_NODE_ATTRIBUTE_VALUE: 'get_node_attribute_value',
  GET_HIGHLIGHT_OFFSET: 'get_highlight_offset',
  GET_HOVERED_HIGHLIGHT_ID: 'get_hovered_highlight_id'
}