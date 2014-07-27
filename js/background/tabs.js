var _tabs = {
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
     * @private
     */
    executeAllScripts: function (tabId, allFrames, callback) {
        "use strict";
        if (allFrames ===  undefined || allFrames === null) {
            allFrames = false;
        }

        var injectDetailsArray = [];

        // build the array supplied to executeScripts()
        [
            "static/js/jquery-2.1.1.min.js",
            "static/js/jquery.stylesheet.min.js",
            "js/storage.js",
            "js/string_utils.js",
            "js/stylesheet.js",
            "js/content_script/xpath.js",
            "js/content_script/highlighter.js",
            "js/content_script/content_script.js"
        ].forEach(function (file) {
                injectDetailsArray.push({
                file: file,
                allFrames: allFrames
            });
        });

        // inject scripts serially
        _tabs.executeScripts(tabId, injectDetailsArray, callback);
    },

    /**
     * SendMessage helper which, on receiving an undefined response, injects all scripts and tries again
     * @param tabId
     * @param message
     * @param responseCallback
     * @private
     */
    sendMessage: function (tabId, message, responseCallback) {
        "use strict";
        chrome.tabs.sendMessage(tabId, message, function (response) {
            // it is possible that the script hasn't yet been injected, so check the response for a undefined param
            if (response === undefined) {
                console.log("sendMessage() response undefined. Executing scripts, then retrying...");

                // inject scripts into top level frames, then send message again
                _tabs.executeAllScripts(tabId, false, function () {
                    // send again
                    chrome.tabs.sendMessage(tabId, message, responseCallback);
                });
            }

            if (responseCallback) {
                // pass to original handler
                responseCallback(response);
            }
        });
    },

    /**
     * Create a highlight in DOM
     * @param tabId
     * @param range
     * @param {string} className
     * @param {string} documentId
     * @param [responseCallback]
     */
    sendCreateHighlightMessage: function (tabId,
                                          range, className, documentId,
                                          responseCallback) {
        "use strict";
        _tabs.sendMessage(tabId, {
            id: "create_highlight",
            range: range,
            highlightId: documentId,
            className: className
        }, responseCallback);
    },

    /**
     * Update the highlight in the DOM by changing the class name of it (and all the spans of its list)
     * @param tabId
     * @param documentId document id which is used as the id for the first item in list
     * @param className new class name
     * @param [responseCallback] function(is_updated)
     */
    sendUpdateHighlightMessage: function (tabId, documentId, className, responseCallback) {
        "use strict";
        _tabs.sendMessage(tabId, {
            id: "update_highlight",
            highlightId: documentId,
            className: className
        }, responseCallback);
    },

    /**
     * Delete the highlight in DOM
     * @param tabId
     * @param documentId
     * @param [responseCallback] function(is_deleted)
     */
    sendDeleteHighlightMessage: function (tabId, documentId, responseCallback) {
        "use strict";
        _tabs.sendMessage(tabId, {
            id: "delete_highlight",
            highlightId: documentId
        }, responseCallback);
    },

    /**
     * Get the selected text range, as an xpath range object
     * @param {number} tabId
     * @param [responseCallback]
     */
    sendGetSelectionRangeMessage: function (tabId, responseCallback) {
        "use strict";
        _tabs.sendMessage(tabId, {
            id: "get_selection_range"
        }, responseCallback);
    },

    /**
     * Get the text defined by a specific range
     * @param {number} tabId
     * @param {object} xpathRange
     * @param {function} [responseCallback] function(text)
     */
    sendGetRangeTextMessage: function (tabId, xpathRange, responseCallback) {
        "use strict";
        _tabs.sendMessage(tabId, {
            id: "get_range_text",
            range: xpathRange
        }, responseCallback);
    },

    /**
     * Ask the content script to select text span(s) associated with a highlight
     * @param {number} tabId
     * @param {string} documentId
     * @param {function} [responseCallback] function(xpathRange)
     */
    sendSelectHighlightTextMessage: function (tabId, documentId, responseCallback) {
        "use strict";
        _tabs.sendMessage(tabId, {
            id: "select_highlight",
            highlightId: documentId
        }, responseCallback);
    },

    /**
     * Ask the DOM whether a highlight exists with this ID
     * @param {number} tabId
     * @param {string} documentId 'create' document id
     * @param {function} [responseCallback] function(boolean)
     */
    sendIsHighlightInDOMMessage: function (tabId, documentId, responseCallback) {
        "use strict";
        _tabs.sendMessage(tabId, {
            id: "is_highlight_in_dom",
            highlightId: documentId
        }, responseCallback);
    },

    /**
     * Animate the document.body scrollTop property to the top of the specified element
     * @param {number} tabId
     * @param {string} documentId
     * @param {function} [responseCallback]
     */
    sendScrollToMessage: function (tabId, documentId, responseCallback) {
        "use strict";
        _tabs.sendMessage(tabId, {
            id: "scroll_to",
            fragment: documentId
        }, responseCallback);
    },

    /**
     * 'Play' an array of document's 'create' and 'delete' messages into the DOM
     * @param {number} tabId
     * @param {Array} docs
     * @param {function} [errorCallback] function(doc): only called (multiple times) when the DOM reports
     *  it can't create highlight for this doc
     * @return {number} sum of create/delete documents, where create is +1, delete is -1. If zero, no highlights!
     */
    replayDocuments: function (tabId, docs, errorCallback) {
        // final callback after all scripts injected
        // send each transaction to the content script as a message
        "use strict";
        var sum = 0;

        docs.forEach(function (doc) {
            switch (doc.verb) {
            case "create":
                sum++;

                // re-use document id as span element's id
                _tabs.sendCreateHighlightMessage(tabId,
                    doc.range, doc.className, doc._id, function (response) {
                        if (errorCallback && response !== true) {
                            errorCallback(doc);
                        }
                    });
                break;

            case "delete":
                sum--;

                _tabs.sendDeleteHighlightMessage(tabId,
                    doc.correspondingDocumentId, function (response) {
                        // doesn't warrant a callback
                        if (response !== true) {
                            console.log("Error deleting highlight in DOM");
                        }
                    });
                break;

            default:
                console.log("unhandled verb: " + doc.verb);
                break;
            }
        });

        return sum;
    }

};