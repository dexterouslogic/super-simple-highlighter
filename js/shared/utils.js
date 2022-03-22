
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

/**
 * static utils for string things
 * 
 * @class StringUtils
 */
class StringUtils {
  /**
   * Create a UUID
   * If string is to be used as an element ID it must begin with [::alpha::] (not number)
   * 
   * @static
   * @param {Object} [options={beginWithLetter=false}] - options
   * @returns {string} new UUID
   * @memberof StringUtils
   */
  static newUUID({ beginWithLetter = true } = {}) {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c, index) => {
      let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);

      // make sure first letter is a-f
      if (beginWithLetter && index === 0) {
        v = (v % 6) + 0xa;// Math.max(v, 0xa);
      }

      return v.toString(16);
    });
  }
}

class DataUtils {
	/**
	 * convert data attributeName (camel case) to "data-attribute-name"
	 * @param {string} camelCase 
	 * @returns {string} converted string
	 */
	static camelCaseToAttribute(camelCase) {
		return 'data-' + DataUtils.camelCaseToHyphen(camelCase);
	}

	/**
	 * convert camelCase value to camel-case value
	 * @param {string} camelCase 
	 * @returns {string} converted string
	 */
	static camelCaseToHyphen(camelCase) {
    return camelCase.replace(/([A-Z])/g, '-$1').toLowerCase();
  }
}

/**
 * Static utils for Promise things
 * 
 * @class PromiseUtils
 */
class PromiseUtils {
  /**
   * Promise that runs array of promises sequentially
   * https://hackernoon.com/functional-javascript-resolving-promises-sequentially-7aac18c4431e
   * 
   * @static
   * @param {(function(): Promise)[]} pfuncs - array of functions returning promises to run sequentially
   * @returns {Promise<Promise[]>}
   * @memberof PromiseUtils
   */
  static serial(pfuncs) {
    return pfuncs.reduce((promise, func) =>
      promise.then(result => func().then(Array.prototype.concat.bind(result))),
      Promise.resolve([])
    )
  }
}

/**
 * Static methods for clipboard things
 * 
 * @class ClipboardUtils
 */
class ClipboardUtils {
	/**
	 * Copy text to clipboard
	 * http://updates.html5rocks.com/2015/04/cut-and-copy-commands
	 * 
	 * @static
	 * @param {String} text - text to copy
	 * @param {Document} document - Document to use for some reason 
	 * @returns {boolean}
	 * @memberof ClipboardUtils
	 */
	static copy(text, document) {
		// add temporary node which can contain our text
		const pre = document.createElement('pre')
		
		pre.innerText = text

		document.body.appendChild(pre)

		const range = document.createRange()
		range.selectNode(pre)

		// make our node the sole selection
		const selection = document.getSelection()
		
		selection.removeAllRanges()
		selection.addRange(range)

		const result = document.execCommand('copy')

		selection.removeAllRanges()
		document.body.removeChild(pre)

		return result
	}
}

/**
 * Static methods for base64 things
 * 
 * @class Base64Utils
 */
class Base64Utils {
  /**
   * 
   * 
   * @static
   * @param {string} str 
   * @param {Window} [w=window] 
   * @returns {string}
   * @memberof Base64Utils
   */
  static utf8_to_b64(str, w = window) {
    return w.btoa(unescape(encodeURIComponent(str)));
  }

  /**
   * 
   * 
   * @static
   * @param {string} str 
   * @param {Window} [w=window] 
   * @returns {string}
   * @memberof Base64Utils
   */
  static b64_to_utf8(str, w = window) {
    return decodeURIComponent(escape(w.atob(str)));
  }
}

/**
 * Utils for converting Range to a serializable form
 * 
 * @class RangeUtils
 */
class RangeUtils {
	/**
	 * Convert a Range object to a XRange object
	 * 
	 * @static
	 * @param {Range} range range to process
	 * @returns {Object} as `Range`, but container identified by XPath
	 * @memberof RangeUtils
	 */
	static toObject(range) {
		return {
			startContainerPath: NodeUtils.path(range.startContainer),
			startOffset: range.startOffset,
			endContainerPath: NodeUtils.path(range.endContainer),
			endOffset: range.endOffset,
			collapsed: range.collapsed,
		}
	}

	/**
	 * Convert XRange object into a Range object in a document
	 * 
	 * @static
	 * @param {Object} object - XRange object to parse
	 * @param {Object} [document=window.document] - document from which to create the Range
	 * @returns {Range} - Parsed range object, or null on error
	 * @memberof RangeUtils
	 */
	static toRange(object, document = window.document) {
		let endContainer, endOffset
		const evaluator = new XPathEvaluator()
		
		// must have legal start and end container nodes
		const startContainer = evaluator.evaluate(
			object.startContainerPath,
			document.documentElement,
			null,
			XPathResult.FIRST_ORDERED_NODE_TYPE,
			null
		)

		if (!startContainer.singleNodeValue) {
			return null
		}
		
		if (object.collapsed || !object.endContainerPath) {
			endContainer = startContainer
			endOffset = object.startOffset
		} else {
			endContainer = evaluator.evaluate(
				object.endContainerPath,
				document.documentElement, 
				null,
				XPathResult.FIRST_ORDERED_NODE_TYPE, 
				null
			)

			if (!endContainer.singleNodeValue) {
				return null;
			}

			endOffset = object.endOffset;
		}
		
		// map to range object
		const range = document.createRange()

		range.setStart(startContainer.singleNodeValue, object.startOffset)
		range.setEnd(endContainer.singleNodeValue, endOffset)

		return range
	}
}

/**
 * Utils for Node
 * 
 * @class NodeUtils
 */
class NodeUtils {
	/**
	 * Get the XPath of a node within its hierarchy
	 * 
	 * @static
	 * @param {Object} node - node to process within its owner document
	 * @returns {string} xpath of node, or empty string if no tests could be identified
	 * @memberof RangeUtils
	 */
	static path(node) {
		let tests = []
		
		// if the chain contains a non-(element|text) node type, we can go no further
		for (;
			node && (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE);
			node = node.parentNode) {
			// node test predicates
			let predicates = []

			// format node test for current node
			let test = (() => {
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

			if (node.nodeType === Node.ELEMENT_NODE && node.id.length > 0) {
				// if the node is an element with a unique id within the *document*, it can become the root of the path,
				// and since we're going from node to document root, we have all we need.
				if (node.ownerDocument.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
					// because the first item of the path array is prefixed with '/', this will become 
					// a double slash (select all elements). But as there's only one result, we can use [1]
					// eg: //span[@id='something']/div[3]/text()
					tests.unshift(`/${test}[@id="${node.id}"]`)
					break
				} 
				
				if (node.parentElement && !Array.prototype.slice
					.call(node.parentElement.children)
					.some(sibling => sibling !== node && sibling.id === node.id)) {
					// There are multiple nodes with the same id, but if the node is an element with a unique id 
					// in the context of its parent element we can use the id for the node test
					predicates.push(`@id="${node.id}"`)
				}
			}

			if (predicates.length === 0) {
				// Get node index by counting previous siblings of the same name & type
				let index = 1

				for (let sibling = node.previousSibling; sibling; sibling = sibling.previousSibling) {
					// Skip DTD,
					// Skip nodes of differing type AND name (tagName for elements, #text for text),
					// as they are indexed by node type
					if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE ||
						node.nodeType !== sibling.nodeType ||
						sibling.nodeName !== node.nodeName) {
						continue
					}

					index++
				}

				// nodes at index 1 (1-based) are implicitly selected
				if (index > 1) {
					predicates.push(`${index}`)
				}
			}

			// format predicates
			tests.unshift(test + predicates.map(p => `[${p}]`).join(''))
		} // end for

		// return empty path string if unable to create path
		return tests.length === 0 ? "" : `/${tests.join('/')}`
	}
}