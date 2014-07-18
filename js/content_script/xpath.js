"use strict";
/*global Node, XPathEvaluator, document, documentelement, XPathResult*/

var _xpath = {
    /**
     * Gets an XPath for an node which describes its hierarchical location.
     * http://stackoverflow.com/questions/3454526/how-to-calculate-the-_xpath-position-of-an-element-using-javascript
     */
    _getXPathFromNode: function (node) {
        if (node && node.id) {
            return '//*[@id="' + node.id + '"]';
        }

        var paths = [];

        // Use nodeName (instead of localName) so namespace prefix is included (if any).
        for (; node && (node.nodeType == 1 || node.nodeType == 3) ; node = node.parentNode)  {
            var index = 0;
            // EXTRA TEST FOR ELEMENT.ID
            if (node && node.id) {
                paths.splice(0, 0, '/*[@id="' + node.id + '"]');
                break;
            }

            for (var sibling = node.previousSibling; sibling; sibling = sibling.previousSibling) {
                // Ignore document type declaration.
                if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE)
                    continue;

                if (sibling.nodeName == node.nodeName)
                    ++index;
            }

            var tagName = (node.nodeType == 1 ? node.nodeName.toLowerCase() : "text()");
            var pathIndex = (index ? "[" + (index+1) + "]" : "");
            paths.splice(0, 0, tagName + pathIndex);
        }

        return paths.length ? "/" + paths.join("/") : null;
    },

    /**
     * Convert a standard Range object to an XPathRange
     * @param range Range objct
     * @return XPathRange (identifies containers by their _xpath)
     */
    createXPathRangeFromRange: function (range) {
        var xpathRange = {
            startContainerPath: this._getXPathFromNode(range.startContainer),
            startOffset: range.startOffset
        };

        if (range.collapsed) {
            xpathRange.endContainerPath = xpathRange.startContainerPath;
            xpathRange.endOffset = xpathRange.startOffset;
        } else {
            xpathRange.endContainerPath = this._getXPathFromNode(range.endContainer);
            xpathRange.endOffset = range.endOffset;
        }

        return xpathRange;
    },

    /**
     * Create a standard Range() object, given and XPathRange object
     * @param xpathRange see {@link #createXPathRangeFromRange}
     * @return {Range} range object, or null if start or end containers couldn't be evaluated
     */
    createRangeFromXPathRange: function (xpathRange) {
        var startContainer, endContainer, range, evaluator = new XPathEvaluator();

        // must have legal start and end container nodes
        startContainer = evaluator.evaluate(xpathRange.startContainerPath,
            document.documentElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (!startContainer.singleNodeValue) {
            return null;
        }

        // share the container if path is equal
        if (xpathRange.startContainerPath === xpathRange.endContainerPath) {
            endContainer = startContainer;
        } else {
            // else evaluate as normal
            endContainer =  evaluator.evaluate(xpathRange.endContainerPath,
                document.documentElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (!endContainer.singleNodeValue) {
                return null;
            }
        }

        // map to range object
        range = document.createRange();
        range.setStart(startContainer.singleNodeValue, xpathRange.startOffset);
        range.setEnd(endContainer.singleNodeValue, xpathRange.endOffset);

        return range;
    }
};