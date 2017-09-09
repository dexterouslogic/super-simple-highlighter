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
        // chrome.runtime.onInstalled.addListener(_eventPage.onRuntimeInstalled);
        // chrome.runtime.onStartup.addListener(_eventPage.onRuntimeStartup);
        // chrome.runtime.onMessage.addListener(_eventPage.onRuntimeMessage);

        // chrome.webNavigation.onCompleted.addListener(_eventPage.onCompleted, {
        //     url: [{
        //         schemes: ['http', 'https', 'file']
        //     }]
        // })

        // // DISABLED UNTIL MOUSE EVENT BUG IS FIXED
        // // chrome.tabs.onActivated.addListener(_eventPage.onActivated);

        // chrome.storage.onChanged.addListener(_eventPage.onStorageChanged);

        // // chrome.contextMenus.onClicked.addListener(_contextMenus.onClicked);

        // chrome.commands.onCommand.addListener(_eventPage.onCommandsCommand);
    },

    /**
     * Fired when the extension is first installed, when the extension is updated to a new version,
     * and when Chrome is updated to a new version.
     * @param {function} details function(object details) {...}
     */
    onRuntimeInstalled: function (details) {
        // ignored promise
        ChromeContextMenus.create()
        // _contextMenus.recreateMenu()

        // one time initialization
        // return _database.putDesignDocuments().then(() => {
        //     // error param might indicate a conflict, which is ok.
        //     // delete stale views associated with design docs
        //     return _database.viewCleanup_Promise();
        // }).then(() => {
        //     _contextMenus.recreateMenu();
        // })
    },

    /**
     * Fired when a profile that has this extension installed first starts up.
     * This event is not fired when an incognito profile is started, even if this
     * extension is operating in 'split' incognito mode.
     */
    onRuntimeStartup: function () {
        // ignored promise
        return ChromeContextMenus.create().then(() => {
            // remove entries in which the number of 'create' doc == number of 'delete' docs
            const db = new DB()
        
            return db.removeAllSuperfluousDocuments().then(() => {
                return db.compactDB()
            })
        })
        // _contextMenus.recreateMenu();

        // // remove entries in which the number of 'create' doc == number of 'delete' docs
        // const db = new DB()

        // return db.removeAllSuperfluousDocuments().then(() => {
        //     return db.compactDB()
        // })




        // return _database.getMatchSums_Promise().then(rows => {
        //     return Promise.all(rows
        //         .filter(row => row.value === 0)
        //         .map(row => _database.removeDocuments_Promise(row.key))
        //     )
        // }).then(() => _database.compact())
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
            return Promise.resolve()
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
        const db = new DB()

        let match = DB.formatMatch(details.url)
        let matchedDocs

        return db.getMatchingDocuments(match).then(docs => {
            matchedDocs = docs
            console.log("Matched " + matchedDocs.length + " document(s) with '" + match + "'");

            // configure and show page action
            if (matchedDocs.length === 0) {
                return;
            }

            const doc = matchedDocs[0]

            // if the first document is a 'create' document without a title, update it now
            if (doc[DB.DOCUMENT.NAME.VERB] === 'create' &&
                 typeof doc[DB.DOCUMENT.NAME.TITLE] === 'undefined') {
                // promise resolves when tab title obtained
                return new Promise((resolve) => {
                    chrome.tabs.get(details.tabId, ({title, url}) => {
                        // ignore tabs where the title == url (i.e. not explicity defined)
                        if (title === url) {
                            resolve()
                            return
                        }

                        db.updateCreateDocument(doc._id, { title: title }).then(() => {
                            resolve()
                        })
                    })
                })
            } else {
                return Promise.resolve()
            }
        }).then(() => {
            const tabs = new ChromeTabs(details.tabId)
            // set of ids of 'create' documents that reported errors, and did NOT have a corresponding
            // 'delete' document (i.e. implying it's not really an error)
            const errorCreateDocIds = new Set()
                
            return tabs.executeDefaultScript().then(() => {
                return new ChromeTabs(details.tabId).playbackDocuments(matchedDocs, errorDoc => {
                    // method only called if there's an error. called multiple times
                    if (errorDoc[DB.DOCUMENT.NAME.VERB] === DB.DOCUMENT.VERB.CREATE) {
                        errorCreateDocIds.add(errorDoc._id)
                    }
                })
            }).then(sum => {
                if (errorCreateDocIds.size > 0) {
                    // remove 'create' docs for which a matching 'delete' doc exists
                    for (const doc of matchedDocs.filter(d => d[DB.DOCUMENT.NAME.VERB] === DB.DOCUMENT.VERB.DELETE)) {
                        errorCreateDocIds.delete(doc.correspondingDocumentId)

                        if (errorCreateDocIds.size === 0) {
                            break
                        }
                    }

                    // any remaining entries are genuinely invalid
                    if (errorCreateDocIds.size > 0) {
                        _eventPage.setPageActionStatus(details.tabId, true)

                        console.warn(`Error replaying ${errorCreateDocIds.size} 'create' document(s) [${Array.from(errorCreateDocIds).join('\n')}]`
                        )
                    }
                }

                if (sum > 0) {
                    chrome.pageAction.show(details.tabId);
                }
            })
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
            case "delete_highlight":
                // message.highlightId is the document id to be deleted
                return ChromeTabs.queryActiveTab().then(tab => {
                    if (!tab) {
                        return
                    }

                    return new Highlighter(tab.id).delete(message.highlightId)
                })

            default:
                throw `Unhandled message: sender=${sender}, id=${message.id}`
        }
    },

    /**
     * A value in the synced storage changed
     * @param changes
     * @param namespace
     */
    onStorageChanged: function (changes, namespace) {
        // Content of context menu depends on the highlight styles
        if (namespace !== 'sync' || !changes.highlightDefinitions) {
            return
        }

        // unhandled promise
        return ChromeContextMenus.create()

        // if (namespace === "sync") {
        //     if (changes.highlightDefinitions) {
        //         _contextMenus.recreateMenu();
        //     }
        // }
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
                return ChromeTabs.queryActiveTab().then(tab => {
                    if (!tab) {
                        return
                    }

                    return new ChromeTabs(tab.id).getHoveredHighlightID().then(docId => {
                        if (!docId) {
                            return
                        }
                        
                        return new Highlighter(tab.id).delete(docId)
                    })
                })

            case "undo_last_create_highlight":
                return ChromeTabs.queryActiveTab().then(tab => {
                    if (!tab) {
                        return 
                    }

                    return new Highlighter(tab.id).undo()
                })

            // case "copy_overview":
            //     // use the sort defined by the popup
            //     return new ChromeStorage().get([
            //         ChromeStorage.KEYS.HIGHLIGHT.SORT_BY,
            //         ChromeStorage.KEYS.HIGHLIGHT.INVERT_SORT
            //     ]).then(items => {
            //         return ChromeTabs.queryActiveTab().then(tab => {
            //             if (!tab) {
            //                 return Promise.reject(new Error("no active tab"))
            //             }

            //             const comparator = _tabs.getComparisonFunction(
            //                 tab.id,
            //                 items[ChromeStorage.KEYS.HIGHLIGHT.SORT_BY]
            //             )

            //             return _eventPage.getOverviewText(
            //                 "markdown", tab, comparator,
            //                 undefined, items[ChromeStorage.KEYS.HIGHLIGHT.INVERT_SORT]
            //             )
            //         })
            //     }).then(text => _eventPage.copyText(text))

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
                    
                    return ChromeTabs.queryActiveTab()
                }).then(tab => {
                    if (!tab) {
                        return Promise.reject(new Error('no active tab'))
                    }

                    const match = DB.formatMatch(tab.url)
                    if (!match) {
                        return Promise.reject(new Error());
                    }

                    const tabs = new ChromeTabs(tab.id)
                    const storage = new ChromeStorage()

                    return tabs.getSelectionRange().then(xrange => {
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
                                return $.createHighlight(
                                    tab.id,
                                    xrange,
                                    DB.formatMatch(tab.url),
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
                                        return new Highlighter(tab.id).update(docId, highlightClassName)
                                    } 

                                    // the 'toggle' nature of this means it only makes sense 'unselectAfterHighlight' is true.
                                    // Otherwise it's too easy to make multiple highlights over the same range.
                                    return storage.get(ChromeStorage.KEYS.UNSELECT_AFTER_HIGHLIGHT).then(value => {
                                        if (!value) {
                                            return
                                        }

                                        // remove the highlight, then select the text it spanned
                                        return new Highlighter(tab.id).delete(docId).then(() => {
                                            return tabs.selectRange(doc[DB.DOCUMENT.NAME.RANGE])
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
     * @param {number} tabId - id of tab to send message to, to create highlight in DOM
     * @param {Object} xrange - range of highlight
     * @param match match string to identify related highlights. Usually processed from url
     * @param selectionText associated text
     * @param className class name to apply to DOM element, and in database also
     * @returns {Promise}
     */
    createHighlight: function (tabId, xrange, match, selectionText, className) {
        "use strict";
        if (xrange.collapsed) {
            return Promise.reject(new Error("Collapsed range"));
        }

        // shared between promises
        let newDoc = {}
        const db = new DB()

        // if this is the first create document to be posted, we want the title too
        return db.getMatchingSum(match).then(sum => {
            if (sum != 0) {
                // resolve to undefined title
                return Promise.resolve()
            }

            // resolve to tab's title
            return new Promise(resolve => { chrome.tabs.get(tabId, tab => { resolve(tab) }) })
        }).then(tab => {
            // not being collapsed is implicit
            delete xrange.collapsed;

            // ignore tabs where the title == url (i.e. not explicity defined)
            return db.putCreateDocument(match, xrange, className, selectionText, {
                title: (tab && tab.title !== tab.url && tab.title) || undefined
            })
        }).then(response => {
            newDoc = {
                id: response.id,
                rev: response.rev
            }

            // use the new document's id for the element id of the (first) highlight element
            try {
                return new ChromeTabs(tabId).createHighlight(xrange, className, response.id)
            } catch (e) {
                // always rejects
                return db.removeDB(response.id, response.rev).then(() => {
                    return Promise.reject(new Error(`Exception creating highlight in DOM - Removing associated document: ${e}`))
                })
            }
        }).then(ok => {
            // a false response means something went wrong.
            // Delete document from db
            if (!ok) {
                // always rejects
                return db.removeDB(newDoc.id, newDoc.rev).then(() => {
                    return Promise.reject(new Error(`Error creating highlight in DOM - Removing associated document`))
                })
            }

            // (re) show page action on success
            chrome.pageAction.show(tabId);
        })
    },

    /**
     * Update the highlight by changing its class name, first by revising its 'create' document, then in DOM
     * 
     * @param {number} tabId - id of tab containing highlight
     * @param {string} docId - id of 'create' document to change
     * @param {string} className - new class name defining highlight style
     */
    updateHighlight: function (tabId, docId, className) {
        return new DB().updateCreateDocument(docId, { className: className }).then(({ok}) => {
            if (!ok) {
                return Promise.reject(new Error("Response not OK"));
            }

            // document updated - now update DOM
            return new ChromeTabs(tabId).updateHighlight(docId, className)
        }).then(ok => {
            if (!ok) {
                return Promise.reject(new Error("Error updating highlight in DOM"));
            }
        });
    },

    /**
     * Delete a highlight in the database, and in the page DOM
     * 
     * @param {Array<number>|number} [tabIds] id or array of ids of tabs of associated tabs, whose DOM should contain the highlight.  If undefined, query api for tab with match name.
     * @param {string} docId id of the document representing the highlight to remove
     */
    deleteHighlight: function (tabIds, docId) {
        tabIds = (typeof tabIds === 'number' && [tabIds]) || tabIds

        // match property of the document representing the highlight to be deleted
        let match
        const db = new DB()

        // make sure original document exists, and store its 'match' property
        return db.getDocument(docId).then(doc => {
            console.assert(doc.verb === 'create')

            match = doc.match

            // if its also the last 'create' document we can delete it directly
            return db.getMatchingDocuments(match, { 
                descending: false, 
                verbs: DB.DOCUMENT.VERB.CREATE
            }).then(docs => {
                console.assert(docs.length >= 1)
                const lastDoc = docs[docs.length - 1]

                // if the last non-delete document was our 'create' doc we can delete directly
                if (lastDoc._id === doc._id) {
                    console.log('Highlight is the latest "create" document - removing directly')
                    return db.removeDB(doc._id, doc._rev)
                } else {
                    // post an additional 'delete' document
                    return db.postDeleteDocument(docId)
                }
            })
        }).then(({ok}) => {
            if (!ok) {
                // 'delete' document wasn't posted
                return Promise.reject(new Error("Error removing document"))
            }

            // if the tab id is undefined, *try* to query it from the match title
            if (typeof tabIds === 'undefined') {
                return ChromeTabs.query({
                    url: encodeURI(match),
                    status: 'complete'
                }).then(tabs => {
                    tabIds = tabs.map(tab => tab.id).filter(tabId => tabId !== chrome.tabs.TAB_ID_NONE)
                })
            }
        }).then(() => {
            // if tab specified, try and remove highlight from DOM (result ignored)
            if (Array.isArray(tabIds)) {
                // ignores errors
                return Promise.all(tabIds.map(tabId => {
                    return new ChromeTabs(tabId).deleteHighlight(docId).catch(() => { /* */ })
                }))
            }
        }).then(() => {
            // Get sum of create(+1) & delete(-1) verbs for a specific match
            // If equal, there are no highlights for the page, so the page action can be removed,
            // and the remaining documents are useless
            return db.getMatchingSum(match)
        }).then(sum => {
            console.log(`Sum: ${sum} [${match}]`);

            if (sum > 0) {
                // empty doc implies no matching documents needed to be removed (not an error)
                return []
            }

            console.log(`Removing all documents for ${match}`);

            if (Array.isArray(tabIds)) {
                for (const id of tabIds) {
                    chrome.pageAction.hide(id)
                }
            }

            // can delete all documents (for this match)
            // return array of objects {ok,id,rev} for each removed doc
            return db.removeMatchingDocuments(match)
        })
    },

    /**
     * Delete all documents associated with a 'match'
     * 
     * @param {number} tabId
     * @param {string} match
     */
    deleteHighlights: function (tabId, match) {
        return new DB().removeMatchingDocuments(match).then(response => {
            chrome.pageAction.hide(tabId)

            // Response is an array containing the id and rev of each deleted document.
            // We can use id to remove highlights in the DOM (although some won't match)
            const tabs = new ChromeTabs(tabId)

            return Promise.all(response
                .filter(r => r.ok)
                .map(({id}) => tabs.deleteHighlight(id))
            )
        })
    },

	/**
	 * Undo the last undoable document in the journal (by negating it)
	 */
    undoLastHighlight: function (tabId) {
        return new Promise(resolve => {
            // get tab object from tab id
            chrome.tabs.get(tabId, tab => resolve(tab))
        }).then(({url}) => {
            // build match using tab's url, and get the last document
            const match = DB.formatMatch(url)

            return new DB().getMatchingDocuments(match, { descending: true })
        }).then(docs => {
            // find last 'undoable' document that has not already been negated 
            let deletedDocIds = new Set()
            let highlighter = new Highlighter(tabId)

            for (const doc of docs) {
                switch (doc.verb) {
                    case DB.DOCUMENT.VERB.DELETE:
                        deletedDocIds.add(doc.correspondingDocumentId)
                        break
                
                    case DB.DOCUMENT.VERB.CREATE:
                        // is it already deleted?
                        if (!deletedDocIds.has(doc._id)) {
                            // add a negating document
                            return highlighter.delete(doc._id)
                        }
                        break

                    default:
                        console.error(`unknown verb ${doc.verb}`)
                }
            }

            return Promise.reject(new Error("No create documents to undo."))

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

    // /**
    //  * Select the text associated with a highlight
    //  * 
    //  * @param {number} tabId
    //  * @param {string} [highlightId] if undefined, remove selection
    //  */
    // selectHighlightText: function (tabId, highlightId) {
    //     return new ChromeTabs(tabId).selectHighlight(highlightId)
    // },

    /**
     * Copy the text associated with a highlight to the clipboard
     * @param {string} docId
     */
    copyHighlightText: function (docId) {
        return new DB().getDocument(docId).then(doc => {
            if (!doc.text) {
                return
            }

            if (!_eventPage.copyText(doc.text)) {
                return Promise.reject(new Error());
            }
        })
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
     * 
     * @param {number} tabId - id of tab from which document element's 'lang' property defines the language to speak
     * @param {string} docId - id of document containing 'text' property for text to speak
     * @param {Object} [options] - chrome.tts.speech options
     */
    speakHighlightText: function (tabId, docId, options) {
        "use strict";
        const speakOptions = Object.assign({}, options || {})

        return new ChromeTabs(tabId).getNodeAttributeValue('/*', 'lang').then(lang => {
            if (typeof lang === "string") {
                speakOptions.lang = lang
            }

            return new DB().getDocument(docId)
        }).then(({text}) => {
            if (typeof text !== "string") {
                return Promise.reject(new Error('unable to get text to speak'))
            }

            // workaround for Google Deutsch becoming the default voice, for some reason
            chrome.tts.speak(text, speakOptions)
        })
    },

    // /**
    //  * Ask DOM if a highlight with this id exists
    //  * @param {number} tabId
    //  * @param {string} documentId
    //  * @param {function} [responseCallback] function(boolean)
    //  */
    // isHighlightInDOM: function (tabId, documentId) {
    //     "use strict";
    //     return _tabs.sendIsHighlightInDOMMessage_Promise(tabId, documentId);
    // },

    /**
     * Scroll DOM to a highlight
     * @param tabId
     * @param documentId
     * @param {function} responseCallback function(boolean)
     */
    // scrollTo: function (tabId, documentId) {
    //     "use strict";
    //     return _tabs.sendScrollToMessage_Promise(tabId, documentId);
    // },

	/**
	 * Get an overiew of the highlights for the current page
     * 
	 * @param {Object} tab one of the available tabs, or active tab if undefined
	 * @param {string} format one of [markdown]
	 * @param {Function} [comparator] function that returns a promise that resolves to a comparible value
     * @param {Function} [filterPredicate] function that returns true if the doc should be included. Same signature as Array.map
     * @param {Boolean} [invert] invert the document order
	 * @returns {Promise<string>} overview correctly formatted as a string
	 */
    getOverviewText: function (format, tab, comparator, filterPredicate, invert) {
        var titles = {};
        const queryTabPromise = (tab && Promise.resolve(tab)) || ChromeTabs.queryActiveTab()

        return queryTabPromise.then(t => {
            if (!t) {
                return Promise.reject(new Error("no tab"))
            }

            tab = t;

            return new ChromeHighlightStorage().getAll().then(items => items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS])
        }).then(definitions => {
            // map the highlight class name to its display name, for later usage
            for (const d of definitions) {
                titles[d.className] = d.title
            }

            // get documents associated with the tab's url
            const match = DB.formatMatch(tab.url)

            // get only the create docs that don't have matched delete doc
            return new DB().getMatchingDocuments(match, { excludeDeletedDocs: true })
        }).then(function (docs) {
            // filter
            return (filterPredicate && docs.filter(filterPredicate)) || docs
        }).then(function (docs) {
            // sort - main promise (default to native order)
            return (comparator && DB.sortDocuments(docs, comparator)) || Promise.resolve(docs)
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
