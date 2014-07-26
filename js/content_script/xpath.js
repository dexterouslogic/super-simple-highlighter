/*global Node, XPathEvaluator, document, documentelement, XPathResult*/

var _xpath = {
    /**
     * Gets an XPath for an node which describes its hierarchical location.
     * http://stackoverflow.com/questions/3454526/how-to-calculate-the-_xpath-position-of-an-element-using-javascript
     */
    _getXPathFromNode: function (node) {
        "use strict";
        if (node && node.id) {
            return '//*[@id="' + node.id + '"]';
        }

        var paths = [];

        // Use nodeName (instead of localName) so namespace prefix is included (if any).
        for (; node && (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE); node = node.parentNode)  {
            var index = 0;
            // EXTRA TEST FOR ELEMENT.ID
            if (node.id) {
                // if the document illegally re-uses an id, then we can't use it as a unique identifier

//                // no jquery
//                var length = document.querySelectorAll("[id=" + node.id + "]").length;
                // jquery
                var length = $("[id=" + node.id + "]").length;

                if (length === 1) {
                    paths.splice(0, 0, '/*[@id="' + node.id + '"]');
                    break;
                }

                console.log("document contains " + length + " elements with id=" + node.id + ". Ignoring");
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