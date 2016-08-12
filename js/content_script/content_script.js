/*global _stringUtils, _stylesheet, _storage, document, window, _highlighter, _xpath, _storage*/

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

var _contentScript  = {
    /**
     * A random string applied as an additional class name to all highlights,
     * allowing .on() event handling, and shared style
     */
    highlightClassName: null,

    /**
     * Called when the script loads
     */
    init: function () {
        "use strict";
        // create a random class name
        _contentScript.highlightClassName = _stringUtils.createUUID({beginWithLetter: true});

        // the rules for the close button, which must be a child of this class
        _stylesheet.setCloseButtonStyle(_contentScript.highlightClassName);

//        document.body.style.backgroundColor = "#ffd";

        // listen for changes to styles
        chrome.storage.onChanged.addListener(_contentScript.onStorageChanged);

        // fake a change for initial update
        _contentScript.resetStylesheetHighlightStyle();

        // listen for messages from event page
        chrome.runtime.onMessage.addListener(_contentScript.onRuntimeMessage);

        // because .on() expects the element to be in the DOM, use delegated events
        // http://stackoverflow.com/questions/9827095/is-it-possible-to-use-jquery-on-and-hover

        $(document).on({
            mouseenter: function () {
                console.log("entre");

                // the handler applies to all spans of the highlight, so first look for 'firstSpan' (which should
                // have the 'closeable' class)
                var firstSpan = $(this).prop('firstSpan');
                // var bg = $(firstSpan).css('background-color');

                // remove hysteresis timer from the first span
                if (firstSpan.mouseLeaveHysteresisTimeoutID != null) {
                    // cancel scheduled out transition
                    clearTimeout(firstSpan.mouseLeaveHysteresisTimeoutID);

                    firstSpan.mouseLeaveHysteresisTimeoutID = null;
                }

                // transition in
                $(firstSpan).find('.close').css({
                    'opacity': 1,
                    'transform': 'scale(1.0)'
                });
            },

            mouseleave: function () {
                console.log("quitter")
                
                var firstSpan = $(this).prop('firstSpan');
                var $close = $(firstSpan).find('.close');

                // add a timeout once we leave the element. If we return we cancel the transition out
                firstSpan.mouseLeaveHysteresisTimeoutID = setTimeout(function() {
                    // transition out wasn't cancelled, so do it
                    firstSpan.mouseLeaveHysteresisTimeoutID = null;

                    $close.css({
                        'opacity': 0,
                        'transform': 'scale(0.6)'
                    });
                }, 1000);
            }
        }, "." + _contentScript.highlightClassName); 

        $(document).on({
            click: function (event) {
                event.preventDefault();

                // parent should be a span with an id corresponding the the document id of the highlight
                var firstSpan = this.parentElement;
                var highlightId = _contentScript._getHighlightId(firstSpan);

                if (!highlightId) {
                    return
                }

                // wait until button disappears before sending message to remove highlight
                this.addEventListener("transitionend", function(event) {
                    if (event.propertyName !== "opacity") {
                        return;
                    }

                    // tell event page to delete the highlight
                    chrome.runtime.sendMessage({
                        id: "on_click_delete_highlight",
                        highlightId: highlightId
                    });
                }, false);

                // transition out
                $(this).css({
                    'opacity': 0,
                    'transform': 'scale(5)'
                })
            }
        }, "." + _contentScript.highlightClassName + ".closeable .close"); 

		// OLD ROUTINE (not used because we don't want to wake event page')
        // $(document).on({
        //     mouseenter: _contentScript.onMouseEnterHighlight,
        //     mouseleave: _contentScript.onMouseLeaveHighlight,
        // }, "span." + _contentScript.highlightClassName);
    },



    isSelectionCollapsed: function () {
        "use strict";
        return window.getSelection().isCollapsed;
    },

    /**
     * Get text selection range
     * @return {Range}. If the selection is collapsed, a fake collapsed range is created
     */
    getSelectionRange: function () {
        "use strict";
        var selection = window.getSelection();
        var range;

        if (selection.isCollapsed) {
            // a fake range
            range = new Range();
            range.collapse(false);
        } else {
            range = selection.getRangeAt(0);
        }

        return range;
    },

    /**
     * Highlight part of the DOM, identified by the selection
     * @param xpathRange
     * @param id id to set on the first span of the highlight
     * @param className
     * @return {*} span of highlight list, or null on error
     */
    createHighlight: function (xpathRange, id, className) {
        "use strict";
        var range;

        // this is likely to cause exception when the underlying DOM has changed
        try {
            range = _xpath.createRangeFromXPathRange(xpathRange);
        } catch (err) {
            console.log("Exception parsing xpath range: " + err.message);
            return null;
        }

        if (!range) {
            console.log("error parsing xpathRange: " + xpathRange);
            return null;
        }

        // create span(s), with 2 class names
        var highlightElement = _highlighter.create(range, id, [
            _contentScript.highlightClassName,
            className
        ]);

        // enable tabbing
        highlightElement.setAttribute("tabindex", "0");

        // 1 - only the first of the chain of spans should get the closeable class
        highlightElement.classList.add("closeable");

        // 2 - add 'close' span to the element
        var closeElement = document.createElement("SPAN");
        
        closeElement.className = "close";

        highlightElement.appendChild(closeElement);
    },

    /**
     * Delete a previously created highlight
     * @param {string} id id of the first element of the list of spans that a highlight consists of.
     */
    deleteHighlight: function (id) {
        "use strict";
        return _highlighter.del(id);
    },

    /**
     * Select the text associated with the span(s) of a highlight
     * @param {string} [id] highlight id
     * @return {Range} range which was selected, or undefined if id param was !
     */
    selectHighlight: function (id) {
        "use strict";
        var selection = window.getSelection();

        selection.removeAllRanges();

        if (id) {
            var range = _highlighter.getRange(id);
            selection.addRange(range);

            return range;
        }
    },

    /**
     * Check whether a highlight with this id is on the page
     * @param {string} id
     * @return {boolean} true if on page
     */
    isHighlightInDOM: function (id) {
        "use strict";
        return $('#' + id).length === 1;
    },
	
	getBoundingClientRect: function (id) {
		"use strict"
		return $('#' + id)[0].getBoundingClientRect()
	},

    /**
     * Update the class name for all the spans of a highlight
     * @param id existing highlight id
     * @param className class name to replace
     */
    updateHighlight: function (id, className) {
        // remember to also include the shared highlights class name
        "use strict";
        return _highlighter.update(id, [_contentScript.highlightClassName, className]);
    },

    /**
     * Scroll DOM to top of an element
     * @param {Object} selector element selector
     * @return {boolean} true if selector matched an element
     */
    scrollTo: function (selector) {
        "use strict";
        var $elm = $(selector);
        if ($elm) {
			var elmOffset = $elm.offset().top;
			var elmHeight = $elm.height();
			var windowHeight = window.innerHeight;// $(window).height();
			var offset;

			if (elmHeight < windowHeight) {
				   offset = elmOffset - ((windowHeight / 2) - (elmHeight / 2));
			} else {
				   offset = elmOffset;
			}

			$('body').animate({
				'scrollTop': offset
			}, 'slow');        
        }

        return $elm !== null;
    },

    /**
     * Fired when a message is sent from either an extension process or a content script.
     *
     * NB: sendResponse is a function to call (at most once) when you have a response.
     * The argument should be any JSON-ifiable object.
     * If you have more than one onMessage listener in the same document, then only one may send a response.
     * This function becomes invalid when the event listener returns, unless you return true from the event listener to
     * indicate you wish to send a response asynchronously (this will keep the message channel open to the other end
     * until sendResponse is called).
     */
    onRuntimeMessage: function (message, sender, sendResponse) {
        "use strict";
        var response;

        switch (message.id) {
        case "create_highlight":
            // the caller specifies the id to use for the first span of the highlight,
            // so it can identify it to remove it later
            response = _contentScript.createHighlight(message.range,
                message.highlightId, message.className) !== null;
            break;

        case "update_highlight":
            response = _contentScript.updateHighlight(message.highlightId, message.className);
            break;

        case "delete_highlight":
            // returns boolean true on success, false on error
            response = _contentScript.deleteHighlight(message.highlightId);
            break;

        case "select_highlight":
            // if highlightId is null, selection is cleared (no result)
            range = _contentScript.selectHighlight(message.highlightId);

            // else response undefined
            if (message.highlightId) {
                response = _xpath.createXPathRangeFromRange(range);
            }
//            response = _xpath.createXPathRangeFromRange(
//                _contentScript.selectHighlight(message.highlightId));
            break;

        case "is_highlight_in_dom":
            response = _contentScript.isHighlightInDOM(message.highlightId);
            break;

        case "get_selection_range":
            response = _xpath.createXPathRangeFromRange(_contentScript.getSelectionRange());
            break;

        case "get_range_text":
            var range = _xpath.createRangeFromXPathRange(message.range);
            response = range ? range.toString() : null;
            break;

        case "scroll_to":
            response = _contentScript.scrollTo("#" + message.fragment);
            break;

		case "get_bounding_client_rect":
			var rect = _contentScript.getBoundingClientRect(message.highlightId);
			
			// ClientRect won't stringify
			response = {
				"top": rect.top,
				"right": rect.right,
				"bottom": rect.bottom,
				"left": rect.left,
				"width": rect.width,
				"height": rect.height,
			};
			
			break;

        case "get_document_element_attribute_node_value":
            var attribute = document.documentElement.attributes[message.attribute_name];
            response = (attribute && attribute.nodeValue) || undefined;
            // response = document.documentElement.attributes[message.attribute_name];
            break;

        case "get_hovered_highlight_id":
            response = _contentScript.getHoveredHighlightID();
            break;

        default:
            throw "unhandled message: sender=" + sender + ", id=" + message.id;
        }

        sendResponse(response);
    },

    /**
     * Given one of the elements in the list of spans which compose a highlight, get the id (only set on the first item)
     * @param element
     * @return {*}
     */
    _getHighlightId: function (element) {
        "use strict";
        // even if the first span sets the firstSpan property to itself
        if (!element.firstSpan) {
            // unusual
            return;
        }

        return element.firstSpan.id;
    },

    /**
     * Mouse entered one of the highlight's spans
     */
    onMouseEnterHighlight: function () {
        "use strict";
        // if text is selected, don't use the 'update' method
        // if (!_contentScript.isSelectionCollapsed()) {
        //     // dont wake event page if possible
        //     return;
        // }

        // 'this' is one of the spans in the list, related to a single highlight.
        var id = _contentScript._getHighlightId(this);
        if (id) {
            // tell event page that this is the current highlight.
            // if the range is not collapsed, it will probably be ignored
            chrome.runtime.sendMessage({
                id: "on_mouse_enter_highlight",
                highlightId: id
            });
        }
    },

    /**
     * Mouse left one of the highlight's spans
	 */
    onMouseLeaveHighlight: function () {
        "use strict";
        // tell event page that this is the current highlight
		chrome.runtime.sendMessage({
            id: "on_mouse_leave_highlight",
        });
    },

    /**
     * Get the ID of the highlight currently being hovered over
     */
    getHoveredHighlightID: function() {
        // undefined if no element
        var lastHoveredElement = (function() {
            // highlight classes that are hovered
            var selector = "." + _contentScript.highlightClassName + ":hover"; 
            var q = document.querySelectorAll(selector);

            return q[q.length-1];
        })()

        if (!lastHoveredElement) {
            return;
        }

        return _contentScript._getHighlightId(lastHoveredElement);
    },

    /**
     * A value in the storage changed
     * @param changes
     * @param namespace
     */
    onStorageChanged: function (changes, namespace) {
        "use strict";
        if (namespace === "sync") {
            // changes is an Object mapping each key that changed to its
            // corresponding storage.StorageChange for that item.
			
			// this applies to all styles
			_storage.isHighlightBoxShadowEnabled_Promise().then(function (enableBoxShadow){
	            // default FIRST
	            if (changes.sharedHighlightStyle) {
	                var c1 = changes.sharedHighlightStyle;

	                if (c1.oldValue) {
					   _stylesheet.clearHighlightStyle(_contentScript.highlightClassName).then(function() {
						   _stylesheet.updateInnerTextForHighlightStyleElement(); 
					   });

	                }

	                if (c1.newValue) {
	                    _stylesheet.setHighlightStyle({
	                        className: _contentScript.highlightClassName,
	                        style: c1.newValue,
							disableBoxShadow: !enableBoxShadow,
					   }).then(function() {
						   _stylesheet.updateInnerTextForHighlightStyleElement(); 
					   });
	                }
	            }

	            // specific last
	            if (changes.highlightDefinitions) {
	                var c2 = changes.highlightDefinitions;
					var promises = [];
					
	//                // Remove all event handlers in the ".hotkeys" namespace
	//                $(document).off('keypress.hotkeys');

	                if (c2.oldValue) {
	                	c2.oldValue.forEach( function (h) {
	                		_stylesheet.clearHighlightStyle(h.className);
	                	});
	                	
	                	_stylesheet.updateInnerTextForHighlightStyleElement();
	                }

	                if (c2.newValue) {
	                	var promises = c2.newValue.map( function(h) {
	                		h.disableBoxShadow = !enableBoxShadow;
	                		return _stylesheet.setHighlightStyle(h);
	                	});
	                
	                	Promise.all(promises).then(function() {
	                		_stylesheet.updateInnerTextForHighlightStyleElement();
	                	});
	                }
	            }

	            // alpha
	            if (changes.highlightBackgroundAlpha) {
	                _contentScript.resetStylesheetHighlightStyle();
	            }
			});
        }
    },

    /**
     * Read all the current highlight styles, and apply to stylesheet.
     * If they already exist in stylesheet, clear them first
     * @private
     */
    resetStylesheetHighlightStyle: function () {
        "use strict";
        // fake a change for initial update
        return _storage.highlightDefinitions.getAll_Promise().then(function (result) {
            _contentScript.onStorageChanged({
                sharedHighlightStyle: {
                    newValue: result.sharedHighlightStyle
                },
                highlightDefinitions: {
                    newValue: result.highlightDefinitions
                }
            }, "sync");
        });
    }

};

/**
 * Listener for change events in storage
 */
//_contentScript.init();

$().ready(function () {
    "use strict";
	_contentScript.init();

    //_contentScript.onReady();
});
