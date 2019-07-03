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
 * Methods for 'marking' text (i.e. wrapping in one or more elements, usually 'mark' tags)
 * A 'mark' is the DOM level terminology for a 'highlight', which has become overused
 * 
 * @class Marker
 */
class Marker {
  /**
   * Creates an instance of Marker.
   * @param {Document} document 
   * @memberof Marker
   */
  constructor(document) {
    this.document = document
  }

  /**
   * Mark a range of the document by wrapping it in element(s)
   * 
   * @param {Range} range - range of document to highlight
   * @param {string} [id] - id to give first mark in chain of elements. If falsy, use random
   * @param {string} [tagName='mark'] - name of element tag used to mark text
   * @returns {HTMLElement[]} series of mark elements wrapping the range
   * @memberof Marker
   */
  mark(range, id, tagName = 'mark') {
    // the source of clones
    const templateElm = this.document.createElement(tagName)
    
    const elements = []

    this._mark(range, elements, () => {
      // create element to hold marked content by shallow cloning the empty template
      const elm = /** @type {HTMLElement} */ (templateElm.cloneNode(false))
      const length = elements.length

      // only give the first element the id, because it may become part of the XPath, and dynamic ids would contaminate it
      if (length === 0 && id) {
        elm.id = id
      }

      // this is how we now identify marks in the chain
      elm.dataset[Marker.DATASET_KEY.PRIVATE_ID] = StringUtils.newUUID();
      // elm.id = (length === 0 && id) ? id : StringUtils.newUUID()

      if (length > 0) {
        // subsequent marks reference to the first mark
        elm.dataset[Marker.DATASET_KEY.FIRST_MARK_ID] = elements[0].id

        // old last element links to new
        elements[length-1].dataset[Marker.DATASET_KEY.NEXT_PRIVATE_ID] = elm.dataset[Marker.DATASET_KEY.PRIVATE_ID];//elm.id
      }

      elements.push(elm)

      return elm
    })

    // console.assert(elements === this.getMarkElements(elements[0]))

    return elements
  }

  /**
   * Companion for mark()
   * 
   * @private
   * @param {Range} range 
   * @param {Array<HTMLElement>} elements - list of elements that caller is pushing each mark element to
   * @param {Function} createEmptyMarkElementFunc - callback for creating an empty 
   * @memberof Marker
   */
  _mark(range, elements, createEmptyMarkElementFunc) {
    if (range.collapsed) {
      return
    }

    let startSide = range.startContainer,
      endSide = range.endContainer,
      isLeaf = true

    if (range.endOffset === 0) {  //nodeValue = text | element
      while (!endSide.previousSibling && endSide.parentNode !== range.commonAncestorContainer) {
        endSide = endSide.parentNode
      }

      endSide = endSide.previousSibling
    } else if (endSide.nodeType === Node.TEXT_NODE) {
      if (range.endOffset < endSide.nodeValue.length) {
        /** @type {Text} */ (endSide).splitText(range.endOffset)
      }
    } else if (range.endOffset > 0) {  //nodeValue = element
      endSide = endSide.childNodes.item(range.endOffset - 1)
    }

    if (startSide.nodeType === Node.TEXT_NODE) {
      if (range.startOffset === startSide.nodeValue.length) {
          isLeaf = false
      } else if (range.startOffset > 0) {
          startSide = /** @type {Text} */ (startSide).splitText(range.startOffset)

          if (endSide === startSide.previousSibling) {
              endSide = startSide
          }
      }
    } else if (range.startOffset < startSide.childNodes.length) {
      startSide = startSide.childNodes.item(range.startOffset)
    } else {
      isLeaf = false;
    }

    range.setStart(range.startContainer, 0)
    range.setEnd(range.startContainer, 0)

    for (let done = false, node = startSide; done === false; ) {
      if (isLeaf && 
          node.nodeType === Node.TEXT_NODE &&
          !(Marker.NODE_CTORS.TABLE.some(ctor => node.parentNode instanceof ctor)))
      {
        let wrapper = node.previousSibling

        if (!wrapper || elements.length == 0 || wrapper !== elements[elements.length-1]) {
          wrapper = createEmptyMarkElementFunc(/*node*/)
          node.parentNode.insertBefore(wrapper, node)
        }

        wrapper.appendChild(node)

        node = wrapper.lastChild;
        isLeaf = false
      }

      if (node === endSide && (!isLeaf || !endSide.hasChildNodes())) {
        done = true
      }

      // never parse their children
      if (Marker.NODE_CTORS.TERMINAL.some(ctor => node instanceof ctor)) {
        isLeaf = false
      }

      if (isLeaf && node.hasChildNodes()) {
        node = node.firstChild
      } else if (node.nextSibling) {
        node = node.nextSibling
        isLeaf = true
      } else if (!node.nextSibling) {
          node = node.parentNode
          isLeaf = false
      }
    } // end for
  } // end _mark()
  
  /**
   * Remove marks
   * 
   * @param {string} id - id of any mark in the chain
   * @returns {HTMLElement[]} marked elements
   * @memberof Marker
   */
  unmark(id) {
    let elements = this.getMarkElements(id)

    if (elements.length === 0) {
      return []
    }

    for (const elm of elements) {
    // let elm = elements[0]

    // do {
      while (elm.hasChildNodes()) {
        // merge restored nodes
        const insertedNode = elm.parentNode.insertBefore(elm.firstChild, elm)

        if (insertedNode.nodeType === Node.TEXT_NODE) {
          this._mergeTextNode(insertedNode)
        }
      }

      const previousSibling = elm.previousSibling
      /*const oldChild = */elm.parentNode.removeChild(elm)

      // if removing the span brings 2 text nodes together, join them
      if (previousSibling && previousSibling.nodeType === Node.TEXT_NODE) {
        this._mergeTextNode(previousSibling)
      }

      // point to next hl (undefined for last in list)
      // TODO: Could probably just iterate elements array
      // const id = oldChild.dataset[Marker.DATASET_KEY.NEXT_MARK_ID]
      // elm = (id && this.document.getElementById(id)) || null
    }// while (elm)

    return elements
  }

  /**
   * Merge text nodes with prev/next sibling(s)
   * 
   * @param {Node} node - text node
   * @memberof Marker
   */
  _mergeTextNode(node) {
    console.assert(node.nodeType === Node.TEXT_NODE)

    if (node.nextSibling && node.nextSibling.nodeType === Node.TEXT_NODE) {
      // merge next sibling into newNode
      node.textContent += node.nextSibling.textContent
      // remove next sibling
      node.nextSibling.parentNode.removeChild(node.nextSibling)
    }

    if (node.previousSibling && node.previousSibling.nodeType === Node.TEXT_NODE) {
      // merge nodeNew into previousSibling
      node.previousSibling.textContent += node.textContent
      // remove newNode
      node.parentNode.removeChild(node)
    }
  }

  /**
   * Update the elements in the chain of marks by modifying the class list
   * 
   * @param {string} id - id of any of the elements in the mark
   * @param {string} [newClassName] - name of class to add (if defined)
   * @param {string|string[]} [classNameWhiteList=[]] - string or array of strings for existing class names to keep if present. Usually just shared highlight class name
   * @returns {HTMLElement[]} marked elements
   * @memberof Marker
   */
  update(id, newClassName, classNameWhiteList = []) {
    const whiteSet = new Set(Array.isArray(classNameWhiteList) ? classNameWhiteList : [classNameWhiteList])
    const elements = this.getMarkElements(id)

    for (const {classList} of elements) {
      // remove any class on the element that isn't in the whitelist
      classList.remove(...Array.from(classList).filter(cn => whiteSet.has(cn) === false))
      classList.add(newClassName)
    }

    return elements
  }

  //

  /**
   * Get the array of elements that define the complete mark
   * 
   * @param {string} id - id of any of the elements in the mark
   * @returns {HTMLElement[]} array of elements (may be empty)
   * @memberof Marker
   */
  getMarkElements(id) {
    // if the element has a data attribute for its 'first' element (truthy id), use that. Else assume it is the first
    const elm = this.document.getElementById(id)
    
    const key = Marker.DATASET_KEY.FIRST_MARK_ID
    const elms = [
      (elm && elm.dataset[key] && this.document.getElementById(elm.dataset[key])) || elm
    ]
    
    if (!elms[0]) {
      return []
    }

    const privateIdAttributeName = `data-${DataUtils.camelCaseToHyphen(Marker.DATASET_KEY.PRIVATE_ID)}`

    while (true) {
      // id of the last pushed element's 'nextMarkId' data attribute
      const nextPrivateId = elms[elms.length-1].dataset[Marker.DATASET_KEY.NEXT_PRIVATE_ID]
      const nextElm = (nextPrivateId && this.document.querySelector(`[${privateIdAttributeName}="${nextPrivateId}"]`)) 
        || null// this.document.getElementById(nextId)) || null
      
      if (!nextElm) {
        break
      }

      elms.push(nextElm)
    }
    
    return elms
  }

  /**
   * Get the range in the document of the entire set of marks represented by one of its ids
   * 
   * @param {string} id - if of any element in the chain
   * @returns {Range}
   * @memberof Marker
   */
  getRange(id) {
    const elements = this.getMarkElements(id)
    const range = this.document.createRange()

    for (const elm of elements) {
      if (range.collapsed) {
        range.setStartBefore(elm)
      }

      range.setEndAfter(elm)
    }

    return range
  }
}

// static properties

Marker.DATASET_KEY = {
  // html id of the first element (mark|span) in the chain. Added to all except the first
  FIRST_MARK_ID: 'firstMarkId',

  // private (non html) id assigned to an element in data (instead of #id) because that id might become part of the XPath, which only works for the first mark in chain
  PRIVATE_ID: 'privateId',
  // private (non html) id of the element that is the next part of the chain. Added to all except the last.
  NEXT_PRIVATE_ID: 'nextPrivateId'
}

Marker.NODE_CTORS = {
  TABLE: [
    HTMLTableElement,
    HTMLTableRowElement,
    HTMLTableColElement,
    HTMLTableSectionElement,
  ],

  TERMINAL: [
    HTMLScriptElement,
    HTMLStyleElement,
    HTMLSelectElement,
  ]
}