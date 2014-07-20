/*global _database, _contextMenus, _tabs*/

var _eventPage = {
    /**
     * Run every time the event page is loaded
     */
    init: function () {
        "use strict";
        console.log("init");

        chrome.runtime.onInstalled.addListener(_eventPage.onRuntimeInstalled);
        chrome.runtime.onStartup.addListener(_eventPage.onRuntimeStartup);
        chrome.runtime.onMessage.addListener(_eventPage.onRuntimeMessage);

        chrome.webNavigation.onCompleted.addListener(_eventPage.onWebNavigationCompleted);

        chrome.tabs.onActivated.addListener(_eventPage.onTabActivated);

        chrome.storage.onChanged.addListener(_eventPage.onStorageChanged);

        chrome.contextMenus.onClicked.addListener(_contextMenus.onClicked);
    },

    /**
     * Fired when the extension is first installed, when the extension is updated to a new version,
     * and when Chrome is updated to a new version.
     */
    onRuntimeInstalled: function () {
        "use strict";
        console.log("onRuntimeInstalled");

        // one time initialization
        _database.putDesignDocuments(function () {
            // error param might indicate a conflict, which is ok

            // delete stale views associated with design docs
            console.log("Cleaning database");
            _database.viewCleanup();
        });

        _contextMenus.updateMenus();

//        _eventPage.onRuntimeStartup();
    },

    /**
     * Fired when a profile that has this extension installed first starts up.
     * This event is not fired when an incognito profile is started, even if this
     * extension is operating in 'split' incognito mode.
     */
    onRuntimeStartup: function () {
        "use strict";
        console.log("onRuntimeStartup");

        // remove entries in which the number of 'create' doc == number of 'delete' docs
        _database.getMatchSums(function (err, rows) {
            if (rows) {
                rows.forEach(function (row) {
                    // if the aggregate count of documents for this match is 0, remove all of them
                    if (row.value === 0) {
                        console.log("Removing stale matches for '" + row.key + "'");
                        _database.removeDocuments(row.key);
                    }
                });
            }

            console.log("Compacting database");
            _database.compact();
        });
    },

    /**
     * Fired when a document, including the resources it refers to, is completely loaded and initialized.
     * @param details
     */
    onWebNavigationCompleted: function (details) {
        "use strict";
        console.log("onWebNavigationCompleted");

        // 0 indicates the navigation happens in the tab content window
        if (details.frameId !== 0) {
            return;
        }

        // update the page action with the app title, even if it doesn't get shown
//        chrome.pageAction.setTitle({
//            "tabId": details.tabId,
//            "title": chrome.runtime.getManifest().name
//        });

        // get all the documents with our desired highlight key, in increasing order
        // query for all documents with this key
        var match = _database.buildMatchString(details.url);

        _database.getDocuments(match, function (err, docs) {
            if (err) {
                return;
            }

            // configure and show page action
            console.log("Matched " + docs.length + " document(s) with '" + match + "'");
            if (docs.length === 0) {
                return;
            }

            console.log("Injecting scripts...");
            _tabs.executeAllScripts(details.tabId, function () {
                console.log("Replaying documents into DOM");

                var sum = _tabs.replayDocuments(details.tabId, docs, function (doc) {
                    console.log("Error creating highlight in DOM for " + JSON.stringify(doc.range) );

                    // any errors will changes the page action image
                    chrome.pageAction.setIcon({
                        "tabId": details.tabId,
                        path: {
                            19: "static/images/popup/19_warning.png",
                            38: "static/images/popup/38_warning.png"
                        }
                    });
                });

                console.log("Create/Delete document sum is " + sum);

                if (sum > 0) {
                    console.log("Showing page action");
                    chrome.pageAction.show(details.tabId);
                }
            });
        });
    },

    /**
     * Message sent to us from script
     * @param message
     * @param sender
     * @param sendResponse
     */
    onRuntimeMessage: function (message, sender, sendResponse) {
        "use strict";

        switch (message.id) {
        case "on_mouse_enter_highlight":
            _contextMenus.setHoveredHighlightId(message.highlightId);
            break;

        case "on_mouse_leave_highlight":
            _contextMenus.setHoveredHighlightId(null);
            break;

        case "create_highlight":
            // create new document for highlight, then update DOM
            _eventPage.createHighlight(sender.tab.id,
                message.range, _database.buildMatchString(sender.tab.url),
                message.selectionText, message.className);
            break;

        default:
            throw "unhandled message: sender=" + sender + ", id=" + message.id;
        }
    },

    /**
     * Fires when the active tab in a window changes. Note that the tab's URL may not be set at the time this event
     * fired, but you can listen to onUpdated events to be notified when a URL is set.
     * @param activeInfo
     */
    onTabActivated: function (activeInfo) {
        "use strict";
        console.log("onTabActivated");

        // default to not being over a highlight
        _contextMenus.setHoveredHighlightId(null);
    },

    /**
     * A value in the synced storage changed
     * @param changes
     * @param namespace
     */
    onStorageChanged: function (changes, namespace) {
        "use strict";
        if (namespace === "sync") {
            if (changes.highlightDefinitions) {
                // content of context menu depends on the highlight styles
                _contextMenus.updateMenus();
            }
        }
    },

    /**
     * Create a highlight in the database and on the page DOM
     * @param tabId id of tab to send message to, to create highlight in DOM
     * @param xpathRange range of highlight
     * @param match match string to identify related highlights. Usually processed from url
     * @param selectionText associated text
     * @param className class name to apply to DOM element, and in database also
     */
    createHighlight: function (tabId, xpathRange, match, selectionText, className) {
        "use strict";
        _database.postCreateDocument(match, xpathRange, className, selectionText, function (err, response) {
            //
            if (err) {
                return;
            }

            // use the new document's id for the element id of the (first) highlight element
            _tabs.sendCreateHighlightMessage(tabId,
                xpathRange, className, response.id, function (is_created) {
                    // a false response means something went wrong - delete document from db
                    if (is_created) {
                        // (re) show page action on success
                        chrome.pageAction.show(tabId);
                    } else {
                        console.log("Error creating highlight in DOM - Removing associated document");

                        _database.removeDocument(response.id, response.rev);
                    }
                });
        });
    },

    /**
     * Update the highlight by changing its class name, first by revising its 'create' document, then in DOM
     * @param tabId
     * @param documentId
     * @param className
     */
    updateHighlight: function (tabId, documentId, className) {
        "use strict";
        _database.updateCreateDocument(documentId, className, function (err, response) {
            if (response && response.ok) {
                // document updated - now update DOM
                _tabs.sendUpdateHighlightMessage(tabId, documentId, className, function (is_updated) {
                    if (!is_updated) {
                        console.log("Error updating highlight in DOM");
                    }
                });
            }
        });
    },

    /**
     * Delete a highlight in the database, and in the page DOM
     * @param {number} tabId tab id of associated tab, whose DOM should contain the highlight.
     * @param {string} documentId id of the document representing the highlight to remove
     * @param {object} [callback] function(err, result)
     */
    deleteHighlight: function (tabId, documentId, callback) {
        "use strict";
        _database.postDeleteDocument(documentId, function (err, response) {
            if (err) {
                if (callback) {
                    callback(err);
                }

                return;
            }

            // check the number of 'create' and 'delete' documents. if equal, there
            // are no highlights for the page, so the page action can be removed
            chrome.tabs.get(tabId, function (tab) {
                var match = _database.buildMatchString(tab.url);

                // sum of +create-delete verbs for a specific match
                _database.getMatchSum(match, function (err, sum) {
                    if (err) {
                        return;
                    }

                    if (sum <= 0) {
                        chrome.pageAction.hide(tabId);
                    }
                });
            });


            // remove in DOM
            _tabs.sendDeleteHighlightMessage(tabId, documentId);

            if (callback) {
                callback(null, response);
            }
        });
    },

    /**
     * Delete all documents associated with a 'match'
     * @param {number} tabId
     * @param {string} match
     */
    deleteHighlights: function (tabId, match) {
        "use strict";
        _database.removeDocuments(match, function (err, response) {
            if (err) {
                return;
            }

            chrome.pageAction.hide(tabId);

            // Response is an array containing the id and rev of each deleted document.
            // We can use id to remove highlights in the DOM (although some won't match)
            response.forEach(function (r) {
                // remove in DOM
                if (r.ok) {
                    _tabs.sendDeleteHighlightMessage(tabId, r.id);
                }
            });
        });
    },

    /**
     * Copy the text associated with a highlight to the clipboard
     * @param {string} documentId
     */
    copyHighlightText: function (documentId) {
        "use strict";
        _database.getDocument(documentId, function (err, doc) {
            if (doc && doc.text) {
                // https://coderwall.com/p/5rv4kq
                var div = document.createElement('div');
                div.contentEditable = true;

                document.body.appendChild(div);

                div.innerHTML = doc.text;
                div.unselectable = "off";
                div.focus();

                document.execCommand('SelectAll');
                document.execCommand("Copy", false, null);

                document.body.removeChild(div);
            }
        });
    },

    /**
     * Speak text
     * @param {string} documentId
     * @param {*} [options]
     */
    speakHighlightText: function (documentId, options) {
        "use strict";
        _database.getDocument(documentId, function (err, doc) {
            if (doc && doc.text) {
                chrome.tts.speak(doc.text, options);
            }
        });
    },

    /**
     * Ask DOM if a highlight with this id exists
     * @param {number} tabId
     * @param {string} documentId
     * @param {function} [responseCallback] function(boolean)
     */
    isHighlightInDOM: function (tabId, documentId, responseCallback) {
        "use strict";
        _tabs.sendIsHighlightInDOMMessage(tabId, documentId, responseCallback);
    },

    /**
     * Scroll DOM to a highlight
     * @param tabId
     * @param documentId
     * @param {function} responseCallback function(boolean)
     */
    scrollTo: function (tabId, documentId, responseCallback) {
        "use strict";
        _tabs.sendScrollToMessage(tabId, documentId, responseCallback);
    }
};

_eventPage.init();
