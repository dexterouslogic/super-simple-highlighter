/*global document, Node, HTMLScriptElement, HTMLStyleElement, HTMLSelectElement, HTMLTableRowElement,
    HTMLTableColElement, HTMLTableSectionElement, HTMLTableElement*/


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


var _highlighter = {
    /**
     * Add a highlight, by wrapping a range in a span
     * @param range Range object describing range to highlight
     * @param id id to assign to first span in highlight's list
     * @param className string or array of class names to assign of all spans in highlight's list
     * @return {null} first and last node will both be !== null if created. see comments for structure
     */
    create: function (range, id, className) {
        "use strict";

        // highlights are wrapped in one or more spans
        var span = document.createElement("SPAN");
        
        span.className = (className instanceof Array ? className.join(" ") : className);

        // each node has a .nextElement property, for following the linked list
        var record = {
            firstSpan: null,
            lastSpan: null
        };

        this._doCreate(range, record, function () {
            // wrapper creator
            var newSpan = span.cloneNode(false);

            // link up
            if (!record.firstSpan) {
                record.firstSpan = newSpan;

                // only give the first span the id
                record.firstSpan.id = id;
            }

            if (record.lastSpan) {
                record.lastSpan.nextSpan = newSpan;
            }

            record.lastSpan = newSpan;

            // every span in the highlight has a reference to the first span
            newSpan.firstSpan = record.firstSpan;
            return newSpan;
        });

        // every span in the list must have a 'nextSpan' property, even if null.
        // Being an SPAN element, with this property defined, is a check for validity
//        if (record.lastSpan) {
//            record.lastSpan.nextSpan = null;
//        }

        // terminate
//        if (record.firstSpan) {
//            record.lastSpan.nextElement = record; //connect linked list back to record
//        }

        return record.firstSpan;
    },

    /**
     * Worker function for {@link #add} method
     * @param range range to highlight
     * @param record
     * @param createWrapper wrapped node creation callback
     * @private
     */
    _doCreate: function (range, record, createWrapper) {
        "use strict";
        //(startContainer == endContainer && startOffset == endOffset)
        if (range.collapsed) {
            return;
        }

        var startSide = range.startContainer, endSide = range.endContainer,
            ancestor = range.commonAncestorContainer, dirIsLeaf = true;

        if (range.endOffset === 0) {  //nodeValue = text | element
            while (!endSide.previousSibling && endSide.parentNode !== ancestor) {
                endSide = endSide.parentNode;
            }

            endSide = endSide.previousSibling;
        } else if (endSide.nodeType === Node.TEXT_NODE) {
            if (range.endOffset < endSide.nodeValue.length) {
                endSide.splitText(range.endOffset);
            }
        } else if (range.endOffset > 0) {  //nodeValue = element
            endSide = endSide.childNodes.item(range.endOffset - 1);
        }

        if (startSide.nodeType === Node.TEXT_NODE) {
            if (range.startOffset === startSide.nodeValue.length) {
                dirIsLeaf = false;
            } else if (range.startOffset > 0) {
                startSide = startSide.splitText(range.startOffset);

                if (endSide === startSide.previousSibling) {
                    endSide = startSide;
                }
            }
        } else if (range.startOffset < startSide.childNodes.length) {
            startSide = startSide.childNodes.item(range.startOffset);
        } else {
            dirIsLeaf = false;
        }

        range.setStart(range.startContainer, 0);
        range.setEnd(range.startContainer, 0);

        var done = false, node = startSide;

        do {
            if (dirIsLeaf && node.nodeType === Node.TEXT_NODE &&
                    !(node.parentNode instanceof HTMLTableElement) &&
                    !(node.parentNode instanceof HTMLTableRowElement) &&
                    !(node.parentNode instanceof HTMLTableColElement) &&
                    !(node.parentNode instanceof HTMLTableSectionElement)) {
                //
                var wrap = node.previousSibling;

                if (!wrap || wrap !== record.lastSpan) {
                    wrap = createWrapper(node);
                    node.parentNode.insertBefore(wrap, node);
                }

                wrap.appendChild(node);

                // remove transparent style to fade to colour desired by class
//                window.setTimeout(function(elem) {
//                    elem.style.removeProperty("background-color");
//                    elem.style.removeProperty("color");
//                    elem.style.removeProperty("-webkit-box-shadow");
//                }, 0, wrap);

                node = wrap.lastChild;
                dirIsLeaf = false;
            }

            if (node === endSide && (!endSide.hasChildNodes() || !dirIsLeaf)) {
                done = true;
            }

            if (node instanceof HTMLScriptElement ||
                    node instanceof HTMLStyleElement ||
                    node instanceof HTMLSelectElement) {
                  //never parse their children
                dirIsLeaf = false;
            }

            if (dirIsLeaf && node.hasChildNodes()) {
                node = node.firstChild;
            } else if (node.nextSibling !== null) {
                node = node.nextSibling;
                dirIsLeaf = true;
            } else if (node.nextSibling === null) {
                node = node.parentNode;
                dirIsLeaf = false;
            }
        } while (!done);
    },

    /**
     * Update the classname of a highlight
     * @param id id of first span in highlight's list
     * @param className string or array of new class name(s)
     */
    update: function (id, className) {
        "use strict";
        // id is for first span in list
        var span = document.getElementById(id);

        // not finding the first element, or it not being legal, is a fail
        if (!this._isHighlightSpan(span)) {
            return false;
        }

        // make string
        className = (className instanceof Array ? className.join(" ") : className);

        do {
            span.className = className;
            span = span.nextSpan;
        } while (this._isHighlightSpan(span));

        return true;
    },

    /**
     * Delete highlight
     * @param id id of first span in the list of spans that consist a highlight
     */
    del: function (id) {
        "use strict";
        // id is for first span in list
        var span = document.getElementById(id);

        if (!this._isHighlightSpan(span)) {
            return false;
        }

        /**
         * merge text nodes with prev/next sibling
         * @param n
         * @private
         */
        function _merge(n) {
            if (n.nodeType === Node.TEXT_NODE) {
                if (n.nextSibling && n.nextSibling.nodeType === Node.TEXT_NODE) {
                    // merge next sibling into newNode
                    n.textContent += n.nextSibling.textContent;
                    // remove next sibling
                    n.nextSibling.parentNode.removeChild(n.nextSibling);
                }

                if (n.previousSibling && n.previousSibling.nodeType === Node.TEXT_NODE) {
                    // merge nodeNew into previousSibling
                    n.previousSibling.textContent += n.textContent;
                    // remove newNode
                    n.parentNode.removeChild(n);
                }
            }
        }

        // iterate whilst all tests for being a highlight span node are passed
        while (this._isHighlightSpan(span)) {
            //
            while (span.hasChildNodes()) {
                var nodeNew = span.parentNode.insertBefore(span.firstChild, span);

                // merge restored nodes
                _merge(nodeNew);
            }

            var nodeRemovedPreviousSibling = span.previousSibling;
            var nodeRemoved = span.parentNode.removeChild(span);

            // if removing the span brings 2 text nodes together, join them
            if (nodeRemovedPreviousSibling) {
                _merge(nodeRemovedPreviousSibling);
            }

            // point to next hl (undefined for last in list)
            span = nodeRemoved.nextSpan;
        }

        return true;
    },

    /**
     * Return a range spanning the span(s) associated with a highlight
     * @param {string} id id of first span in highlight's list
     * @return {Range}
     */
    getRange: function (id) {
        "use strict";
        // id is for first span in list
        var span = document.getElementById(id);
        var range = document.createRange();

        while (this._isHighlightSpan(span)) {
            if (range.collapsed) {
                range.setStartBefore(span);
            }

            range.setEndAfter(span);
            span = span.nextSpan;
        }

        return range;
    },

    /**
     * Check if teh node meets the requirements of being one of the span components of a highlight
     * @param node
     * @return boolean if requirements met
     * @private
     */
    _isHighlightSpan: function (node) {
        "use strict";
        return node &&
            node.nodeType === Node.ELEMENT_NODE && node.nodeName === "SPAN" &&
            node.firstSpan !== undefined;
    }
};

