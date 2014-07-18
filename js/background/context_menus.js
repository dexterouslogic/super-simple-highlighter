/*global _storage, _database, _tabs, _eventPage*/

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
        _contextMenus.updateMenus();
    },

    /**
     * Using the current state (storage, hover etc), (re)populate the context menu
     */
    updateMenus: function () {
        "use strict";
        chrome.contextMenus.removeAll(function () {
            // required parent
            var parentId = chrome.contextMenus.create({
                "id": "sos",
                "title": chrome.runtime.getManifest().name,
                "contexts": _contextMenus.hoveredHighlightId ? ["all"] : ["selection"]
            });

            // one menu item per highlight style entry
            _highlightDefinitions.getAll(function (items) {
                if (!items.highlightDefinitions) {
                    return;
                }

                // context depends on whether hovering highlight.

                // if we're hovering over a highlight, we need the corresponding class to check the radio item
                if (_contextMenus.hoveredHighlightId) {
                    _database.getDatabase().get(_contextMenus.hoveredHighlightId).then(function (doc) {
                        // should be a 'create' verb in the document
                        if (doc.verb !== "create") {
                            throw "Unknown verb: " + doc.verb;
                        }

                        // add a radio item for each highlight style
                        items.highlightDefinitions.forEach(function (h) {
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
                            title: "Copy",
                            contexts: ["all"]
                        });

                        // say
                        chrome.contextMenus.create({
                            id: "speak_highlight_text",
                            parentId: parentId,
                            title: "Speak",
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
                            title: "Remove",
                            contexts: ["all"]
                        });
                    });
                } else {
                    // standard items for creating new highlight using the selection
                    items.highlightDefinitions.forEach(function (h) {
                        chrome.contextMenus.create({
                            type: "normal",
                            id: "create_highlight." + h.className,
                            parentId: parentId,
                            title: h.title,
                            contexts: ["selection"]
                        });
                    });
                }
            }); // end storage.getAll()
        }); // end chrome.contextMenus.removeAll()
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
                            xpathRange, _database.getMatch(tab.url),
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

            case "say_highlight":

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