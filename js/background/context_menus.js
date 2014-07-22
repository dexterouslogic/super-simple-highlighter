/*global _storage, _database, _tabs, _eventPage, _highlightDefinitions*/

var _contextMenus = {
    /**
     * id of highlight (aka documentId) for the currently mouse-over highlight
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
     * Remove and recreate menus, based on current state
     */
    recreateMenu: function () {
        "use strict";
        // do all the async work beforehand, to prepare for the actual update
        _highlightDefinitions.getAll(function (items) {
            // if we're hovering over a highlight, we need the corresponding class to check the radio item
            if (_contextMenus.hoveredHighlightId) {
                _database.getDocument(_contextMenus.hoveredHighlightId, function (err, doc) {
                    if (doc) {
                        _contextMenus._recreateMenu(items.highlightDefinitions, doc);
                    }
                });
            } else {
                _contextMenus._recreateMenu(items.highlightDefinitions);
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

        // required parent
        var parentId = chrome.contextMenus.create({
            "id": "sos",
            "title": chrome.runtime.getManifest().name,
            "contexts": _contextMenus.hoveredHighlightId ? ["all"] : ["selection"]
        });

        // update or create?
        if (doc) {
            // should be a 'create' verb in the document
            if (doc.verb !== "create") {
                throw "Unknown verb: " + doc.verb;
            }

            // add a radio item for each highlight style
            highlightDefinitions.forEach(function (h) {
                chrome.contextMenus.create({
                    type: "radio",
                    id: "update_highlight." + h.className,
                    parentId: parentId,
                    title: h.title,
                    contexts: ["all"],
                    checked: doc.className === h.className
                });
            });

            // --
            chrome.contextMenus.create({
                id: "sep1",
                parentId: parentId,
                type: "separator",
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
        } else {
            // standard items for creating new highlight using the selection
            highlightDefinitions.forEach(function (h) {
                // form title, with optional hotkey suffix
                var title = h.title;
                if (h.hotkey && h.hotkey.length > 0) {
                    title += " [" + h.hotkey + "]";
                }

                chrome.contextMenus.create({
                    type: "normal",
                    id: "create_highlight." + h.className,
                    parentId: parentId,
                    title: title,
                    contexts: ["selection"]
                });
            });
        }
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
                // get the selection range (_xpath) from content script
                _tabs.sendGetSelectionRangeMessage(tab.id, function (xpathRange) {
                    if (xpathRange) {
                        // create new document for highlight, then update DOM
                        _eventPage.createHighlight(tab.id,
                            xpathRange, _database.buildMatchString(tab.url),
                            info.selectionText, className);
                    }
                });
                break;

            case "update_highlight":
                if (_contextMenus.hoveredHighlightId) {
                    _eventPage.updateHighlight(tab.id,
                        _contextMenus.hoveredHighlightId, className);
                }
                break;

            default:
                throw "Unhandled menu item id: " + info.menuItemId;
            }

            return;
        }

        // default (constant ids)
        switch (info.menuItemId) {
        case "copy_highlight_text":
            if (_contextMenus.hoveredHighlightId) {
                _eventPage.copyHighlightText(_contextMenus.hoveredHighlightId);
            }
            break;

        case "speak_highlight_text":
            if (_contextMenus.hoveredHighlightId) {
                _eventPage.speakHighlightText(_contextMenus.hoveredHighlightId);
            }
            break;

        case "delete_highlight":
            if (_contextMenus.hoveredHighlightId) {
                _eventPage.deleteHighlight(tab.id,
                    _contextMenus.hoveredHighlightId);
            }
            break;

        default:
            throw "Unhandled menu item. id=" + info.menuItemId;
        }
    }
};