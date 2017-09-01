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

// disable console log
// console.log = function() {}

var _eventPage = {
    /**
     * Run every time the event page is loaded
     */
    init: function () {
        "use strict";
        chrome.runtime.onInstalled.addListener(_eventPage.onRuntimeInstalled);
        chrome.runtime.onStartup.addListener(_eventPage.onRuntimeStartup);
        chrome.runtime.onMessage.addListener(_eventPage.onRuntimeMessage);

        chrome.webNavigation.onCompleted.addListener(_eventPage.onCompleted, {
            url: [{
                schemes: ['http', 'https', 'file']
            }]
        })

        // DISABLED UNTIL MOUSE EVENT BUG IS FIXED
        // chrome.tabs.onActivated.addListener(_eventPage.onActivated);

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
        // one time initialization
        return _database.putDesignDocuments().then(() => {
            // error param might indicate a conflict, which is ok.
            // delete stale views associated with design docs
            return _database.viewCleanup_Promise();
        }).then(() => {
            _contextMenus.recreateMenu();
        })
    },

    /**
     * Fired when a profile that has this extension installed first starts up.
     * This event is not fired when an incognito profile is started, even if this
     * extension is operating in 'split' incognito mode.
     */
    onRuntimeStartup: function () {
        "use strict";
        _contextMenus.recreateMenu();

        // remove entries in which the number of 'create' doc == number of 'delete' docs
        return _database.getMatchSums_Promise().then(rows => {
            return Promise.all(rows
                .filter(row => row.value === 0)
                .map(row => _database.removeDocuments_Promise(row.key))
            )
        }).then(() => _database.compact())
    },

    /**
     * Fired when a document, including the resources it refers to, is completely loaded and initialized.
     * We should probably use 'onDOMContentLoaded', but leaving it until the very last opportunity is
     * (probably) more robust, but slower
     * @param {Object} details - navigation details
     */
    onCompleted: function (details) {
        "use strict";

        // 0 indicates the navigation happens in the tab content window
        if (details.frameId !== 0) {
            return Promise.resolve();//reject();
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
        let matchString = _database.buildMatchString(details.url);
        let matchedDocs;

        return _database.getDocuments_Promise(matchString).then(function (docs) {
            matchedDocs = docs;

            // configure and show page action
            console.log("Matched " + matchedDocs.length + " document(s) with '" + matchString + "'");
            if (matchedDocs.length === 0) {
                return;
            }

            const firstDoc = matchedDocs[0]

            // if the first document is a 'create' document without a title, update it now
            if (firstDoc.verb === 'create' && typeof firstDoc.title === 'undefined') {
                // promise resolves when tab title obtained
                return new Promise((resolve) => {
                    chrome.tabs.get(details.tabId, tab => {
                        // ignore tabs where the title == url (i.e. not explicity defined)
                        if (tab.title === tab.url) {
                            resolve()
                            return
                        }

                        _database.updateCreateDocument_Promise(firstDoc._id, {
                            title: tab.title
                        }).then(() => resolve())
                    })
                })
            } else {
                return Promise.resolve()
            }
        }).then(() => _tabs.executeAllScripts_Promise(details.tabId, false)).then(() => {
            // set of ids of 'create' documents that reported errors, and did NOT have a corresponding
            // 'delete' document (i.e. implying it's not really an error)
            const unmatchedCreateDocIds = new Set()

            return _tabs.replayDocuments_Promise(details.tabId, matchedDocs, errorDoc => {
                // method only called if there's an error. called multiple times
                if (errorDoc.verb === "create") {
                    unmatchedCreateDocIds.add(errorDoc._id)
                }
            }).then(sum => {
                if (unmatchedCreateDocIds.size > 0) {
                    // remove 'create' docs for which a matching 'delete' doc exists
                    for (const doc of matchedDocs) {
                        if (doc.verb === 'delete') {
                            unmatchedCreateDocIds.delete(doc.correspondingDocumentId)

                            if (unmatchedCreateDocIds.size === 0) {
                                break
                            }
                        }
                    }

                    // any remaining entries are genuinely invalid
                    if (unmatchedCreateDocIds.size > 0) {
                        _eventPage.setPageActionStatus(details.tabId, true)
                        console.warn(`Error replaying ${unmatchedCreateDocIds.size} 'create' document(s)`)
                    }
                }

                return sum
            })
        }).then(sum => {
            if (sum <= 0) {
                return
            }

            chrome.pageAction.show(details.tabId);
        })
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
            title: chrome.i18n.getMessage(not_in_dom ?
                "page_action_title_not_in_dom" : "page_action_default_title")
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
            case "on_click_delete_highlight":
                // message.highlightId is the document id to be deleted
                _tabs.getActiveTab().then(function (tab) {
                    _eventPage.deleteHighlight(tab.id, message.highlightId);
                });
                break;

            // case "on_mouse_enter_highlight":
            //     _contextMenus.setHoveredHighlightId(message.highlightId);
            //     break;

            // case "on_mouse_leave_highlight":
            //     _contextMenus.setHoveredHighlightId(null);
            //     break;

            //        case "create_highlight":
            //            // create new document for highlight, then update DOM
            //            _eventPage.createHighlight(sender.tab.id,
            //                message.range, _database.buildMatchString(sender.tab.url),
            //                message.selectionText, message.className);
            //            break;

            default:
                throw "Unhandled message: sender=" + sender + ", id=" + message.id;
        }
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
     * 
     * @param {Object} command - chrome command object
     * @returns {Promise}
     */
    onCommandsCommand: function (command) {
        "use strict";
        // parse well-known command strings, but default to the formatted kind
        switch (command) {
            case "delete_hovered_highlight":
                return _tabs.getActiveTab().then(tab => {
                    return _tabs.getHoveredHighlightID(tab.id).then(docID => {
                        if (!docID) {
                            return
                        }
                         
                        _eventPage.deleteHighlight(tab.id, docID)
                    })
                })

            case "undo_last_create_highlight":
                return _tabs.getActiveTab().then(tab => _eventPage.undoLastHighlight(tab.id))

            case "copy_overview":
                // use the sort defined by the popup
                return new ChromeStorage().get([
                    ChromeStorage.KEYS.HIGHLIGHT.SORT_BY,
                    ChromeStorage.KEYS.HIGHLIGHT.INVERT_SORT
                ]).then(items => {
                    return _tabs.getActiveTab().then(tab => {
                        const comparator = _tabs.getComparisonFunction(
                            tab.id,
                            items[ChromeStorage.KEYS.HIGHLIGHT.SORT_BY]
                        )

                        return _eventPage.getOverviewText(
                            "markdown", tab, comparator,
                            undefined, items[ChromeStorage.KEYS.HIGHLIGHT.INVERT_SORT]
                        )
                    })
                }).then(text => _eventPage.copyText(text))

            default:
                // parse the command string to find the style's index
                // 'apply_highlight_index.0'
                const re = new RegExp("^apply_highlight\\.(\\d+)$");
                const match = re.exec(command);

                if (!match || match.length !== 2) {
                    return Promise.reject(new Error("unknown command " + command))
                }

                // name of class that new highlight should adopt
                let highlightClassName

                const index = parseInt(match[1])

                // convert to object
                return new ChromeHighlightStorage().getAll().then(items => {
                    const highlightDefinitions = items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]

                    if (!highlightDefinitions || highlightDefinitions.length <= index) {
                        return Promise.reject(new Error("Unable to match command index to definition"));
                    }

                    highlightClassName = highlightDefinitions[index].className
                    
                    return _tabs.getActiveTab()
                }).then(tab => {
                    const match = _database.buildMatchString(tab.url);
                    if (!match) {
                        return Promise.reject(new Error());
                    }

                    return _tabs.sendGetSelectionRangeMessage_Promise(tab.id).then(function (xpathRange) {
                        if (!xpathRange) {
                            return Promise.reject(new Error());
                        }

                        const storage = new ChromeStorage()

                        // non collapsed selection means create new highlight
                        if (!xpathRange.collapsed) {
                            // requires selection text
                            return _tabs.sendGetRangeTextMessage_Promise(tab.id, xpathRange).then(function (selectionText) {
                                if (!selectionText) {
                                    return Promise.reject(new Error());
                                }

                                // create new document for highlight,
                                // then update DOM
                                return _eventPage.createHighlight(tab.id,
                                    xpathRange, _database.buildMatchString(tab.url),
                                    selectionText, highlightClassName)
                            }).then(() => {
                                // remove selection?
                                return storage.get(ChromeStorage.KEYS.UNSELECT_AFTER_HIGHLIGHT).then(unselectAfterHighlight => {
                                    if (!unselectAfterHighlight) {
                                        return
                                    }

                                    // unselect all
                                    _eventPage.selectHighlightText(tab.id);
                                })
                            })
                        } else {
                            // collapsed selection range means update 
                            // the hovered highlight (if possible)
                            return _tabs.getHoveredHighlightID(tab.id).then(docId => {
                                if (!docId) {
                                    return
                                }

                                // if the hovered highlight has a different style to the shortcut request, update
                                // it. If not, remove the highlight.

                                /// get doc associated with highlight, identified by id
                                return _database.getDocument_Promise(docId).then(doc => {
                                    if (doc.className !== highlightClassName) {
                                        // different class. update.
                                        return _eventPage.updateHighlight(tab.id, docId, highlightClassName);
                                    } 

                                    // the 'toggle' nature of this means it only makes sense 'unselectAfterHighlight' is true.
                                    // Otherwise it's too easy to make multiple highlights over the same range.
                                    return storage.get(ChromeStorage.KEYS.UNSELECT_AFTER_HIGHLIGHT).then(unselectAfterHighlight => {
                                        if (!unselectAfterHighlight) {
                                            return
                                        }

                                        // remove the highlight
                                        return _eventPage.deleteHighlight(tab.id, docId).then(function () {
                                            // then select the text it spanned
                                            return _tabs.sendSelectRangeMessage_Promise(tab.id, doc.range);
                                        });
                                    });
                                    
                                })
                            });
                        }
                    });
                });
        }	// end switch
    },

    /**
     * Create a highlight in the database and on the page DOM
     * 
     * @param tabId id of tab to send message to, to create highlight in DOM
     * @param xpathRange range of highlight
     * @param match match string to identify related highlights. Usually processed from url
     * @param selectionText associated text
     * @param className class name to apply to DOM element, and in database also
     * @returns {Promise}
     */
    createHighlight: function (tabId, xpathRange, match, selectionText, className) {
        "use strict";
        if (xpathRange.collapsed) {
            return Promise.reject(new Error("Collapsed range"));
        }

        // shared between promises
        let _newDoc = {}

        // if this is the first create document to be posted, we want the title too
        return _database.getMatchSum_Promise(match).then(sum => {
            if (sum != 0) {
                // resolve to undefined title
                return Promise.resolve()
            }

            // resolve to tab's title
            return new Promise(resolve => { chrome.tabs.get(tabId, tab => { resolve(tab) }) })
        }).then(tab => {
            // not being collapsed is implicit
            delete xpathRange.collapsed;

            // ignore tabs where the title == url (i.e. not explicity defined)
            return _database.postCreateDocument_Promise(
                match,
                xpathRange,
                className,
                selectionText,
                (tab && tab.title !== tab.url && tab.title) || undefined
            )
        }).then(resp => {
            _newDoc = {
                id: resp.id,
                rev: resp.rev
            }

            // use the new document's id for the element id of the (first) highlight element
            try {
                return _tabs.sendCreateHighlightMessage_Promise(tabId, xpathRange, className, resp.id)
            } catch (e) {
                console.error("Exception creating highlight in DOM - Removing associated document");

                // always rejects
                return _database.removeDocument_Promise(resp.id, resp.rev)
                    .then(() => Promise.reject(new Error()))
            }
        }).then(didCreate => {
            // a false response means something went wrong.
            // Delete document from db
            if (!didCreate) {
                console.error("Error creating highlight in DOM - Removing associated document");

                // always rejects
                return _database.removeDocument_Promise(_newDoc.id, _newDoc.rev)
                    .then(() => Promise.reject(new Error()))
            }

            // (re) show page action on success
            chrome.pageAction.show(tabId);
        })
    },

    /**
     * Update the highlight by changing its class name, first by revising its 'create' document, then in DOM
     * @param tabId
     * @param documentId
     * @param className
     */
    updateHighlight: function (tabId, documentId, className) {
        "use strict";
        return _database.updateCreateDocument_Promise(documentId, { className: className }).then(response => {
            if (!response.ok) {
                return Promise.reject(new Error("Response not OK"));
            }

            // document updated - now update DOM
            return _tabs.sendUpdateHighlightMessage_Promise(tabId, documentId, className)
        }).then(function (is_updated) {
            if (!is_updated) {
                return Promise.reject(new Error("Error updating highlight in DOM"));
            }
        });
    },

    /**
     * Delete a highlight in the database, and in the page DOM
     * @param {Array<Number>|Number} [tabIds] id or array of ids of tabs of associated tabs, whose DOM should contain the highlight. 
     *  If undefined, query api for tab with match name.
     * @param {string} docId id of the document representing the highlight to remove
     */
    deleteHighlight: function (tabIds, docId) {
        "use strict";

        tabIds = (typeof tabIds === 'number' && [tabIds]) || tabIds

        // match property of the document representing the highlight to be deleted
        let _match

        // make sure original document exists, and store its 'match' property
        return _database.getDocument_Promise(docId).then(doc => {
            console.assert(doc.verb === 'create')
            _match = doc.match

            // if its also the last 'create' document we can delete it directly
            return _database.getDocuments_Promise(_match, { 
                descending: false, 
                verbs: ['create'] 
            }).then(docs => {
                console.assert(docs.length >= 1)
                const lastDoc = docs[docs.length - 1]

                // if the last non-delete document was our 'create' doc we can delete directly
                if (lastDoc._id === doc._id) {
                    console.log('Highlight is the latest "create" document - removing directly')
                    return _database.removeDocument_Promise(doc._id, doc._rev)
                } else {
                    // post an additional 'delete' document
                    return _database.postDeleteDocument_Promise(docId)
                }
            })
        }).then(response => {
            if (!response.ok) {
                // 'delete' document wasn't posted
                return Promise.reject(new Error(response))
            }

            // if the tab id is undefined, *try* to query it from the match title
            if (typeof tabIds === 'undefined') {
                return _tabs.query({
                    url: encodeURI(_match),
                    status: 'complete'
                }).then(tabs => {
                    tabIds = tabs.map(t => t.id).filter(tid => tid !== chrome.tabs.TAB_ID_NONE)
                })
            }
        }).then(() => {
            // if tab specified, try and remove highlight from DOM (result ignored)
            if (Array.isArray(tabIds)) {
                // discard errors
                return Promise.all(tabIds.map(tid => _tabs.sendDeleteHighlightMessage_Promise(tid, docId))).catch(() => { })
            }
        }).then(() => {
            // Get sum of create(+1) & delete(-1) verbs for a specific match
            // If equal, there are no highlights for the page, so the page action can be removed,
            // and the remaining documents are useless
            return _database.getMatchSum_Promise(_match)
        }).then(sum => {
            console.log(`Sum: ${sum} [${_match}]`);

            if (sum > 0) {
                return
            }

            console.log(`Removing all documents for ${_match}`);

            if (Array.isArray(tabIds)) {
                tabIds.forEach(tid => chrome.pageAction.hide(tid))
            }

            // can delete all documents
            return _database.removeDocuments_Promise(_match)
        })
    },

    /**
     * Delete all documents associated with a 'match'
     * @param {number} tabId
     * @param {string} match
     */
    deleteHighlights: function (tabId, match) {
        "use strict";
        return _database.removeDocuments_Promise(match).then(function (response) {
            chrome.pageAction.hide(tabId);

            // Response is an array containing the id and 
            // rev of each deleted document.
            // We can use id to remove highlights in 
            // the DOM (although some won't match)
            response.filter(function (r) {
                return r.ok;
            }).forEach(function (r) {
                // remove in DOM - note that the result is ignored 
                // (and also not awaited)
                _tabs.sendDeleteHighlightMessage_Promise(tabId, r.id);
            });
        });
    },

	/**
	 * Undo the last undoable document in the journal (by negating it)
	 */
    undoLastHighlight: function (tabId) {
        return new Promise(resolve => {
            // get tab object from tab id
            chrome.tabs.get(tabId, tab => resolve(tab))
        }).then(function (tab) {
            // build match using tab's url, and get the last document
            const match = _database.buildMatchString(tab.url)

            return _database.getDocuments_Promise(match, { descending: true })
        }).then(function (docs) {
            // find last 'undoable' document that has not already been
            // negated 
            let deletedDocumentIds = new Set();

            let i, len = docs.length;
            for (i = 0; i < len; ++i) {
                var doc = docs[i];

                switch (doc.verb) {
                    case "delete":
                        deletedDocumentIds.add(doc.correspondingDocumentId);
                        break;

                    case "create":
                        // is it already deleted?
                        if (deletedDocumentIds.has(doc._id) === false) {
                            // add a negating document
                            return _eventPage.deleteHighlight(tabId, doc._id);
                        }
                }
            }

            return Promise.reject("No create documents to undo.");

            // THIS CRASHES CHROME

            // var latestCreateDoc = docs.find(function (doc) {
            // 	switch (doc.verb) {
            // 	case "delete":
            // 		deletedDocumentIds.add(doc.correspondingDocumentId);
            // 		return false;
            //
            // 	case "create":
            // 		// is it already deleted?
            // 		return deletedDocumentIds.has(doc._id) === false
            // 	}
            // });
            //
            // if (lastCreateDoc) {
            // 	// add a negating document
            // 	return _eventPage.deleteHighlight(tabId, lastCreateDoc._id);
            // } else {
            // 	return Promise.reject("No create documents to undo.");
            // }
        });
    },

    /**
     * Select the text associated with a highlight
     * @param {number} tabId
     * @param {string} [documentId] if undefined, remove selection
     * @param {function} [responseCallback] function(xpathRange)
     */
    selectHighlightText: function (tabId, documentId) {
        "use strict";
        return _tabs.sendSelectHighlightTextMessage_Promise(tabId, documentId);
    },

    /**
     * Copy the text associated with a highlight to the clipboard
     * @param {string} documentId
     */
    copyHighlightText: function (documentId) {
        "use strict";
        return _database.getDocument_Promise(documentId).then(function (doc) {
            if (doc.text) {
                if (!_eventPage.copyText(doc.text)) {
                    return Promise.reject(new Error());
                }
            }
        });
    },

	/**
	 * generic text copy function. copies text to clipboard
	 */
    copyText: function (text) {
        // http://updates.html5rocks.com/2015/04/cut-and-copy-commands
        // add temporary node which can contain our text
        var pre = document.createElement('pre');
        pre.innerText = text;

        document.body.appendChild(pre);

        var range = document.createRange();
        range.selectNode(pre);

        // make our node the sole selection
        var selection = document.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        var result = document.execCommand('copy');

        selection.removeAllRanges();
        document.body.removeChild(pre);

        return result;
    },

    /**
     * Speak text
     * @param {string} documentId
     * @param {object} [options] if not supplied, use the storage value
     */
    speakHighlightText: function (tabId, documentId, options) {
        "use strict";
        options = options || {};

        return _tabs.sendGetDocumentElementAttributeNodeValue_Promise(tabId, "lang").then(function (lang) {
            // navigator.language seems to produce weird-sounding results
            //options.lang = lang || navigator.language;

            if (typeof lang === "string") {
                options.lang = lang;
            }

            return _database.getDocument_Promise(documentId);
        }).then(function (doc) {
            if (typeof doc.text === "string") {
                // workaround for Google Deutsch becoming the default voice, for some reason
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
    isHighlightInDOM: function (tabId, documentId) {
        "use strict";
        return _tabs.sendIsHighlightInDOMMessage_Promise(tabId, documentId);
    },

    /**
     * Scroll DOM to a highlight
     * @param tabId
     * @param documentId
     * @param {function} responseCallback function(boolean)
     */
    scrollTo: function (tabId, documentId) {
        "use strict";
        return _tabs.sendScrollToMessage_Promise(tabId, documentId);
    },

	/**
	 * Get an overiew of the highlights for the current page
     * 
	 * @param {Object} tab one of the available tabs, or active tab if undefined
	 * @param {string} format one of [markdown]
	 * @param {Function} [comparator] function that returns a promise that resolves to a comparible value
     * @param {Function} [filterPredicate] function that returns true if the doc should be included. Same signature as Array.map
     * @param {Boolean} [invert] invert the document order
	 * @returns {Promise} overview correctly formatted as a string
	 */
    getOverviewText: function (format, tab, comparator, filterPredicate, invert) {
        var titles = {};
        var promise = (tab && Promise.resolve(tab)) || _tabs.getActiveTab();

        return promise.then(function (_tab) {
            // the actual tab
            tab = _tab;

            return new ChromeHighlightStorage().getAll().then(items => items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS])
        }).then(highlightDefinitions => {
            // map the highlight class name to its display name, for later usage
            for (const d of highlightDefinitions) {
                titles[d.className] = d.title
            }

            // get documents associated with the tab's url
            const match = _database.buildMatchString(tab.url)

            return _database.getCreateDocuments_Promise(match)
        }).then(function (docs) {
            // filter
            return (filterPredicate && docs.filter(filterPredicate)) || docs;
        }).then(function (docs) {
            // sort - main promise (default to native order)
            return (comparator && _database.sortDocuments(docs, comparator)) ||
                Promise.resolve(docs);
        }).then(function (docs) {
            if (invert) {
                docs.reverse()
            }

            switch (format) {
                case "markdown":
                case "markdown-no-footer":
                    var markdown = "# [" + tab.title + "](" + tab.url + ")";
                    var currentClassName;

                    // iterate each highlight
                    docs.forEach(function (doc) {
                        // only add a new heading when the class of the header changes
                        if (doc.className != currentClassName) {
                            markdown += ("\n\n## " + titles[doc.className]);

                            currentClassName = doc.className;
                        } else {
                            // only seperate subsequent list items
                            markdown += "\n"
                        }

                        // each highlight is an unordered list item
                        markdown += ("\n* " + doc.text)
                    });

                    // footer
                    if (format !== "markdown-no-footer") {
                        markdown += ("\n\n---\n" +
                            chrome.i18n.getMessage("overview_footer", [
                                chrome.i18n.getMessage("extension_name"),
                                chrome.i18n.getMessage("extension_webstore_url"),
                                chrome.i18n.getMessage("copyright_year"),
                                chrome.i18n.getMessage("extension_author"),
                                chrome.i18n.getMessage("extension_author_url")
                            ])
                        );
                    }

                    return Promise.resolve(markdown);

                default:
                    return Promise.reject(new Error());
            }
        });
    }
};

_eventPage.init();
