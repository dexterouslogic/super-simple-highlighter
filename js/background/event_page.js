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
console.log = function() {}

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
        console.log("onRuntimeInstalled: " + JSON.stringify(details));

        // one time initialization
        return _database.putDesignDocuments().then(function () {
            // error param might indicate a conflict, which is ok

            // delete stale views associated with design docs
            console.log("Cleaning stale views associated with design docs");

            return _database.viewCleanup_Promise();
        }).then(function () {
	        _contextMenus.recreateMenu();        	
        });

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

        _contextMenus.recreateMenu();
		
        // remove entries in which the number of 'create' doc == number of 'delete' docs
		return _database.getMatchSums_Promise().then(function (rows) {
			return Promise.all(rows.filter(function(row) {
				return row.value === 0;
			}).map(function(row) {
				return _database.removeDocuments_Promise(row.key);
			}));
		}).then(function() {
			_database.compact()
		}).then(function() {
            console.log("Compacted database");
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
        var match = _database.buildMatchString(details.url);
		var docs;

		return _database.getDocuments_Promise(match).then(function (d) {
			docs = d;
			
            // configure and show page action
            console.log("Matched " + docs.length + " document(s) with '" + match + "'");
            if (docs.length === 0) {
                return;
            }
			
			console.log("Injecting scripts into top level frames...");
			
			return _tabs.executeAllScripts_Promise(details.tabId, false);
		}).then(function () {
			console.log("Replaying documents into DOM");
			
            return _tabs.replayDocuments_Promise(details.tabId, docs, function (errorDoc) {
                // method only called if there's an error. called multiple times
                console.log("Error:" + JSON.stringify(errorDoc));

                // update page action
                if (errorDoc.verb === "create") {
                    _eventPage.setPageActionStatus(details.tabId, true);
                }
            });
		}).then(function (sum) {
            console.log("Create/Delete document sum is " + sum);

            if (sum > 0) {
                console.log("Showing page action");
                chrome.pageAction.show(details.tabId);
            }
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
            _tabs.getActiveTab().then(function(tab) {
                _eventPage.deleteHighlight(tab.id, message.highlightId);
            });
            break;

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
            throw "Unhandled message: sender=" + sender + ", id=" + message.id;
        }
    },

    /**
     * Fires when the active tab in a window changes. Note that the tab's URL may not be set at the time this event
     * fired, but you can listen to onUpdated events to be notified when a URL is set.
	 * DISABLED UNTIL MOUSE EVENT BUG IS FIXED
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
		// parse well-known command strings, but default to the formatted kind
		switch(command) {
        case "delete_hovered_highlight":
            var _tab;

            return _tabs.getActiveTab().then(function (tab) {
                _tab = tab;

                return _tabs.getHoveredHighlightID(tab.id);
			}).then(function(documentId) {
                if (documentId) {
                    _eventPage.deleteHighlight(_tab.id, documentId);
                }
            });

		case "undo_last_create_highlight":
			return _tabs.getActiveTab().then(function (tab) {
				return _eventPage.undoLastHighlight(tab.id)
			});
			
		case "copy_overview":
			var tab;
			
			// use the sort defined by the popup
			return _tabs.getActiveTab().then(function (_tab) {
				tab = _tab;
				return _storage.getValue("highlight_sort_by");
			}).then(function (value) {
				return _tabs.getComparisonFunction(tab.id, value);
			}).then(function (compare) {
				return _eventPage.getOverviewText("markdown", tab, compare);
			}).then(function(text) {
				// copy to clipboard
				_eventPage.copyText(text);
			});
			
		default:
			// parse the command string to find the style's index
	        // 'apply_highlight_index.0'
	        var re = new RegExp("^apply_highlight\\.(\\d+)$");
	        var match = re.exec(command);

	        if (!match || match.length !== 2) {
	            throw "unknown command " + command;
	        }

	        var index = parseInt(match[1]);
			var hd;
			
	        // convert to object
	        return _storage.highlightDefinitions.getAll_Promise().then(function (items) {
	            if (!items.highlightDefinitions || items.highlightDefinitions.length <= index) {
	                return Promise.reject(new Error("Unable to match command index to definition"));
	            }

	            hd = items.highlightDefinitions[index];
				return _tabs.getActiveTab();
			}).then(function(activeTab) {
                var match = _database.buildMatchString(activeTab.url);
                if (!match) {
					 return Promise.reject(new Error());
				}

				return _tabs.sendGetSelectionRangeMessage_Promise(activeTab.id).then(function (xpathRange) {
					if (!xpathRange) { 
						return Promise.reject(new Error());
					}
					
                    // non collapsed selection means create new highlight
                    if (!xpathRange.collapsed) {
                        // requires selection text
                        return _tabs.sendGetRangeTextMessage_Promise(activeTab.id, xpathRange).then(function (selectionText) {
                            if (!selectionText) { 
								return reject(new Error());
							}
							
                            // create new document for highlight,
							// then update DOM
                            return _eventPage.createHighlight(activeTab.id,
                                xpathRange, _database.buildMatchString(activeTab.url),
                                selectionText, hd.className);
						}).then(function () {
                            // remove selection?
                            return _storage.getUnselectAfterHighlight_Promise().then(function (unselectAfterHighlight) {
                                if (unselectAfterHighlight) {
                                    // unselect all
                                    _eventPage.selectHighlightText(activeTab.id);
                                }
                            });
                        });
					} else {
                        // collapsed selection range means update 
						// the hovered highlight (if possible)
                        var documentId = _contextMenus.getHoveredHighlightId();
						
                        if (documentId) {
                            _eventPage.updateHighlight(activeTab.id,
                                documentId, hd.className);
                        }
						
						return Promise.resolve();
					}
				});
			});
		}	// end switch
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
            return Promise.reject(new Error("Ignoring collapsed range"));
        }

        // not being collapsed is implicit
        delete xpathRange.collapsed;

        return _database.postCreateDocument_Promise(match, xpathRange, className, selectionText).then(function (response) {
            // use the new document's id for the element id of the (first) highlight element
            try {
                return _tabs.sendCreateHighlightMessage_Promise(tabId, xpathRange, className, response.id)
					.then(function (is_created) {
                        // a false response means something went wrong.
						// Delete document from db
                        if (is_created) {
                            // (re) show page action on success
                            chrome.pageAction.show(tabId);
							return Promise.resolve();
                        } else {
                            console.log("Error creating highlight in DOM - Removing associated document");

                            return _database.removeDocument_Promise(response.id, response.rev).then(function () {
								return Promise.reject();
							});
                        }
                    });
            }catch (e){
                console.log("Exception creating highlight in DOM - Removing associated document");

                _database.removeDocument_Promise(response.id, response.rev).then(function () {
					return Promise.reject();
				});
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
        return _database.updateCreateDocument_Promise(documentId, className).then(function (response) {
        	if (!response.ok) {
        		return Promise.reject();
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
     * @param {number} tabId tab id of associated tab, whose DOM should contain the highlight.
     * @param {string} documentId id of the document representing the highlight to remove
     */
    deleteHighlight: function (tabId, documentId) {
        "use strict";
		var inDOM;
		
        // if the highlight isn't in the DOM, then deleting
		// the 'create' document can be done directly,
        // as create never had any effect
        return _eventPage.isHighlightInDOM(tabId, documentId).then(function (result) {
			inDOM = result;

            // check the number of 'create' and 'delete' documents.
			// if equal, there are no highlights for the page,
			// so the page action can be removed
            if (inDOM) {
                console.log("Highlight IS in DOM. Posting 'delete' doc");

                // highlight was in DOM, so we post an 
				// additional 'delete' document
                return _database.postDeleteDocument_Promise(documentId);//, _resultCallback);
            } else {
                // remove directly
                console.log("Highlight IS NOT in DOM. Directly removing 'create' doc");

                return _database.getDocument_Promise(documentId).then(function (doc) {
                    return _database.removeDocument_Promise(
						doc._id, doc._rev);//, _resultCallback);                
                });
            }
        }).then(function (response) {
            /**
             * Callback handler for posting 'delete' doc or removing 'create' doc
             * @param [err]
             * @param {object} response (ok/id/rev)
             * @private
             */
			if (!response.ok) {
				return response;
			}
		
			if (inDOM) {
                console.log("Successfully posted ;delete' document. Removing in DOM");
                _tabs.sendDeleteHighlightMessage_Promise(tabId, documentId);
            } else {
                console.log("Removed 'create' document");
            }

            console.log("reevaluating page action visibility");

			var match;

            // check the number of 'create' and 'delete' documents. 
			// if equal, there are no highlights for the page, 
			// so the page action can be removed
			return new Promise(function(resolve, reject) {
				chrome.tabs.get(tabId, function (tab) {
					resolve(tab);
				});
			}).then(function (tab) {
				match = _database.buildMatchString(tab.url);

                // sum of +create-delete verbs for a specific match
				return _database.getMatchSum_Promise(match);
			}).then(function (sum) {
                if (sum <= 0) {					
                    chrome.pageAction.hide(tabId);
					
					// can delete all documents
					return _database.removeDocuments_Promise(match);
                }
			}).then(function () {
				return response;
			});
        });
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
			response.filter(function(r) {
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
		return new Promise(function(resolve, reject) {
			// get tab object from tab id
			chrome.tabs.get(tabId, function (tab) {
				resolve(tab);
			});
		}).then(function (tab) {
			// build match using tab's url, and get the last document
			var match = _database.buildMatchString(tab.url);
			
			return _database.getDocuments_Promise(match, true);
		}).then(function (docs) {
			// find last 'undoable' document that has not already been
			// negated 
			var deletedDocumentIds = new Set();
			
			var i, len = docs.length;
			for (i=0; i<len; ++i) {
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
					return Promise.reject();
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
    speakHighlightText: function(tabId, documentId, options) {
        "use strict";
        options = options || {};

        return _tabs.sendGetDocumentElementAttributeNodeValue_Promise(tabId, "lang").then( function(lang) {
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
	 * @param {Object} tab one of the available tabs, or active tab if undefined
	 * @param {string} format one of [markdown]
	 * @param {Function} [comparisonPredicate] function that returns a promise
	 *	that resolves to a comparible value
     * @param {Function} [filterPredicate] function that returns true if the doc should be included. Same signature as Array.map
	 * @returns: {Promise} overview correctly formatted as a string
	 */
	getOverviewText: function(format, tab, comparisonPredicate, filterPredicate) {
		var titles = {};
		var promise = (tab && Promise.resolve(tab)) || _tabs.getActiveTab();

		return promise.then(function(_tab) {
			// the actual tab
			tab = _tab;

			return _storage.highlightDefinitions.getAll_Promise();
		}).then(function(items) {
			return items.highlightDefinitions;
		}).then(function(highlightDefinitions) {
			// map the highlight class name to its display name, for later usage
			highlightDefinitions.forEach(function(hd) {
				titles[hd.className] = hd.title;
			});

			// get documents associated with the tab's url
			var match = _database.buildMatchString(tab.url);
			
			return _database.getCreateDocuments_Promise(match);
        }).then(function(docs) {
            // filter
            return (filterPredicate && docs.filter(filterPredicate)) || docs; 
		}).then(function(docs) {
			// sort - main promise (default to native order)
			return (comparisonPredicate && _database.sortDocuments(docs, comparisonPredicate)) ||
				Promise.resolve(docs);
		}).then(function (docs) {
			switch(format) {
			case "markdown":
            case "markdown-no-footer":
				var markdown = "#[" + tab.title + "](" +  tab.url + ")";
				var currentClassName;

				// iterate each highlight
				docs.forEach(function(doc) {
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
