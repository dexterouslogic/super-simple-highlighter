/*global Node, XPathEvaluator, document, documentelement, XPathResult*/

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

var _xpath = {
    /**
     * Gets an XPath for an node which describes its hierarchical location.
     * http://stackoverflow.com/questions/3454526/how-to-calculate-the-_xpath-position-of-an-element-using-javascript
     */
    _getXPathFromNode: function (node) {
        "use strict";
        // if (node && node.id) {
        //     return '//*[@id="' + node.id + '"]';
        // }

        var paths = [];

        // Use nodeName (instead of localName) so namespace prefix is included (if any).
        for (; node && (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE); node = node.parentNode)  {
            var index = 0;

            if (node.id) {
                // if the document illegally re-uses an id, then we can't use it as a unique identifier
                var selector = '[id="' + node.id + '"]';

                // no jquery
                var length = document.querySelectorAll(selector).length;
                if (length === 1) {
                    // because the first item of the path array is prefixed with '/', this will become 
                    // a double slash (select all elements). But as there's only one result, we can use [1]
                    // eg: //*[@id='something'][1]/div/text()
                    paths.splice(0, 0, '/*[@id="' + node.id + '"][1]');
                    break;
                }

                console.log("document contains " + length + " elements with selector " + selector + ". Ignoring");
            }

            for (var sibling = node.previousSibling; sibling; sibling = sibling.previousSibling) {
                // Ignore document type declaration.
                if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE) {
                    continue;
                }

                if (sibling.nodeName === node.nodeName) {
                    index++;
                }
            }

            var tagName = (node.nodeType === Node.ELEMENT_NODE ? node.nodeName.toLowerCase() : "text()");
            var pathIndex = (index ? "[" + (index+1) + "]" : "");
            paths.splice(0, 0, tagName + pathIndex);
        }

        return paths.length ? "/" + paths.join("/") : null;
    },

    /**
     * Convert a standard Range object to an XPathRange
     * @param {object} range Range object
     * @return {object} (identifies containers by their _xpath)
     */
    createXPathRangeFromRange: function (range) {
        "use strict";
        return {
            startContainerPath: this._getXPathFromNode(range.startContainer),
            startOffset: range.startOffset,
            endContainerPath: this._getXPathFromNode(range.endContainer),
            endOffset: range.endOffset,
            collapsed: range.collapsed
        };
    },

    /**
     * Create a standard Range() object, given and XPathRange object
     * @param xpathRange see {@link #createXPathRangeFromRange}
     * @return {Range} range object, or null if start or end containers couldn't be evaluated
     */
    createRangeFromXPathRange: function (xpathRange) {
        "use strict";
        var startContainer, endContainer, endOffset, evaluator = new XPathEvaluator();

        // must have legal start and end container nodes
        startContainer = evaluator.evaluate(xpathRange.startContainerPath,
            document.documentElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (!startContainer.singleNodeValue) {
            return null;
        }

        if (xpathRange.collapsed || !xpathRange.endContainerPath) {
            endContainer = startContainer;
            endOffset = xpathRange.startOffset;
        } else {
            endContainer = evaluator.evaluate(xpathRange.endContainerPath,
                document.documentElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (!endContainer.singleNodeValue) {
                return null;
            }

            endOffset = xpathRange.endOffset;
        }

        // map to range object
        var range = document.createRange();
        range.setStart(startContainer.singleNodeValue, xpathRange.startOffset);
        range.setEnd(endContainer.singleNodeValue, endOffset);

        return range;
    }
};