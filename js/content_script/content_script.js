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
// console.log = function () { }
"use strict"

var _contentScript = {
    // styleSheet: new SS(document),

    /**
     * A random string applied as an additional class name to all highlights,
     * allowing .on() event handling, and shared style
     */
    highlightClassName: null,

    /**
     * Called when the script loads
     */
    init: function () {
        // _contentScript.styleSheet.init()

        "use strict";
        // create a random class name
        _contentScript.highlightClassName = StringUtils.newUUID({ beginWithLetter: true })

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

        function isHighlightElement(e) {
            return e.classList && e.classList.contains(_contentScript.highlightClassName)
        }

        // shared options
        document.addEventListener('mouseenter', function (event) {
            // ignore events where the target of the captured event isn't a highlight
            const target = event.target
            if (!isHighlightElement(target)) { return }

            // the handler applies to all spans of the highlight, so first look for 'firstSpan' (which should
            // have the 'closeable' class)
            const span = target.firstSpan;// $(this).prop('firstSpan');

            // remove hysteresis timer from the first span
            if (span.mouseLeaveHysteresisTimeoutID != null) {
                // cancel scheduled out transition
                clearTimeout(span.mouseLeaveHysteresisTimeoutID);
                span.mouseLeaveHysteresisTimeoutID = null;
            }

            const style = span.querySelector('.close').style;

            // transition in
            style.setProperty('opacity', '1')
            style.setProperty('transform', 'scale(1.0)')
        }, { capture: true, passive: true })

        document.addEventListener('mouseleave', function (event) {
            // ignore events where the target of the captured event isn't a highlight
            const target = event.target
            if (!isHighlightElement(target)) { return }

            const span = target.firstSpan;     // var firstSpan = $(this).prop('firstSpan');
            const style = span.querySelector('.close').style;

            // add a timeout once we leave the element. If we return we cancel the transition out
            span.mouseLeaveHysteresisTimeoutID = setTimeout(function () {
                // transition out wasn't cancelled, so do it
                span.mouseLeaveHysteresisTimeoutID = null;

                style.setProperty('opacity', '0')
                style.setProperty('transform', 'scale(0.6)')
            }, 500);
        }, { capture: true, passive: true })

        // non-passive captured event
        document.addEventListener('click', function (event) {
            // ignore events where the target of the captured event isn't the close button
            const target = event.target
            
            if (!(target.classList.contains('close') &&
                target.parentElement &&
                target.parentElement.classList.contains('closeable') &&     // only first highlight span is closeable
                target.parentElement.classList.contains(`${_contentScript.highlightClassName}`)))
                { return }
            
            event.preventDefault();

            // parent should be a span with an id corresponding the the document id of the highlight
            const highlightId = _contentScript._getHighlightId(target.parentElement);

            if (!highlightId) {
                return
            }

            // tell event page to delete the highlight
            chrome.runtime.sendMessage({
                id: "on_click_delete_highlight",
                highlightId: highlightId
            });
            // target.style.setProperty('transform', 'scale(5)')
        }, { capture: true, passive: false })
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
     * @param xrange object containing properties of Range, with containers defined by XPath instead of node
     * @param id id to set on the first span of the highlight
     * @param className class defining the highlight style
     * @return {*} span of highlight list, or null on error
     */
    createHighlight: function (xrange, id, className) {
        "use strict";
        let range;

        // this is likely to cause exception when the underlying DOM has changed
        try {
            range = RangeUtils.toRange(xrange, document)
            if (!range) {
                throw new Error(`Unable to parse xrange`)
            }
        } catch (err) {
            // console.error(`Exception parsing xpath range ${xrange}: ${err.message}`)
            return null
        }

        // create span(s), with 2 class names
        let firstSpan = _highlighter.create(range, id, [
            _contentScript.highlightClassName,
            className
        ]);

        // 1 - only the first of the chain of spans should get the closeable class
        firstSpan.setAttribute("tabindex", "0");
        firstSpan.classList.add("closeable");

        // 2 - add 'close' span to the element
        // TODO: button
        const closeElm = document.createElement("span");
        closeElm.className = "close";

        firstSpan.appendChild(closeElm);

        return firstSpan
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
     * Select the text within a defined range
     * @param {Range} [range] range to select. if undefined, all selections are removed
     */
    selectRange: function (range) {
        var selection = window.getSelection();

        selection.removeAllRanges();

        if (range) {
            selection.addRange(range);
        }
    },

    /**
     * Check whether a highlight with this id is on the page
     * @param {string} id
     * @return {boolean} true if on page
     */
    isHighlightInDOM: function (id) {
        return !!document.querySelector(`#${id}`)
        // return $('#' + id).length === 1;
    },

    getBoundingClientRect: function (id) {
        const elm = document.querySelector(`#${id}`)
        return (elm && elm.getBoundingClientRect()) || null
    },

    /**
     * Update the class name for all the spans of a highlight
     * @param id existing highlight id
     * @param className class name to replace
     */
    updateHighlight: function (id, className) {
        // remember to also include the shared highlights class name
        return _highlighter.update(id, className)
    },

    /**
     * Scroll DOM to top of an element
     * @param {Object} selector element selector
     * @return {boolean} true if selector matched an element
     */
    scrollTo: function (selector) {
        "use strict";
        const elm = document.querySelector(selector)

        if (elm) {
            elm.scrollIntoView()
        }

        // if (elm) {
        //     const top = elm.offsetTop
        //     const height = elm.offsetHeight;
        //     const windowHeight = window.innerHeight;

        //     document.body.scrollTop = (height < windowHeight) ?
        //         top - ((windowHeight / 2) - (height / 2)) :
        //         top
        // }

        return elm != null

        // var $elm = $(selector);
        // if ($elm) {
        // 	var elmOffset = $elm.offset().top;
        // 	var elmHeight = $elm.height();
        // 	var windowHeight = window.innerHeight;// $(window).height();
        // 	var offset;

        // 	if (elmHeight < windowHeight) {
        // 		   offset = elmOffset - ((windowHeight / 2) - (elmHeight / 2));
        // 	} else {
        // 		   offset = elmOffset;
        // 	}

        //     document.body.style.setProperty()
        // 	$('body').animate({
        // 		'scrollTop': offset
        // 	}, 'slow');        
        // }

        // return $elm !== null;
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
                response = !!_contentScript.createHighlight(message.range, message.highlightId, message.className)
                break;

            case "update_highlight":
                response = _contentScript.updateHighlight(message.highlightId, message.className);
                break;

            case "delete_highlight":
                // returns boolean true on success, false on error
                response = _contentScript.deleteHighlight(message.highlightId);
                break;

            case 'select_highlight':
                response = (() => {
                    // null id clears selection
                    const range = _contentScript.selectHighlight(message.highlightId)

                    // get xrange from range
                    return message.highlightId ? RangeUtils.toObject(range) : null
                })()
                break;

            case "select_range":
                response = (() => {
                    // select range defined by xrange, or clear if undefined
                    const range = message.xrange ? RangeUtils.toRange(message.xrange, document) : null
                    
                    _contentScript.selectRange(range);

                    // return xrange of selection
                    return range ? RangeUtils.toObject(range) : null
                })()
                break;

            case "is_highlight_in_dom":
                response = _contentScript.isHighlightInDOM(message.highlightId);
                break;

            case "get_selection_range":
                response = (() => {
                    // convert current selection range to xrange
                    const range = _contentScript.getSelectionRange()
                    return RangeUtils.toObject(range)
                })()
                break;

            case "get_range_text":
                response = (document => {
                    const range = RangeUtils.toRange(message.xrange, document)
                    return range ? range.toString() : null;
                })(document)
                break;

            case "scroll_to":
                response = _contentScript.scrollTo("#" + message.fragment);
                break;

            case "get_bounding_client_rect":
                const rect = _contentScript.getBoundingClientRect(message.highlightId)

                // ClientRect won't stringify
                response = (rect && {
                    "top": rect.top,
                    "right": rect.right,
                    "bottom": rect.bottom,
                    "left": rect.left,
                    "width": rect.width,
                    "height": rect.height,
                }) || null

                break;

            case "get_node_attribute_value":
                const {singleNodeValue} = document.evaluate(
                    message.xpathExpression,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                )

                response = (singleNodeValue &&
                    singleNodeValue.attributes &&
                    singleNodeValue.attributes[message.attributeName] &&
                    singleNodeValue.attributes[message.attributeName].nodeValue) ||
                    null
                break

            case "get_hovered_highlight_id":
                response = _contentScript.getHoveredHighlightID();
                break;

            default:
                throw "unhandled message: sender=" + sender + ", id=" + message.id;
        }

        sendResponse(response);

        // always a synchronous response
        return false
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
            return null;
        }

        return element.firstSpan.id;
    },

    /**
     * Mouse entered one of the highlight's spans
     */
    // onMouseEnterHighlight: function () {
    //     "use strict";
    //     // if text is selected, don't use the 'update' method
    //     // if (!_contentScript.isSelectionCollapsed()) {
    //     //     // dont wake event page if possible
    //     //     return;
    //     // }

    //     // 'this' is one of the spans in the list, related to a single highlight.
    //     var id = _contentScript._getHighlightId(this);
    //     if (id) {
    //         // tell event page that this is the current highlight.
    //         // if the range is not collapsed, it will probably be ignored
    //         chrome.runtime.sendMessage({
    //             id: "on_mouse_enter_highlight",
    //             highlightId: id
    //         });
    //     }
    // },

    /**
     * Mouse left one of the highlight's spans
	 */
    // onMouseLeaveHighlight: function () {
    //     "use strict";
    //     // tell event page that this is the current highlight
    //     chrome.runtime.sendMessage({
    //         id: "on_mouse_leave_highlight",
    //     });
    // },

    /**
     * Get the ID of the highlight currently being hovered over
     */
    getHoveredHighlightID: function () {
        const elms = document.querySelectorAll(`.${_contentScript.highlightClassName}:hover`);
        const lastHoveredElement = elms[elms.length - 1]

        if (!lastHoveredElement) {
            return null;
        }

        return _contentScript._getHighlightId(lastHoveredElement);
    },

    /**
     * Callback called when a value in storage changes
     * 
     * @callback
     * @param {Object} changes - chrome.storage.StorageChange object
     * @param {string} areaName - storage area (sync|local|managed) - Must be 'sync'
     * @returns {Promise}
     */
    onStorageChanged: function (changes, areaName) {
        if (areaName !== 'sync') {
            return Promise.resolve()
        }

        return new ChromeStorage().get(ChromeStorage.KEYS.ENABLE_HIGHLIGHT_BOX_SHADOW).then(enableHighlightBoxShadow => {
            return new Promise(resolve => {
                // default FIRST
                const c = changes[ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE]

                if (!c) {
                    resolve()
                    return
                }

                if (c.oldValue) {
                    _stylesheet.clearHighlightStyle(_contentScript.highlightClassName)
                    _stylesheet.updateInnerTextForHighlightStyleElement()
                }

                if (c.newValue) {
                    return _stylesheet.setHighlightStyle({
                        [HighlightDefinitionFactory.KEYS.CLASS_NAME]: _contentScript.highlightClassName,
                        [HighlightDefinitionFactory.KEYS.STYLE]: c.newValue,
                        [HighlightDefinitionFactory.KEYS.DISABLE_BOX_SHADOW]: !enableHighlightBoxShadow,
                    }).then(() => {
                        _stylesheet.updateInnerTextForHighlightStyleElement()
                        resolve()
                    })
                } 

                resolve()
            }).then(() => {
                // specific last
                const c = changes[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]

                if (!c) {
                    return
                }

                if (c.oldValue) {
                    for (const {className} of c.oldValue) {
                        _stylesheet.clearHighlightStyle(className)
                    }

                    _stylesheet.updateInnerTextForHighlightStyleElement()
                }

                if (c.newValue) {
                    for (const d of c.newValue) {
                        d[HighlightDefinitionFactory.KEYS.DISABLE_BOX_SHADOW] = !enableHighlightBoxShadow
                    }

                    return Promise.all(c.newValue.map(d => _stylesheet.setHighlightStyle(d))).then(() => {
                        _stylesheet.updateInnerTextForHighlightStyleElement()
                    })
                }
            }).then(() => {
                // alpha
                if (!changes[ChromeHighlightStorage.KEYS.HIGHLIGHT_BACKGROUND_ALPHA]) {
                    return
                }

                return _contentScript.resetStylesheetHighlightStyle()
            })
        }) // end ChromeStorage().get()
    },

    /**
     * Read all the current highlight styles, and apply to stylesheet.
     * If they already exist in stylesheet, clear them first
     * @private
     * @returns {Promise}
     */
    resetStylesheetHighlightStyle: function () {
        // fake a change for initial update
        return new ChromeHighlightStorage().getAll().then(items => {
            return _contentScript.onStorageChanged({
                [ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE]: {
                    newValue: items[ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE]
                },
                [ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]: {
                    newValue: items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]
                },
            }, 'sync')
        })
    }

};

// script is run at 'document_idle' (see manifest), which is some time between
// 'DOMContentLoaded' and immediately after 'load'
_contentScript.init();