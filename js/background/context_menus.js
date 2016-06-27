/*global _storage, _database, _tabs, _eventPage, _storage*/

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

var _contextMenus = {
    /**
     * id of highlight (aka documentId) for the currently mouse-over highlight
     * @private
     */
    hoveredHighlightId: null,

    /**
     * Setter for currently hovered highlight. Recreates context menu each time
     * @param id highlightId (aka doc id) of hovered item, or null for leave.
     */
    setHoveredHighlightId: function (id) {
        "use strict";
        _contextMenus.hoveredHighlightId = id;
        _contextMenus.recreateMenu();
    },

    /**
     * Get the currently hovered highlight id
     * @return {string|null|undefined}
     */
    getHoveredHighlightId: function () {
        "use strict";
        return _contextMenus.hoveredHighlightId;
    },

    /**
     * Remove and recreate menus, based on current state
     */
    recreateMenu: function () {
        "use strict";
        // do all the async work beforehand, to prepare for the actual update
        return _storage.highlightDefinitions.getAll_Promise().then(function (items) {
            // if we're hovering over a highlight, we need the corresponding class to check the radio item
            if (_contextMenus.hoveredHighlightId) {
                return _database.getDocument_Promise(_contextMenus.hoveredHighlightId).then(function (doc) {
                    _contextMenus._recreateMenu(items.highlightDefinitions, doc);
                });
            } else {
                return _contextMenus._recreateMenu(items.highlightDefinitions);
            }
        });
    },

    /**
     * Worker function for {@link recreateMenu}
     * @param {Array} highlightDefinitions
     * @param {object} [doc]
     * @private
     */
    _recreateMenu: function (highlightDefinitions, doc) {
        "use strict";

        chrome.contextMenus.removeAll();

        if (doc) {
            // should be a 'create' verb in the document
            if (doc.verb !== "create") {
                throw "Unknown verb: " + doc.verb;
            }
        }

        // required parent
        var parentId = chrome.contextMenus.create({
            "id": "sos",
            "title": chrome.runtime.getManifest().name,
            "contexts": _contextMenus.hoveredHighlightId ? ["all"] : ["selection"]
        });

        // required to find shortcut keys
		return new Promise(function (resolve, reject) {
	        chrome.commands.getAll(function (commands) {
	            for (var i=0; i < highlightDefinitions.length; i++) {
	                var hd = highlightDefinitions[i];

	                var title = hd.title;
	                // find the matching shortcut, if possible
	                var shortcut = (i < commands.length ? commands[i].shortcut : null);
	                if (shortcut && shortcut.length > 0) {
	                    title += " [" + shortcut + "]";
	                }

	                // existence of doc means use update-type commands
	                var options = {
	                    type: doc ? "radio" : "normal",
	                    id: (doc ? "update_highlight." : "create_highlight.") + hd.className,
	                    parentId: parentId,
	                    title: title,
	                    contexts: doc ? ["all"] : ["selection"]
	                };

	                if (doc) {
	                    options.checked = doc.className === hd.className;
	                }

	                chrome.contextMenus.create(options);
	            }

	            if (doc) {
	                // --
	                chrome.contextMenus.create({
	                    id: "sep1",
	                    parentId: parentId,
	                    type: "separator",
	                    contexts: ["all"]
	                });

	                // select
	                chrome.contextMenus.create({
	                    id: "select_highlight_text",
	                    parentId: parentId,
	                    title: chrome.i18n.getMessage("select_highlight_text"),
	                    contexts: ["all"]
	                });

	                // copy
	                chrome.contextMenus.create({
	                    id: "copy_highlight_text",
	                    parentId: parentId,
	                    title: chrome.i18n.getMessage("copy_highlight_text"),
	                    contexts: ["all"]
	                });

	                // say
	                chrome.contextMenus.create({
	                    id: "speak_highlight_text",
	                    parentId: parentId,
	                    title: chrome.i18n.getMessage("speak_highlight_text"),
	                    contexts: ["all"]
	                });

	                // --
	                chrome.contextMenus.create({
	                    id: "sep2",
	                    parentId: parentId,
	                    type: "separator",
	                    contexts: ["all"]
	                });

	                // Remove
	                chrome.contextMenus.create({
	                    id: "delete_highlight",
	                    parentId: parentId,
	                    title: chrome.i18n.getMessage("delete_highlight"),
	                    contexts: ["all"]
	                });
	            }
				
				resolve();
	        });
		});
        
    },


    /**
     * Fired when our context menu on the page is clicked
     * @param info
     * @param tab
     */
    onClicked: function (info, tab) {
        "use strict";
        // check for id in format 'something.className'
        var re = new RegExp("^(.+)\\.(.+)");
        var match = re.exec(info.menuItemId);

        if (match && match.length === 3) {
            var className = match[2];

            switch (match[1]) {
            case "create_highlight":
                if (info.editable) {
                    window.alert(chrome.i18n.getMessage("alert_create_highlight_in_editable"));
                    return Promise.reject();
                }

                // can't create highlight in frames that aren't top level frames, or in editable textareas
                if (info.frameUrl && info.frameUrl !== tab.url){
                    window.alert(chrome.i18n.getMessage("alert_create_highlight_in_subframe"));
                    return Promise.reject();
                }

                // get the selection range (_xpath) from content script
				return _tabs.sendGetSelectionRangeMessage_Promise(tab.id).then(function (xpathRange) {
					if (xpathRange.collapsed) {
						return Promise.reject();
					}
					
                    // create new document for highlight, then update DOM
                    return _eventPage.createHighlight(tab.id,
                        xpathRange, _database.buildMatchString(tab.url, info.frameUrl),
                        info.selectionText, className);
				}).then(function () {
                    // remove selection?
                    return _storage.getUnselectAfterHighlight_Promise();
				}).then(function (unselect) {
                   if (unselect) {
                       // unselect all
                      return _eventPage.selectHighlightText(tab.id);
                   }
                });

            case "update_highlight":
                if (_contextMenus.hoveredHighlightId) {
                    return _eventPage.updateHighlight(tab.id,
                        _contextMenus.hoveredHighlightId, className);
                } else {
                	return Promise.reject();
                }
                break;

            default:
                throw "Unhandled menu item id: " + info.menuItemId;
            }
        }

        // default (constant ids)
        switch (info.menuItemId) {
        case "select_highlight_text":
            if (_contextMenus.hoveredHighlightId) {
                return _eventPage.selectHighlightText(
					tab.id, _contextMenus.hoveredHighlightId);
            }
            break;

        case "copy_highlight_text":
            if (_contextMenus.hoveredHighlightId) {
                return _eventPage.copyHighlightText(
					_contextMenus.hoveredHighlightId);
            }
            break;

        case "speak_highlight_text":
            if (_contextMenus.hoveredHighlightId) {
                return _eventPage.speakHighlightText(
					tab.id, _contextMenus.hoveredHighlightId);
            }
            break;

        case "delete_highlight":
            if (_contextMenus.hoveredHighlightId) {
                return _eventPage.deleteHighlight(tab.id,
                    _contextMenus.hoveredHighlightId);
            }
            break;

        default:
            throw "Unhandled menu item. id=" + info.menuItemId;
        }
		
		return Promise.reject();
    }
};