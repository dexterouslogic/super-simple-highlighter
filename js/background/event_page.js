/*global _database, _contextMenus, _tabs, _storage*/

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

var _eventPage = {
    /**
     * Run every time the event page is loaded
     */
    init: function () {
        "use strict";
        /*jshint evil:true */
        console.log("init");

        chrome.runtime.onInstalled.addListener(_eventPage.onRuntimeInstalled);
        chrome.runtime.onStartup.addListener(_eventPage.onRuntimeStartup);
        chrome.runtime.onMessage.addListener(_eventPage.onRuntimeMessage);

        chrome.webNavigation.onCompleted.addListener(_eventPage.onWebNavigationCompleted);

        chrome.tabs.onActivated.addListener(_eventPage.onTabActivated);

        chrome.storage.onChanged.addListener(_eventPage.onStorageChanged);

        chrome.contextMenus.onClicked.addListener(_contextMenus.onClicked);

        chrome.commands.onCommand.addListener(_eventPage.onCommandsCommand);
    },

    /**
     * Fired when the extension is first installed, when the extension is updated to a new version,
     * and when Chrome is updated to a new version.
     * @param {function} details function(object details) {...}
     */
    onRuntimeInstalled: function (details) {
        "use strict";
        console.log("onRuntimeInstalled: " + JSON.stringify(details));

        // one time initialization
        _database.putDesignDocuments(function () {
            // error param might indicate a conflict, which is ok

            // delete stale views associated with design docs
            console.log("Cleaning stale views associated with design docs");
            _database.viewCleanup();
        });

        _contextMenus.recreateMenu();

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
//        console.log(details);

        // 0 indicates the navigation happens in the tab content window
        if (details.frameId !== 0) {
            return;
        }

        // default (ok)
        // NW don't know why tab id sometimes is invalid
//        _eventPage.setPageActionStatus(details.tabId, false);

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

            console.log("Injecting scripts into top level frames...");

            _tabs.executeAllScripts(details.tabId, false, function () {
                console.log("Replaying documents into DOM");

                var sum = _tabs.replayDocuments(details.tabId, docs, function (doc) {
                    // method only called if there's an error. called multiple times
                    console.log("Error in '" + doc.verb + "' highlight in DOM for " + JSON.stringify(doc.range) );

                    // update page action
                    if (doc.verb === "create") {
                        _eventPage.setPageActionStatus(details.tabId, true);
                    }
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
     * Set the title/icon for page icon, based on whether 1 or more highlights weren't found in DOM.
     * Note that it doesn't show/hide icon
     * @param {number} tabId
     * @param not_in_dom
     * @private
     */
    setPageActionStatus: function (tabId, not_in_dom) {
        "use strict";

        // any errors will changes the page action image
        chrome.pageAction.setTitle({
            tabId: tabId,
            title: chrome.i18n.getMessage(not_in_dom ? "page_action_title_not_in_dom" : "page_action_default_title")
        });

        chrome.pageAction.setIcon({
            "tabId": tabId,
            path: {
                19: not_in_dom ? "static/images/popup/19_warning.png" : "static/images/19.png",
                38: not_in_dom ? "static/images/popup/38_warning.png" : "static/images/38.png"
            }
        });
    },

    /**
     * Message sent to us from script
     * @param message
     * @param sender
     * @param [sendResponse]
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

//        case "create_highlight":
//            // create new document for highlight, then update DOM
//            _eventPage.createHighlight(sender.tab.id,
//                message.range, _database.buildMatchString(sender.tab.url),
//                message.selectionText, message.className);
//            break;

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
                _contextMenus.recreateMenu();
            }
        }
    },

    /**
     * Fired when a registered command is activated using a keyboard shortcut.
     */
    onCommandsCommand: function (command) {
        "use strict";
        // parse the command string to find the style's index
        // 'apply_highlight_index.0'
        var re = new RegExp("^apply_highlight\\.(\\d+)$");
        var match = re.exec(command);

        if (!match || match.length !== 2) {
            throw "unknown command " + command;
        }

        var index = parseInt(match[1]);

        // convert to object
        _storage.highlightDefinitions.getAll(function (items) {
            if (!items || !items.highlightDefinitions || items.highlightDefinitions.length <= index) {
                console.log("Unable to match command index to definition");
                return;
            }

            var hd = items.highlightDefinitions[index];

            // find the range of selected text for the active tab
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (!tabs) { return; }

                var activeTab = tabs[0];

                var match = _database.buildMatchString(activeTab.url);
                if (!match) { return; }

                // if there is text selected, we create a new highlight
                _tabs.sendGetSelectionRangeMessage(activeTab.id, function (xpathRange) {
                    if (!xpathRange) { return; }

                    // non collapsed selection means create new highlight
                    if (!xpathRange.collapsed) {
                        // requires selection text
                        _tabs.sendGetRangeTextMessage(activeTab.id, xpathRange, function (selectionText) {
                            if (!selectionText) { return; }

                            // create new document for highlight, then update DOM
                            _eventPage.createHighlight(activeTab.id,
                                xpathRange, _database.buildMatchString(activeTab.url),
                                selectionText, hd.className);

                            // remove selection?
                            _storage.getUnselectAfterHighlight(function (unselectAfterHighlight) {
                                if (unselectAfterHighlight) {
                                    // unselect all
                                    _eventPage.selectHighlightText(activeTab.id);
                                }
                            });

                        });
                    } else {
                        // collapsed selection range means update the hovered highlight (if possible)
                        var documentId = _contextMenus.getHoveredHighlightId();
                        if (documentId) {
                            _eventPage.updateHighlight(activeTab.id,
                                documentId, hd.className);
                        }
                    }
                });
            });
        });
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
        if (xpathRange.collapsed) {
            console.log("Ignoring collapsed range");
            return;
        }

        // not being collapsed is implicit
        delete xpathRange.collapsed;

        _database.postCreateDocument(match, xpathRange, className, selectionText, function (err, response) {
            if (err) {
                return;
            }

            // use the new document's id for the element id of the (first) highlight element
            try {
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
            }catch (e){
                console.log("Exception creating highlight in DOM - Removing associated document");
                _database.removeDocument(response.id, response.rev);
            }
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
     * @param {function} [callback] function(err, result), result = standard {ok/id/rev} reply
     */
    deleteHighlight: function (tabId, documentId, callback) {
        "use strict";

        // if the highlight isn't in the DOM, then deleting the 'create' document can be done directly,
        // as create never had any effect
        _eventPage.isHighlightInDOM(tabId, documentId, function (inDOM) {
            /**
             * Callback handler for posting 'delete' doc or removing 'create' doc
             * @param [err]
             * @param {object} response (ok/id/rev)
             * @private
             */
            function _resultCallback(err, response) {
                if (response && response.ok) {
                    if (inDOM) {
                        console.log("Successfully posted ;delete' document. Removing in DOM");
                        _tabs.sendDeleteHighlightMessage(tabId, documentId);
                    } else {
                        console.log("Removed 'create' document");
                    }

                    console.log("reevaluating page action visibility");

                    // check the number of 'create' and 'delete' documents. if equal, there
                    // are no highlights for the page, so the page action can be removed
                    chrome.tabs.get(tabId, function (tab) {
                        var match = _database.buildMatchString(tab.url);

                        // sum of +create-delete verbs for a specific match
                        _database.getMatchSum(match, function (err, sum) {
                            if (!err && sum <= 0) {
                                chrome.pageAction.hide(tabId);
                            }
                        });
                    });
                }

                if (callback) {
                    callback(err, response);
                }

            }


            // check the number of 'create' and 'delete' documents. if equal, there
            // are no highlights for the page, so the page action can be removed
            if (inDOM) {
                console.log("Highlight IS in DOM. Posting 'delete' doc");

                // highlight was in DOM, so we post an additional 'delete' document
                _database.postDeleteDocument(documentId, _resultCallback);
            } else {
                // remove directly
                console.log("Highlight IS NOT in DOM. Directly removing 'create' doc");

                _database.getDocument(documentId, function (err, doc) {
                    if (err) {
                        if (callback) {
                            callback(err, null);
                        }
                        return;
                    }

                    _database.removeDocument(doc._id, doc._rev, _resultCallback);
                });
            }
        });

//        _database.postDeleteDocument(documentId, function (err, response) {
//            if (err) {
//                if (callback) {
//                    callback(err);
//                }
//
//                return;
//            }
//
//            // check the number of 'create' and 'delete' documents. if equal, there
//            // are no highlights for the page, so the page action can be removed
//            chrome.tabs.get(tabId, function (tab) {
//                var match = _database.buildMatchString(tab.url);
//
//                // sum of +create-delete verbs for a specific match
//                _database.getMatchSum(match, function (err, sum) {
//                    if (err) {
//                        return;
//                    }
//
//                    if (sum <= 0) {
//                        chrome.pageAction.hide(tabId);
//                    }
//                });
//            });
//
//
//            // remove in DOM
//            _tabs.sendDeleteHighlightMessage(tabId, documentId);
//
//            if (callback) {
//                callback(null, response);
//            }
//        });
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
     * Select the text associated with a highlight
     * @param {number} tabId
     * @param {string} [documentId] if undefined, remove selection
     * @param {function} [responseCallback] function(xpathRange)
     */
    selectHighlightText: function (tabId, documentId,responseCallback) {
        "use strict";
        _tabs.sendSelectHighlightTextMessage(tabId, documentId, responseCallback);
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
     * @param {object} [options] if not supplied, use the storage value
     */
    speakHighlightText: function (documentId, options) {
        "use strict";
        _database.getDocument(documentId, function (err, doc) {
            if (doc && doc.text) {

                if (options) {
                    chrome.tts.speak(doc.text, options);
                } else {
                    chrome.storage.sync.get({
                        ttsSpeakOptions: null
                    }, function (items) {
                        if (chrome.runtime.lastError) {
                            return;
                        }

                        chrome.tts.speak(doc.text, items.ttsSpeakOptions);
                    });
                }
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
