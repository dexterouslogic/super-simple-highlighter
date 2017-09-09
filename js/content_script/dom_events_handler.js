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

class DOMEventsHandler {
  /**
   * Creates an instance of DOMEventsHandler.
   * 
   * @param {StyleSheetManager} styleSheetManager 
   * @param {Document} [document=window.document]
   * @memberof DOMEventsHandler
   */
  constructor(styleSheetManager, document = window.document) {
    this.styleSheetManager = styleSheetManager
    this.document = document
  }

  init() {
    const listenerOptions = { capture: true, passive: true }

    this.document.addEventListener('mouseenter', this.onMouseEnter.bind(this), listenerOptions)
    this.document.addEventListener('mouseleave', this.onMouseLeave.bind(this), listenerOptions)
    
    return this
  }

  /**
   * Mouse entered the document or ANY of its children
   * 
   * @memberof DOMEventsHandler
   */
  onMouseEnter() {
    const target = /** @type {HTMLElement} **/ (event.target)

    // the target of the event must be a highlight/mark, which we know because its class contains our style
    if (!target.id || //!target.classList ||
      !target.classList.contains(this.styleSheetManager.sharedHighlightClassName)) {
     return
   }

    // only use first element of the chain
    const elms = new Marker(this.document).getMarkElements(target.id)
    if (elms.length === 0) {
      return
    }

    // if the element has a close button we don't need to do anything, unless it had a self destruction timer
    const firstElm = elms[0]
    let closeElm = /** @type {HTMLButtonElement} */ (firstElm.querySelector(`.${StyleSheetManager.CLASS_NAME.CLOSE}`))

    if (closeElm) {
      // if it has a timer, clear it
      const name = DOMEventsHandler.CLOSE_BUTTON.TIMER_ID_ATTRIBUTE_NAME

      if (closeElm.dataset[name]) {
        clearTimeout(parseInt(closeElm.dataset[name]))
        
        delete closeElm.dataset[name]
      }

      return
    }
    
    // add the close button
    closeElm = this.document.createElement('button')

    closeElm.classList.add(StyleSheetManager.CLASS_NAME.CLOSE)
    closeElm.addEventListener('click', this.onClickClose, { capture: true, passive: false })

    firstElm.appendChild(closeElm)
  }

  /**
   * Mouse left the document or ANY of its children
   * 
   * @memberof DOMEventsHandler
   */
  onMouseLeave() {
    const target = /** @type {HTMLElement} **/ (event.target)

    // the target of the event must be a highlight/mark, which we know because its class contains our style
    if (!target.id || //!target.classList ||
       !target.classList.contains(this.styleSheetManager.sharedHighlightClassName)) {
      return
    }

    // only use first element of the chain
    const elms = new Marker(this.document).getMarkElements(target.id)
    if (elms.length === 0) {
      return
    }

    // the first mark element should already have the close button child element
    const firstElm = elms[0]
    let closeElm = /** @type {HTMLButtonElement} */ (firstElm.querySelector(`.${StyleSheetManager.CLASS_NAME.CLOSE}`))
    
    if (!closeElm) {
      return
    }

    // name of data attribute storing hysteresis timer id
    const name = DOMEventsHandler.CLOSE_BUTTON.TIMER_ID_ATTRIBUTE_NAME

    // timer to remove close button
    closeElm.dataset[name] = setTimeout(() => {
      delete closeElm.dataset[name]

      closeElm.remove()
    }, DOMEventsHandler.CLOSE_BUTTON.TIMEOUT).toString()
  }

  //

  /**
   * Clicked 'close' button of the first mark element in the chain
   * 
   * @returns {Promise}
   * @memberof DOMEventsHandler
   */
  onClickClose() {
    // id parent element will be the first of the chain of mark elements
    const firstElm = /** @type {HTMLButtonElement} */ (event.target).parentElement

    if (!firstElm || !firstElm.id) {
      return Promise.reject(new Error('unknown highlight id'))
    }

    // send message to event page
    return ChromeRuntimeHandler.deleteHighlight(firstElm.id)
  }
}

// static properties

DOMEventsHandler.CLOSE_BUTTON = {
  // name of data attribute containing hysteresis timer id
  TIMER_ID_ATTRIBUTE_NAME: 'timerId',
  // hysteresis time timoout
  TIMEOUT: 1000
}
