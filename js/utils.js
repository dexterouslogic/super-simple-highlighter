
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

class PromiseUtils {
	// const promiseSerial = funcs =>
	// funcs.reduce((promise, func) =>
	// 	promise.then(result => func().then(Array.prototype.concat.bind(result))),
	// 	Promise.resolve([])
	// )

  /**
   * Promise that runs array of promises sequentially
   * https://hackernoon.com/functional-javascript-resolving-promises-sequentially-7aac18c4431e
   * 
   * @static
   * @param {Function<Promise>[]} pfuncs - array of functions returning promises to run sequentially
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

class Base64Utils {
  static utf8_to_b64(str, w = window) {
    return w.btoa(unescape(encodeURIComponent(str)));
  }

  static b64_to_utf8(str, w = window) {
    return decodeURIComponent(escape(w.atob(str)));
  }
}