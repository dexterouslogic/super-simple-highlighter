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
 * Handlers for chrome.runtime events
 * 
 * @class ChromeRuntimeHandler
 */
class ChromeRuntimeHandler {
 /**
  * Creates an instance of ChromeRuntimeHandler.
  * 
  * @param {StyleSheetManager} styleSheetManager 
  * @param {Document} document 
  * @memberof ChromeRuntimeHandler
  */
 constructor(styleSheetManager, document) {
   this.styleSheetManager = styleSheetManager
   this.document = document
 }
 
 /**
  * Initializer
  * 
  * @returns {ChromeRuntimeHandler}
  * @memberof ChromeRuntimeHandler
  */
 init() {
   chrome.runtime.onMessage.addListener(this.onMessage.bind(this))

   return this
 }

 /**
  * Message received 
  * 
  * @typedef {Object} Message
  * @prop {string} id
  * @prop {Object} range - xrange
  * @prop {string} [highlightId]
  * @prop {string} [className]
  * @prop {string} [xpathExpression]
  * @prop {string} [attributeName]
  * 
  * @private
  * @param {Message} message 
  * @param {Object} sender 
  * @param {Function} sendResponse - Function to call (at most once) when you have a response. 
  *   This function becomes invalid when the event listener returns, unless you return true from the event listener to indicate you wish to send a response asynchronously 
  * @memberof ChromeRuntimeHandler
  */
 onMessage(message, sender, sendResponse) {
   let response

   switch (message.id) {
     case ChromeTabs.MESSAGE_ID.CREATE_HIGHLIGHT:
       // return true if created
       response = ( /** @type {function(Object, string, string): boolean} */ (xrange, highlightId, className) => {
         let range

         // this is likely to cause exception when the underlying DOM has changed
         try {
           range = RangeUtils.toRange(xrange, this.document)
           if (!range) {
               throw new Error(`Unable to parse xrange`)
           }
         } catch (e) {
             // console.error(`Exception parsing xpath range ${xrange}: ${err.message}`)
             return false
         }

         const elms = this.createHighlight(range, highlightId, className)
         return elms.length > 0
       })(message.range, message.highlightId, message.className)
       break

     case ChromeTabs.MESSAGE_ID.UPDATE_HIGHLIGHT:
       // return true if created
       response = this.updateHighlight(message.highlightId, message.className).length > 0
       break

     case ChromeTabs.MESSAGE_ID.DELETE_HIGHLIGHT:
       response = this.deleteHighlight(message.highlightId).length > 0
       break

     case ChromeTabs.MESSAGE_ID.SELECT_HIGHLIGHT:
       response = (/** @type {function([string]): [Object]} */ (highlightId) => {
         const range = this.selectHighlight(highlightId)
         
         // return range or null if no highlight specified
         return (highlightId && range) ? RangeUtils.toObject(range) : null
       })(message.highlightId)
       break

     case ChromeTabs.MESSAGE_ID.SELECT_RANGE:
       response = (/** @type {function([Object]): [Object]} */ (xrange) => {
         // convert to Range
         const range = xrange ? RangeUtils.toRange(xrange, this.document) : null

         this.selectRange(range)

         // return xrange or null if no highlight specified
         return range ? RangeUtils.toObject(range) : null
       })(message.range)
       break

     case ChromeTabs.MESSAGE_ID.IS_HIGHLIGHT_IN_DOM:
       response = this.isHighlightInDOM(message.highlightId)
       break

     case ChromeTabs.MESSAGE_ID.GET_SELECTION_RANGE:
       response = RangeUtils.toObject(this.getSelectionRange())
       break

     case ChromeTabs.MESSAGE_ID.GET_RANGE_TEXT:
       response = ((xrange) => {
         const range = RangeUtils.toRange(xrange, this.document)

         // return text of range, or null if fail
         return range ? range.toString() : null
       })(message.range)
       break

     case ChromeTabs.MESSAGE_ID.SCROLL_TO_HIGHLIGHT:
       response = this.scrollToHighlight(message.highlightId)
       break

     case ChromeTabs.MESSAGE_ID.GET_HIGHLIGHT_OFFSET:
       response = (highlightId => {
         const bounds = this.getHighlightBounds(highlightId)

         return (bounds && {
           left: bounds.left,
           top: bounds.top,
         }) || null
       })(message.highlightId)
       break

     case ChromeTabs.MESSAGE_ID.GET_NODE_ATTRIBUTE_VALUE:
       response = ((xpathExpression, attributeName) => {
         const v = document.evaluate(
           xpathExpression,
           this.document,
           null,
           XPathResult.FIRST_ORDERED_NODE_TYPE,
           null
         ).singleNodeValue

         return (v &&
           v.attributes &&
           v.attributes[message.attributeName] &&
           v.attributes[message.attributeName].nodeValue) ||
           null
       })(message.xpathExpression, message.attributeName)
       break

     case ChromeTabs.MESSAGE_ID.GET_HOVERED_HIGHLIGHT_ID:
       response = this.getHoveredHighlightID()
       break


     default:
       console.error(`Unhandled message`, message)
       
       response = null
       break
   }

   // an undefined response means nothing handled it, i.e. no content script injected yet
   console.assert(typeof response !== 'undefined')
   sendResponse(response)
   
   // synchronous
   return false
 }

 //

 /**
  * Mark a range of the document
  * 
  * @private
  * @param {Range} range - range of document to highlight
  * @param {string} firstHighlightId - #id to add to first mark
  * @param {string} className - class name (aka highlight definiton id) to add to every mark
  * @returns {HTMLElement[]} - mark elements - can be empty
  * @memberof ChromeRuntimeHandler
  */
 createHighlight(range, firstHighlightId, className) {
   // 'mark' elements of range
   let elms = new Marker(document).mark(range, firstHighlightId)
   if (elms.length === 0) {
     return []
   }

   // class names to add to every mark element
   const classNames = [this.styleSheetManager.sharedHighlightClassName, className]

   for (const {classList} of elms) {
      classList.add(...classNames)
   }

   // make marked elements tabbable
   // TODO: optional
   elms[0].setAttribute('tabindex', '0')
   // firstSpan.classList.add("closeable");

   return elms
 }

 /**
  * Change a highlights style by changing its unique class
  * 
  * @private
  * @param {string} highlightId - #id of any mark element
  * @param {string} className - new class name
  * @returns {HTMLElement[]} - marked elements
  * @memberof ChromeRuntimeHandler
  */
 updateHighlight(highlightId, newClassName) {
   // don't remove these classes
   const whitelist = [this.styleSheetManager.sharedHighlightClassName]

   return new Marker(this.document).update(highlightId, newClassName, whitelist)
 }

 /**
  * Remove a highlight
  * 
  * @private
  * @param {string} highlightId - #id of any mark element
  * @returns {HTMLElement[]} - marked elements (all of which have been deleted)
  * @memberof ChromeRuntimeHandler
  */
 deleteHighlight(highlightId) {
   return new Marker(this.document).unmark(highlightId)
 }

 //

 /**
  * Select the range occupied by a highlight
  * 
  * @private
  * @param {string} [highlightId] - #id of any mark element. If falsy, remove any current selection
  * @returns {Range}
  * @memberof ChromeRuntimeHandler
  */
 selectHighlight(highlightId) {
   const range = highlightId ? 
     new Marker(this.document).getRange(highlightId) : null

   this.selectRange(range)

   // return collapsed range if falsy
   return range || new Range()
 }

 /**
  * Select a range of the document
  
  * @private 
  * @param {Range} [range] - range to select, or if falsy then clear selection
  * @memberof ChromeRuntimeHandler
  */
 selectRange(range) {
   const sel = getSelection()
   sel.removeAllRanges()

   if (!range) {
     return
   }

   sel.addRange(range)
 }

 /**
  * Get range of current selection
  * 
  * @private
  * @returns {Range}
  * @memberof ChromeRuntimeHandler
  */
 getSelectionRange() {
   const sel = this.document.getSelection()
   let range

   if (sel.isCollapsed) {
       range = new Range()
       range.collapse(false)
   } else {
       range = sel.getRangeAt(0)
   }

   return range
 }

 // 

 /**
  * Scroll element into view
  * 
  * @param {string} highlightId - #id of (first) highlight in chain
  * @returns {boolean} true if element selectable
  * @memberof ChromeRuntimeHandler
  */
 scrollToHighlight(highlightId) {
   const elm = document.getElementById(highlightId)

   if (!elm) {
     return false
   }

   elm.scrollIntoView()
   return true
 }

 //

 /**
  * Get bounding client rect of highlight (first part)
  * 
  * @private
  * @param {string} highlightId - #id of (first) highlight in chain
  * @returns {ClientRect | null} - rect or null if not found
  * @memberof ChromeRuntimeHandler
  */
 getHighlightBounds(highlightId) {
   const elm = this.document.getElementById(highlightId)
   return (elm && elm.getBoundingClientRect()) || null
 }

 //

 /**
  * Get the highlight id for the currently hovered highlight
  * 
  * @returns {string} highlight id (first mark), or empty string if none
  * @memberof ChromeRuntimeHandler
  */
 getHoveredHighlightID() {
   // identify any of the mark elements of a highlight
   const elm = this.document.querySelector(`.${this.styleSheetManager.sharedHighlightClassName}:hover`)

   if (!elm || !elm.id) {
     return ""
   }

   // only report first mark element id
   let elms = new Marker(this.document).getMarkElements(elm.id)
   return (elms.length > 0 && elms[0].id) || ""
 }

 //

 /**
  * Is a highlight with specified ID in the DOM
  * 
  * @param {string} highlightId - #id of the highlight, as defined by DB. (i.e. id of first mark element only)
  * @returns {boolean}
  * @memberof ChromeRuntimeHandler
  */
 isHighlightInDOM(highlightId) {
   // long test
   const elms = new Marker(this.document).getMarkElements(highlightId)
   return elms.length > 0 && elms[0].id === highlightId
   
   // quick test
   // const elm = this.document.getElementById(highlightId)
   // return elm && this.styleSheetManager.elementContainsSharedHighlightClass(elm)
 }

 // messages to event page

 /**
  * Send a message to the event page
  * 
  * @private
  * @static
  * @param {{id: string}} message 
  * @returns 
  * @memberof ChromeRuntimeHandler
  */
 static sendMessage(message) {
   return new Promise((resolve, reject) => {
     chrome.runtime.sendMessage(message, response => {
       if (chrome.runtime.lastError) {
         console.assert(typeof response === 'undefined')
         
         reject(new Error(chrome.runtime.lastError.message))
         return
       } 

       resolve(response)
     })
   })
 }

 /**
  * Send 'delete highlight' message to event page
  * 
  * @static
  * @private 
  * @param {string} highlightId 
  * @returns {Promise}
  * @memberof ChromeRuntimeHandler
  */
 static deleteHighlight(highlightId) {
   const message = {
     id: ChromeRuntimeHandler.MESSAGE_ID.DELETE_HIGHLIGHT,
     highlightId: highlightId
   }

   return ChromeRuntimeHandler.sendMessage(message)
 }
}

// static properties

// id for messages sent TO background page
ChromeRuntimeHandler.MESSAGE_ID = {
 DELETE_HIGHLIGHT: 'delete_highlight',
}
