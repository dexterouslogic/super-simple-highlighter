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

var _tabs = {
	/** 
	 * Promise version of chrome's active tab getter
     * 
     * @returns {Promise<chrome.Tab>} promising resolving to active tab object
	 */
    getActiveTab: () => {
        return _tabs.query({
            active: true,
            currentWindow: true 
        }).then(tabs => {
            if (!tabs || tabs.length === 0) {
                return Promise.reject(new Error("No active tab"))
            }

            return tabs[0]
        })
    },
    
    /**
     * Promisifed version of chrome.tabs.query
     * @param {Object} queryInfo - see https://developer.chrome.com/extensions/tabs#method-query 
     * @returns {Promise<Array<Tab>>} - array of chrome tabs
     */
    query: (queryInfo) => {
        return new Promise(resolve => {
            chrome.tabs.query(queryInfo, tabs => resolve(tabs))
        })
    },
	
    /**
     * call {@link chrome.tabs.executeScript()} serially
     * @param {number} tabId
     * @param {Array} injectDetailsArray
     * @param {function} [finalCallback] last callback to be called
     * @private
     */
    executeScripts: function (tabId, injectDetailsArray, finalCallback) {
        "use strict";
        function createCallback(tabId, injectDetails, innerCallback) {
            return function () {
                chrome.tabs.executeScript(tabId, injectDetails, innerCallback);
            };
        }

        var callback = finalCallback, i;
        for (i = injectDetailsArray.length - 1; i >= 0; --i) {
            callback = createCallback(tabId, injectDetailsArray[i], callback);
        }

        if (callback) {
            callback();   // execute outermost function
        }
    },

    /**
     * Inject all standard js and css
     * @param {number} tabId
     * @param {bool} [allFrames] if true inject into all frames. if false, just the top frame (default false)
     * @param {function} [callback]
     */
	executeAllScripts_Promise: function (tabId, allFrames) {
        "use strict";
        if (allFrames ===  undefined || allFrames === null) {
            allFrames = false;
        }

        var injectDetailsArray = [];

        // build the array supplied to executeScripts()
        [
            "js/main/chrome_storage.js", 
            "js/main/chrome_highlight_storage.js",
            
            "js/utils.js",
            "js/stylesheet.js",
            
            "js/content_script/range_utils.js",
            "js/content_script/highlighter.js",
            "js/content_script/content_script.js"
        ].forEach(function (file) {
                injectDetailsArray.push({
                file: file,
                allFrames: allFrames
            });
        });

        // inject scripts serially
		return new Promise(function (resolve, reject) {
	        _tabs.executeScripts(tabId, injectDetailsArray, function () {
	        	resolve();
	        });
		});
	},

    sendMessage_Promise: function (tabId, message) {
        "use strict";
		return new Promise((resolve, reject) => {
			chrome.tabs.sendMessage(tabId, message, function (response) {
				// it is possible that the script hasn't yet been injected,
                // so check the response for a undefined param
                if (typeof response === 'undefined') {
                    // probably scripts not yet executed
                    reject();
                    return
                }

                // ok - pass to original handler
                resolve(response);	
			})
		}).catch(function () {
            console.log("sendMessage() response undefined. Executing scripts, then retrying...");
			
            // inject scripts into top level frames, then send message again
            return _tabs.executeAllScripts_Promise(tabId, false).then(() => new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tabId, message, (response) => {
                    if (typeof response === 'undefined' && chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError)
                        return
                    }  
                    
                    // response may still be undefined, but legal
                    resolve(response);
                });
			}))
		})
    },

    /**
     * Create a highlight in DOM
     * @param tabId
     * @param range
     * @param {string} className
     * @param {string} documentId
     * @param [responseCallback]
     */
    sendCreateHighlightMessage_Promise: function (
		tabId, range, className, documentId) {
        "use strict";
		return _tabs.sendMessage_Promise(tabId, {
            id: "create_highlight",
            range: range,
            highlightId: documentId,
            className: className
        });
    },

    /**
     * Update the highlight in the DOM by changing the class name of it (and all the spans of its list)
     * @param tabId
     * @param documentId document id which is used as the id for the first item in list
     * @param className new class name
     * @param [responseCallback] function(is_updated)
     */
	sendUpdateHighlightMessage_Promise: function (tabId, documentId, className) {
        "use strict";
        return _tabs.sendMessage_Promise(tabId, {
            id: "update_highlight",
            highlightId: documentId,
            className: className
        });
    },

    /**
     * Delete the highlight in DOM
     * @param tabId
     * @param documentId
     * @param [responseCallback] function(is_deleted)
     */
    sendDeleteHighlightMessage_Promise: function (tabId, documentId) {
        "use strict";
        return _tabs.sendMessage_Promise(tabId, {
            id: "delete_highlight",
            highlightId: documentId
        });
    },
	

    /**
     * Get the currently selected text range
     * @param {number} tabId id of tab to target message towards
     * @return {Promise<string>} xrange of selection
     */
    sendGetSelectionRangeMessage_Promise: function (tabId) {
        "use strict";
        return _tabs.sendMessage_Promise(tabId, {
            id: "get_selection_range"
        });
    },

    /**
     * Get the text defined by a specific range
     * @param {number} tabId id of tab to target message towards
     * @param {Object} xrange range of text in document to get
     * @return {Promise<string>} text of selection, or null if not found
     */
    sendGetRangeTextMessage_Promise: function (tabId, xrange) {
        return _tabs.sendMessage_Promise(tabId, {
            id: "get_range_text",
            xrange: xrange
        });
    },

    /**
     * Ask the content script to select text span(s) associated with a highlight
     * @param {number} tabId
     * @param {string} [documentId] if undefined, remove selection
     * @param {function} [responseCallback] function(xpathRange)
     */	
    sendSelectHighlightTextMessage_Promise: function (tabId, documentId) {
        "use strict";
        var message = {
            id: "select_highlight"
        };

        // optional id of highlight. if null/undefined, removes selection
        if (documentId) {
            message.highlightId = documentId;
        }

        return _tabs.sendMessage_Promise(tabId, message);
    },

    /**
     * Ask the content script to select a range of text
     * @param {number} tabId
     * @param {Object} [xrange] if undefined, remove selection
     * @param {function} [responseCallback] function(xpathRange)
     */	
    sendSelectRangeMessage_Promise: function (tabId, xrange) {
        "use strict";
        var message = {
            id: "select_range"
        };

        if (xrange) {
            message.xrange = xrange;
        }

        return _tabs.sendMessage_Promise(tabId, message);
    },

    /**
     * Ask the DOM whether a highlight exists with this ID
     * @param {number} tabId
     * @param {string} documentId 'create' document id
     */
    sendIsHighlightInDOMMessage_Promise: function (tabId, documentId) {
        "use strict";
        return _tabs.sendMessage_Promise(tabId, {
            id: "is_highlight_in_dom",
            highlightId: documentId
        });
    },

    /**
     * Animate the document.body scrollTop property to the top of the specified element
     * @param {number} tabId
     * @param {string} documentId
     * @param {function} [responseCallback]
     */
    sendScrollToMessage_Promise: function (tabId, documentId) {
        "use strict";
        return _tabs.sendMessage_Promise(tabId, {
            id: "scroll_to",
            fragment: documentId
        });
    },

    /**
     * Get the nodeValue property of an attribute of the document element (tag name HTML)
     *
     * @param {number} tabId The tab identifier
     * @param {string} attributeName The attribute name
     * @return {object} { value of attribute node }
     */
    sendGetDocumentElementAttributeNodeValue_Promise: function (tabId, attributeName) {
        "use strict";

        return _tabs.sendMessage_Promise(tabId, {
            id: "get_document_element_attribute_node_value",
            attribute_name: attributeName
        });
    },
	
	/**
	 * Get the bounding client rect for the span covering the highlight.
	 * If the highlight is split, it references only the first component,
	 * so you shouldn't rely on right or bottom properties being correct
     * @param {number} tabId
     * @param {string} documentId 'create' document id
	 */	
	getHighlightBoundingClientRect: function (tabId, documentId) {
        "use strict";
		return _tabs.sendMessage_Promise(tabId, {
			id: "get_bounding_client_rect",
			highlightId: documentId
		});
	},

    /**
     * Get the document id of the highlight that is currently being hovered over
     * @param {number} tabId
     */
    getHoveredHighlightID: function (tabId) {
        "use strict";

        return _tabs.sendMessage_Promise(tabId, {
            id: "get_hovered_highlight_id"
        });
    },

    /**
     * 'Play' an array of document's 'create' and 'delete' messages into the DOM
     * @param {number} tabId
     * @param {Array} docs
     * @param {function} [errorCallback] function(doc): only called (multiple times) when the DOM reports
     *  it can't create highlight for this doc
     * @return {Promise<number>} sum of create/delete documents, where create is +1, delete is -1. If zero, no highlights!
     */
    replayDocuments_Promise: function (tabId, docs, errorCallback) {
        // final callback after all scripts injected
        // send each transaction to the content script as a message
        "use strict";
        var sum = 0;

		return Promise.all(docs.map(function (doc) {
            switch (doc.verb) {
            case "create":
                sum++;

                // re-use document id as span element's id
                return _tabs.sendCreateHighlightMessage_Promise(tabId, doc.range, doc.className, doc._id)
					.then(function (response) {
	                    if (response !== true && errorCallback) {
	                        errorCallback(doc);
	                    }
               	 	});

            case "delete":
                sum--;

                return _tabs.sendDeleteHighlightMessage_Promise(tabId, doc.correspondingDocumentId)
					.then(function (response) {
	                    if (response !== true && errorCallback) {
	                        errorCallback(doc);
	                    }
	                });

            default:
                console.log("unhandled verb: " + doc.verb);
                return Promise.resolve();
            }
		})).then(function () {
			return sum;
		});
    },


	/**
	 * Get a sort comparison function, which takes a document and returns a
	 * promise that resolves to a comparable value
     * 
	 * @param {number} tabId tab id upon which our resolution depends
	 * @return {Function} Function that returns a promise that gets a comparable value
	 */
	getComparisonFunction: function (tabId, sortby) {
		switch(sortby) {
        case "time":
            // simply order by creation time (which it probably already does)
            return doc => Promise.resolve(doc.date)
			
        case "location":
            return doc => {
                // resolve to top of bounding client rect
                return _tabs.sendIsHighlightInDOMMessage_Promise(tabId, doc._id).then(function (inDOM) {
                    return inDOM ?
                        _tabs.getHighlightBoundingClientRect(tabId, doc._id) :
                        Promise.reject(new Error())
                }).then(rect => rect.top)
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
};