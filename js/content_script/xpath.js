/*global Node, XPathEvaluator, document, documentelement, XPathResult*/
"use strict"

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
     * Get the XPath of a node within its hierarchy
     * @param {Object} node - node to process within its owner document
     * @return {string} xpath of node, or empty string if no tests could be identified
     */
    _getPath: (node) => {
        let nodeTests = []

        // if the chain contains a non-(element|text) node type, we can go no further
        for (; node && (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE); node = node.parentNode) {
            // if the node is an element with a specific, unique id, it can become the root of the path,
            // and since we're going from node to document root, we have all we need.
            if (node.nodeType === Node.ELEMENT_NODE &&
                node.id.length > 0 &&
                node.ownerDocument.querySelectorAll(`#${node.id}`).length === 1) {
                // because the first item of the path array is prefixed with '/', this will become 
                // a double slash (select all elements). But as there's only one result, we can use [1]
                // eg: //*[@id='something'][1]/div/text()
                nodeTests.unshift(`/*[@id="${node.id}"][1]`)
                break
            }

            // Get node index by counting previous siblings of the same name & type
            let index = 1

            for (let siblingNode = node.previousSibling; siblingNode; siblingNode = siblingNode.previousSibling) {
                // Skip DTD,
                // Skip nodes of differing type AND name (tagName for elements, #text for text),
                // as they are indexed by node type
                if (siblingNode.nodeType === Node.DOCUMENT_TYPE_NODE ||
                    node.nodeType !== siblingNode.nodeType ||
                    siblingNode.nodeName !== node.nodeName) {
                    continue
                }

                index++
            }

            // format node test for current node
            let nodeTest = (() => {
                switch (node.nodeType) {
                    case Node.ELEMENT_NODE:
                        // naturally uppercase. I forget why I force it lower.
                        return node.nodeName.toLowerCase()
                
                    case Node.TEXT_NODE:
                        return 'text()'

                    default:
                        console.error(`invalid node type: ${node.nodeType}`)
                }
            })()

            // nodes at index 1 (1-based) are implicitly selected
            if (index > 1) {
                nodeTest += `[${index}]`
            }

            nodeTests.unshift(nodeTest)
        } // end for

        // return empty path string if unable to create path
        return nodeTests.length === 0 ? "" : `/${nodeTests.join('/')}`
    },

    /**
     * Convert a standard Range object to an XPathRange
     * @param {Object} range Range object
     * @return {Object} (identifies containers by their _xpath)
     */
    createXPathRangeFromRange: function (range) {
        return {
            startContainerPath: this._getPath(range.startContainer),
            startOffset: range.startOffset,
            endContainerPath: this._getPath(range.endContainer),
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