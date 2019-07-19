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
 * style sheet access methods
 * 
 * @class StyleSheetManager
 */
class StyleSheetManager {
  /**
	 * Creates an instance of StyleSheetManager.
	 * 
	 * @param {Document} document 
	 * @package {String} sharedHighlightClassName optional name that the shared hightlight class should use. defaults to random string
	 * @package {String} styleElementId optional id that the style element will use. defaults to random string
	 * @memberof StyleSheetManager
	 */
	constructor(document, sharedHighlightClassName = StringUtils.newUUID(), styleElementId = StringUtils.newUUID()) {
		this.document = document

		// A random class name added to every mark element, that defines its colors ONLY
		// It is styled as 'ChromeHighlightStorage.SHARED_HIGHLIGHT_STYLE'
		this.sharedHighlightClassName = sharedHighlightClassName

		// As above, but defines the structure (padding, margin etc)
		this.sharedContentClassName = StringUtils.newUUID()
		
		// id of single <style> element
		this.styleElementId = styleElementId
  }

  /**
   * Prepare the document
   * 
	 * @returns {StyleSheetManager} this
   * @memberof StyleSheetManager
   */
  init() {
		// Every document needs a stylesheet inside its head element. It will contain the rules for animation and close button.
		// The shared highlight definition style, and each specific highlight definition style, are added later via the content script.
		
		// remove existint
		let elm = this.document.getElementById(this.styleElementId)

		if (elm) {
			this.document.head.removeChild(elm)
		}

		elm = /** @type {HTMLStyleElement} */ (this.document.createElement('style'))
		
		elm.type = 'text/css'
		elm.id = this.styleElementId

		// add to enable sheet property
		// console.assert(!this.document.querySelector(`#${elm.id}`))
		this.document.head.appendChild(elm)
	
		// random animation names
		const buttonPopInAnimationName = StringUtils.newUUID()
		const buttonPopOutAnimationName = StringUtils.newUUID()
		
		// shorthand standard animation property for popout
		this.buttonPopOutAnimation = `275ms ease-out ${buttonPopOutAnimationName}`
				
		const rules = [
				// non-appearance styles common to highlights
				`.${this.sharedContentClassName} {
					${StyleSheetManager.DECLARATIONS.CONTENT}
				}`,

				// close
				`.${this.sharedHighlightClassName} .${StyleSheetManager.CLASS_NAME.CLOSE} {
						${StyleSheetManager.DECLARATIONS.CLOSE}
						animation-name: ${buttonPopInAnimationName}
				}`,
				
				`.${this.sharedHighlightClassName} .${StyleSheetManager.CLASS_NAME.CLOSE}:hover,
				 .${this.sharedHighlightClassName} .${StyleSheetManager.CLASS_NAME.CLOSE}:focus {
						${StyleSheetManager.DECLARATIONS.CLOSE_HOVER_FOCUS}
				}`,

				`@media print {
					.${this.sharedHighlightClassName} {
						${StyleSheetManager.DECLARATIONS.MEDIA_PRINT__SHARED_HIGHLIGHT}
					}
				}`,

				// animation
				`@keyframes ${buttonPopInAnimationName} {
					${StyleSheetManager.ANIMATION_KEYFRAMES.BUTTON_POP_IN}	
				}`,
				`@keyframes ${buttonPopOutAnimationName} {
					${StyleSheetManager.ANIMATION_KEYFRAMES.BUTTON_POP_OUT}	
				}`,
		]
		
		for (const rule of rules) {
				/** @type {CSSStyleSheet} */ (elm.sheet).insertRule(rule, (elm.sheet).cssRules.length)
		}
		// elm.appendChild(this.document.createTextNode(rules.join('\n')))

		return this
	}

  //

  /**
   * Insert or replace a style rule for a highlight definition
   * 
   * @param {HighlightDefinitionFactory.HighlightDefinition} highlightDefinition 
	 * @param {boolean} [important = false] true to make color & background-color rules important, which sometimes helps with -webkit-print*
	 * @returns {Promise}
   * @memberof StyleSheetManager
   */
  setRule(highlightDefinition, important = false) {
		// copy style (aka rules object)
		const rules = Object.assign({}, highlightDefinition.style)

		// account for styles defined before box-shadow was defined
		const backgroundColor = rules['background-color']
		
		const match = new RegExp("^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})", "ig").exec(backgroundColor)

		if (!match || match.length < 4) {
			return Promise.reject(new Error("highlight style background colour not in #RRGGBB format"))
		}

		if (!highlightDefinition.disableBoxShadow) {
			rules['box-shadow'] = `0 0 0.35em ${backgroundColor}`
		}

		if (highlightDefinition.inherit_style_color) {
			rules['color'] = 'inherit'
		}
		
		const suffix = important ? " !important" : ""
		
		if (rules['color']) {
			rules['color'] += suffix
		}

		return new ChromeStorage().get(ChromeStorage.KEYS.HIGHLIGHT_BACKGROUND_ALPHA).then(a => {
			// format CSS background color in rgba format
			rules['background-color'] = `rgba(${[
				match[1],
				match[2],
				match[3],
				a || 1
			].map(i => (typeof i === 'string' ? parseInt(i, 16) : i)).join(', ')})${suffix}`

			// delete existing rule, if it exists
			const idx = this.deleteRule(highlightDefinition.className)
			// format as cssRule
			const rule = `.${highlightDefinition.className}
				${JSON.stringify(rules, null, '\t')
					.replace(/"/g,'')
					.replace(/,\n/g,';')
					.replace(/\}/g, ';}')}
			`
			const styleElm = /** @type {HTMLStyleElement} */ (this.document.getElementById(this.styleElementId))
			const sheet = /** @type {CSSStyleSheet} */ (styleElm.sheet)

			// try to insert replacement rule at same index
			sheet.insertRule(rule, idx === -1 ? sheet.cssRules.length : idx)
		})
  }

  /**
   * Delete a rule in the single shared style element
   * 
   * @param {string} highlightDefinitionClassName 
   * @returns {number} index rule occupied in cssRules of the single sheet, or -1
   * @memberof StyleSheetManager
   */
  deleteRule(highlightDefinitionClassName) {
		// sheet of the single style element
		const elm = /** @type {HTMLStyleElement} */ (this.document.querySelector(`#${this.styleElementId}`))
		const sheet = /** @type {CSSStyleSheet} */ (elm.sheet)
		const selectorText = `.${highlightDefinitionClassName}`

		// find index of rule with selector consisting only of this class name
		for (let idx=0; idx < sheet.cssRules.length; idx++) {
			const rule = /** @type {CSSStyleRule} */ (sheet.cssRules[idx])

			if (rule.type === CSSRule.STYLE_RULE && rule.selectorText === selectorText) {
				sheet.deleteRule(idx)
				return idx
			}
		}

		return -1
	}
	
	//

	/**
	 * Convert the DOM representation of our single style element to its identical text form
	 * (so it can be saved)
	 * 
	 * @returns {string} text of element
	 * @memberof StyleSheetManager
	 */
	textualizeStyleElement() {
		const styleElm = /** @type {HTMLStyleElement} */ (this.document.getElementById(this.styleElementId))

		if (!styleElm) {
			return ""
		}

		const sheet = /** @type {CSSStyleSheet} */ (styleElm.sheet)
		const text = Array.from(sheet.cssRules).map(({cssText}) => cssText).join('\n\n')

		styleElm.textContent = text

		return text
	}
}// end class

// static properties

StyleSheetManager.CLASS_NAME = {
  // close button added to each mark element
  CLOSE: 'ssh-close'
}

StyleSheetManager.DECLARATIONS = {
	// styles that all highlights should have, independent of highlight color
	// font: inherit !important;
	// position: relative needed because close button is a child of the mark, and positions itself relative to it
	CONTENT: `
		position: relative !important;
  	border-radius: 0.2em !important;
    padding: 0px !important;
    margin: 0px !important;
	`,

	MEDIA_PRINT__SHARED_HIGHLIGHT: `
		box-shadow: unset !important;
		-webkit-print-color-adjust: exact !important;
	`,
	
	// padding: 0;
	// name of animation is dynamic so has to be formatted separately
  CLOSE: `
		position: absolute;
		left: -8px;
		top: -8px;
		width: 16px;
		height: 16px;
		z-index: 999;
		border: none;
		background: url(data:image/png;base64,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) no-repeat;
		background-origin: border-box;
		animation-duration: 275ms;
		animation-timing-function: ease-out;
		box-shadow: none;
  `,

	CLOSE_HOVER_FOCUS: `
		background-image: url(data:image/png;base64,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);
	`
}

StyleSheetManager.ANIMATION_KEYFRAMES = {
	BUTTON_POP_IN: `
		from {
			opacity: 0;
			transform: scale(0.6);
		}

		to {
			opacity: 1;
			transform: scale(1);
		}
	`,

	BUTTON_POP_OUT: `
		to {
			opacity: 0;
			transform: scale(0.3);
		}
	`
}
