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


// module named 'controller', no dependencies
const controllerModule = angular.module('controller', [])

// Controller named 'popupController'
controllerModule.controller('popupController', ["$scope", function ($scope) {
	/**
	 * @typedef {Object} Scope
	 * @prop {string} sharedHighlightClassName
	 * @prop {Object} manifest
	 * @prop {Object} commands
	 * @prop {Sort} sort
	 * @prop {Object} search
	 * @prop {Filters} filters
	 * 
	 * @prop {Object[]} highlightDefinitions 
	 * @prop {number} popupHighlightTextMaxLength 
	 * @prop {boolean} fileAccessRequiredWarningVisible
	 * @prop {Object[]} groupedDocs 
	 * @prop {Object[]} docs
	 */

	/**
	 * @typedef {Object} Sort
	 * @prop {string} [value]
	 * @prop {boolean} [invert]
	 */
	 
	/**
	 * @typedef {Object} Filters
	 * @prop {Function} group
	 * @prop {Function} text
	 */

	class Controller {
		/**
		 * Creates an instance of Controller.
		 * @param {Scope} scope 
		 * @param {Document} document 
		 * @memberof Controller
		 */
		constructor(scope, document) {
			// assign synchronously available commands
			this.scope = scope
			this.document = document

			// not initialized yet
			this.styleSheetManager = new StyleSheetManager(this.document)

			this.scope.sharedHighlightClassName = this.styleSheetManager.sharedHighlightClassName
			this.scope.manifest = chrome.runtime.getManifest()
			this.scope.commands = {}
			// this.scope.sort = {}
			this.scope.search = {}
			this.scope.filters = {
				// by style and text of any document within group
				group: (group) => {
					const searchText = this.scope.search.text && this.scope.search.text.toLowerCase()
		
					return group.docs.some(doc => {
						// delegate to search.text and styleFilterPredicate
						return (!searchText ||
							(typeof doc.text === 'string' && doc.text.toLowerCase().indexOf(searchText) != -1
						))
					})
				},
		
				// by current text search string of document
				text: (doc) => {
					const searchText = this.scope.search.text && this.scope.search.text.toLowerCase()
		
					return (!searchText || (
						typeof doc.text === 'string'
						&& doc.text.toLowerCase().indexOf(searchText) != -1
					))
				},
			}

			// add function references to scope
			for (const func of [
				this.onMouseEnterHighlight,
				this.onMouseLeaveHighlight,

				this.onClickHighlight,
				this.onClickExpandHighlight,
				this.onClickRemoveHighlight,

				this.onClickCopyHighlight,
				this.onClickSelectHighlight,
				this.onClickSpeakHighlight,
				this.onClickDefineHighlight,

				this.onClickUndoLastHighlight,
				this.onClickOpenOverview,
				this.onClickSaveOverview,
				this.onClickCopyOverview,
				this.onClickRemoveAllHighlights,

				this.onClickDismissFileAccessRequiredWarning
			]) {
				this.scope[func.name] = func.bind(this)
			}
		}

		/**
		 * Async initializer of class. Mainly scope properties
		 * 
		 * @returns {Promise}
		 * @memberof Controller
		 */
		init() {
			// required in later promise
			let activeTabURL
			
			// adds style element to document
			this.styleSheetManager.init()
			
			// async
			// 1 - get current highlight styles, and apply to DOM
			return new ChromeHighlightStorage().getAll().then(items => {
					// 1 - shared highlight styles
					let key = ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE

					if (items[key]) {
						this.styleSheetManager.setRule({
							className: this.styleSheetManager.sharedHighlightClassName,// "highlight",
							style: items[key]
						})
					}

					// 2 - must apply per-style rules last
					key = ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS
					if (items[key]) {
							for (const hd of items[key]) {
								this.styleSheetManager.setRule(hd)
							}
					}
			
					return ChromeTabs.queryActiveTab()
			}).then(tab => {
				if (!tab) {
					return Promise.reject(new Error('no active tab'))
				}

				activeTabURL = new URL(tab.url)

				return new ChromeHighlightStorage().getAll()
			}).then(items => {
				// array of highlight definitions
				this.scope.highlightDefinitions = items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]

				return new ChromeStorage().get([
					ChromeStorage.KEYS.POPUP_HIGHLIGHT_TEXT_MAX_LENGTH,
					ChromeStorage.KEYS.FILE_ACCESS_REQUIRED_WARNING_DISMISSED,
					ChromeStorage.KEYS.HIGHLIGHT.SORT_BY,
					ChromeStorage.KEYS.HIGHLIGHT.INVERT_SORT,
				])
			}).then(items => {
				// 1 - initialize controller variables
				if (items[ChromeStorage.KEYS.POPUP_HIGHLIGHT_TEXT_MAX_LENGTH]) {
					this.scope.popupHighlightTextMaxLength = items[ChromeStorage.KEYS.POPUP_HIGHLIGHT_TEXT_MAX_LENGTH]
				}

				this.scope.sort = {
					value: items[ChromeStorage.KEYS.HIGHLIGHT.SORT_BY],
					invert: items[ChromeStorage.KEYS.HIGHLIGHT.INVERT_SORT],
				}

				// if the url protocol is file based, and the
				// user hasn't been warned to enable
				// file access for the extension, set a flag now. 
				// The view will set the warning's
				// visibility based on its value.

				// 2 - if its already been dismissed before, no need to check
				const dismissed = items[ChromeStorage.KEYS.FILE_ACCESS_REQUIRED_WARNING_DISMISSED] || (() => {
					// it not being a file protocol url is the same as invisible (dismissed)
					return ('file:' !== activeTabURL.protocol)
				})()

				// name of property in scope object
				this.scope.fileAccessRequiredWarningVisible = !dismissed

				// 3 - listen for variable change, and sync value to storage
				this.scope.$watch(Controller.SCOPE.NAME.FILE_ACCESS_REQUIRED_WARNING_VISIBLE, (newValue, oldValue) => {
					if (newValue === oldValue) {
						return
					}

					// unhandled promise
					new ChromeStorage().set(!newValue, ChromeStorage.KEYS.FILE_ACCESS_REQUIRED_WARNING_DISMISSED)
				})

				// 4 - shortcut commands array
				return new Promise(resolve => {
					chrome.commands.getAll(commands => {
						// key commands by their name in the scope attribute
						// can't identify specific commands in angular
						this.scope.$apply(() => {
							for (const c of commands) {
								this.scope.commands[c.name] = c
							}
						})

						resolve()
					})
				})
			}).then(() => {
				return this.updateDocs()
			}).then(() => {
				// After the initial update, watch for changes to options object
				this.scope.$watchCollection(Controller.SCOPE.NAME.SORT, newSort => {
					// update storage
					return new ChromeStorage().set({
						[ChromeStorage.KEYS.HIGHLIGHT.SORT_BY]: newSort.value,
						[ChromeStorage.KEYS.HIGHLIGHT.INVERT_SORT]: newSort.invert,
					}).then(() => {
						return this.updateDocs()
					}).then(() => {
						this.scope.$apply()
					})
				})

				// this bullshit is done because if it finishes too quick the popup is the wrong height
				// setTimeout(() => {
					this.scope.$apply()

					// presumably the autofocus attribute effect gets overridden, so do it manually.
					this.document.querySelector('#input-search').focus()

					// if we set this too early the first value would be animated
					this.document.querySelector('#btn-sort-invert').classList.add('button-animate-transition')
				// }, 50)
			})
		}

		/**
		 * Update 'docs' and 'groupedDocs' properties of scope object, depending on current settings
		 * 
		 * @returns {Promise<Object[]>}
		 * @memberof Controller
		 */
		updateDocs() {
			let tabs

			return ChromeTabs.queryActiveTab().then(tab => {
				if (!tab) {
					return Promise.reject(new Error('no active tab'))
				}

				tabs = new ChromeTabs(tab.id)

				// get all the documents (create & delete) associated with the match, then filter the deleted ones
				return new DB().getMatchingDocuments(DB.formatMatch(tab.url), { excludeDeletedDocs: true })
			}).then(docs => {
				// if the highlight cant be found in DOM, flag that
				return Promise.all(docs.map(d => {
					return tabs.isHighlightInDOM(d._id).then(isInDOM => {
						d.isInDOM = isInDOM
					}).catch(() => {
						// swallow
						d.isInDOM = false
					}).then(() => d)
				}))
			}).then(docs => {
				// sort the docs using the sort value
				return DB.sortDocuments(
					docs,
					tabs.getComparisonFunction(this.scope.sort.value)
				)
			}).then(docs => {
				if (this.scope.sort.invert) {
					docs.reverse()
				}

				this.scope.docs = docs

				// group by days since epoch
				let groupedDocs = []

				switch (this.scope.sort.value) {
					case ChromeStorage.HIGHLIGHT_SORT_BY_VALUES.LOCATION:
						// a single untitled group containing all items sorted by location
						groupedDocs.push({ docs: docs })
						break

					case ChromeStorage.HIGHLIGHT_SORT_BY_VALUES.TIME:
						// a group for each unique day
						for (const doc of docs) {
							const date = new Date(doc[DB.DOCUMENT.NAME.DATE])
							const daysSinceEpoch = Math.floor(date.getTime() / 8.64e7)

							// first, or different days since epoch of last group
							if (groupedDocs.length === 0 || daysSinceEpoch !== groupedDocs[groupedDocs.length - 1].daysSinceEpoch) {
								// each group defines its days since epoch and an ordered array of docs
								groupedDocs.push({
									daysSinceEpoch: daysSinceEpoch,
									title: date.toLocaleDateString(undefined, {
										weekday: 'long',
										year: 'numeric',
										month: 'long',
										day: 'numeric'
									}),
									docs: []
								})
							}

							groupedDocs[groupedDocs.length - 1].docs.push(doc)
						}
						break

					case ChromeStorage.HIGHLIGHT_SORT_BY_VALUES.STYLE:
						// first map highlight classname to index of definition
						const m = new Map(this.scope.highlightDefinitions.map((d, idx) => [d.className, idx]))

						// a group for each non-empty style
						for (const doc of docs) {
							// docs are already sorted
							const index = m.get(doc[DB.DOCUMENT.NAME.CLASS_NAME])

							if (groupedDocs.length === 0 || index !== groupedDocs[groupedDocs.length - 1].definitionIndex) {
								groupedDocs.push({
									definitionIndex: index,
									title: this.scope.highlightDefinitions[index].title,
									docs: []
								})
							}

							groupedDocs[groupedDocs.length - 1].docs.push(doc)
						}
						break

					default:
						console.error(`unknown sort_by value "${this.scope.sort.value}"`)
				}

				this.scope.groupedDocs = groupedDocs

				return docs
			})
		} // end func

		// mouse event handlers

		/**
		 * Mouse entered the 'div' containing the 'span' containing highlight text
		 * 
		 * @param {Object} doc 
		 * @memberof Controller
		 */
		onMouseEnterHighlight(doc) {
			const target = /** @type {HTMLElement} **/ (event.target)
			
			// ignore children
			if (!target.classList.contains('highlight')) {
				return
			}
			
			console.assert(target.tagName === 'DIV')

			const closeClassName = StyleSheetManager.CLASS_NAME.CLOSE
			let closeElm = /** @type {HTMLButtonElement} */ (target.querySelector(`.${closeClassName}`))

			// if the element has a close button we can cancel the timer and leave it be
			if (closeElm) {
				const name = Controller.CLOSE_BUTTON.TIMER_ID_ATTRIBUTE_NAME
				
				// if it has a timer, clear it
				if (closeElm.dataset[name]) {
					clearTimeout(parseInt(closeElm.dataset[name]))
					
					delete closeElm.dataset[name]
				}
	
				return
			}

			// add the close button
			closeElm = this.document.createElement('button')
			 
			closeElm.classList.add(closeClassName)
			closeElm.addEventListener('click', this.onClickRemoveHighlight.bind(this, doc), { passive: true, capture: true, once: true })
			 
			target.appendChild(closeElm)
		}

		/**
		 * Mouse left the 'div' containing the 'span' containing highlight text
		 * 
		 * @memberof Controller
		 */
		onMouseLeaveHighlight() {
			const target = /** @type {HTMLElement} **/ (event.target)
			
			// ignore children
			if (!target.classList.contains('highlight')) {
				return
			}

			console.assert(target.tagName === 'DIV')

			let closeElm = /** @type {HTMLButtonElement} */ (target.querySelector(`.${StyleSheetManager.CLASS_NAME.CLOSE}`))
			
			if (!closeElm) {
				return
			}
	
			// name of data attribute storing hysteresis timer id
			const name = Controller.CLOSE_BUTTON.TIMER_ID_ATTRIBUTE_NAME
			
			// timer to remove close button
			closeElm.dataset[name] = setTimeout(() => {
				// remove timer id attrbiute
				delete closeElm.dataset[name]
	
				// prepare popout
				closeElm.addEventListener('animationend', (/** @type {AnimationEvent} */ event) => {
					// remove close button
					closeElm.remove()
					// @ts-ignore
				}, { once: true, capture: false, passive: true })
			
				// start animation
				closeElm.style.animation = this.styleSheetManager.buttonPopOutAnimation
	
			}, Controller.CLOSE_BUTTON.TIMEOUT).toString()
		}

		// click onhandlers

		/**
		 * Clicked on the overall highlight element (i.e. not 'close' or 'more' buttons)
		 * 
		 * @param {Object} doc - clicked document for highlight
		 * @returns {Promise}
		 * @memberof Controller
		 */
		onClickHighlight(doc) {
			// if not in the DOM it shouldn't 
			if (!doc.isInDOM) {
				return
			}

			// scroll to the highlight, in the active tab
			return ChromeTabs.queryActiveTab().then(tab => {
				if (!tab) {
					return Promise.reject(new Error('no active tab'))
				}
				
				return new ChromeTabs(tab.id).scrollToHighlight(doc._id)
			})
		}

		/**
		 * Clicked the remove (x) button on a highlight
		 * 
		 * @param {Object} doc - 'create' document for highlight to remove
		 * @returns {Promise}
		 * @memberof Controller
		 */
		onClickRemoveHighlight(doc) {
			// don't allow highlight to be scrolled to
			event.stopPropagation()

			// doc doesn't have to be in DOM to be removed from DB
			return ChromeTabs.queryActiveTab().then(tab => {
				if (!tab) {
					return Promise.reject(new Error('no active tab'))
				}

				// remove document from database
				return new Highlighter(tab.id).delete(doc._id)
			}).then(responses => {
				// response is empty array if no documents needed to be removed, which is still a success
				if (responses.some(({ ok }) => ok)) {
					return Promise.resolve();//reject(new Error())
				}

				// regroup documents in popup controller
				return this.updateDocs()
			}).then(docs => {
				// close popup on last doc removed
				if (typeof docs === 'undefined' || docs.length === 0) {
					window.close()
					return
				}

				// force update
				this.scope.$apply()
			})
		}

		/**
		 * Clicked on the 'more' link to show > 512 characters of text of a highlight
		 * 
		 * @param {Object} doc - document to expand
		 * @memberof Controller
		 */
		onClickExpandHighlight(doc) {
			// don't navigate
			event.stopPropagation()

			// replace the inner text of the span associated with the highlight
			
			/** @type {HTMLSpanElement} */
			const elm = this.document.querySelector(`#${doc._id} .highlight-text`)
			elm.innerText = doc.text
		}

		// infobar event handlers

		/**
		 * Copy the text property value of a document to the clipboard (text format)
		 * 
		 * @param {Object} doc - 'create' doc of highlight
		 * @returns {boolean} true on success
		 * @memberof Controller
		 */
		onClickCopyHighlight(doc) {
			if (typeof doc.text !== 'string') {
				return false
			}

			if (ClipboardUtils.copy(doc.text, window.document)) {
				window.close()
				return true
			}

			return false
		}

		/**
		 * Select the text of the highlight in the document
		 * 
		 * @param {Object} doc 
		 * @returns {Promise}
		 * @memberof Controller
		 */
		onClickSelectHighlight(doc) {
			if (!doc.isInDOM) {
				return Promise.reject(new Error('not in DOM'))
			}

			return ChromeTabs.queryActiveTab().then(tab => {
				if (!tab) {
					return Promise.reject(new Error('no active tab'))
				}
			
				const tabs = new ChromeTabs(tab.id)

				// select and scroll to it
				return tabs.selectHighlight(doc._id).then(() => tabs.scrollToHighlight(doc._id))
			}).then(() => { 
				window.close() 
			})
		}

		/**
		 * Speak the text content of the highlight
		 * 
		 * @param {Object} doc 
		 * @returns {Promise}
		 * @memberof Controller
		 */
		onClickSpeakHighlight(doc) {
			const text = doc[DB.DOCUMENT.NAME.TEXT]

			if (typeof text !== 'string') {
				return Promise.resolve()
			}

			// get the lang attribute of the document root element (html)
			// workaround for Google Deutsch becoming the default voice, for some reason
			return ChromeTabs.queryActiveTab().then(tab => {
				if (!tab) {
					return Promise.reject(new Error('no active tab'))
				}

				return new ChromeTabs(tab.id).getNodeAttributeValue('/*', 'lang')
			}).then(lang => {
				const options = typeof lang === 'string' ? { lang: lang } : {}
				chrome.tts.speak(text, options)
			})
		}

		/**
		 * (re) define the style to use for a highlight
		 * 
		 * @param {Object} doc - document defining highlight
		 * @param {Object} newDefinition - new highlight definition, whose class is applied to the highlight (entry in scope.highlightDefinitions) 
		 * @returns {Promise}
		 * @memberof Controller
		 */
		onClickDefineHighlight(doc, newDefinition) {
			if (!doc.isInDOM) {
				return Promise.reject(new Error('not in DOM'))
			}

			return ChromeTabs.queryActiveTab().then(tab => {
				if (!tab) {
					return Promise.reject(new Error('no active tab'))
				}

				return new Highlighter(tab.id).update(doc._id, newDefinition.className)
			}).then(() => {
				// update local classname, which will update class in dom
				doc.className = newDefinition.className

				// regroup only if sorted by 'style'
				if (this.scope.sort.value == ChromeStorage.HIGHLIGHT_SORT_BY_VALUES.STYLE) {
					return this.updateDocs()
				}
			}).then(() => {
				this.scope.$apply()
			})
		}

		// menu handlers

		/**
		 * Clicked 'undo' in menu
		 * 
		 * @returns {Promise}
		 * @memberof Controller
		 */
		onClickUndoLastHighlight() {
			return ChromeTabs.queryActiveTab().then(tab => {
				if (!tab) {
					return Promise.reject(new Error('no active tab'))
				}
			
				return new Highlighter(tab.id).undo()
			}).then(results => {
				if (results.some(r => !r.ok)) {
					return Promise.reject(new Error())
				}

				return this.updateDocs()
			}).then(docs => {
				// console.log(docs)
				// // close popup on last doc removed
				if (docs.length === 0) {
					window.close()
					return
				}

				this.scope.$apply()
			})
		}

		/**
		 * Clicked 'open overview' in menu
		 * 
		 * @returns {Promise<Object>} promise with chrome tab object
		 * @memberof Controller
		 */
		onClickOpenOverview() {
			return ChromeTabs.queryActiveTab().then(tab => {
				if (!tab) {
					return Promise.reject(new Error('no active tab'))
				}

				// get the full uri for the tab. the summary page will get the match for it
				const u = new URL("http://example.com/overview.html")
				const m = new Map([
					['tabId', tab.id.toString()],
					['sortby', this.scope.sort.value],
					['invert', this.scope.sort.invert === true ? "1" : ""],
				])

				for (const [key, value] of m.entries()) {
					u.searchParams.set(key, value)
				}

				return new Promise(resolve => {
					chrome.tabs.create({
						url: `${u.pathname}?${u.searchParams.toString()}`
					}, tab => {
						resolve(tab)
					})
				}) 
			})
		}

		/**
		 * Clicked 'save overview' in menu
		 * 
		 * @returns {Promise}
		 * @memberof Controller
		 */
		onClickSaveOverview() {
			return ChromeTabs.queryActiveTab().then(tab => {
				if (!tab) {
					return Promise.reject(new Error('no active tab'))
				}

				const tabs = new ChromeTabs(tab.id)

				return tabs.getFormattedOverviewText(
					ChromeTabs.OVERVIEW_FORMAT.MARKDOWN,
					tabs.getComparisonFunction(this.scope.sort.value),
					this.scope.sort.invert
				)
			}).then(text => {
				if (!text) {
					return
				}

				// create a temporary anchor to navigate to data uri
				const anchorElm = document.createElement("a")

				function utf8_to_b64(str) {
					return window.btoa(unescape(encodeURIComponent(str)))
				};

				anchorElm.download = chrome.i18n.getMessage("save_overview_file_name")
				anchorElm.href = `data:text;base64,${utf8_to_b64(text)}`

				// create & dispatch mouse event to hidden anchor
				const event = document.createEvent("MouseEvent")

				event.initMouseEvent("click", true, true, window,
					0, 0, 0, 0, 0, false, false, false, false, 0, null)

				anchorElm.dispatchEvent(event)
			})
		}

		/**
		 * Clicked 'copy overview' menu item
		 * 
		 * @returns {Promise<boolean>}
		 * @memberof Controller
		 */
		onClickCopyOverview() {
			return ChromeTabs.queryActiveTab().then(tab => {
				if (!tab) {
					return Promise.reject(new Error('no active tab'))
				}
			
				// format all highlights as a markdown document
				const tabs = new ChromeTabs(tab.id)

				return tabs.getFormattedOverviewText(
					ChromeTabs.OVERVIEW_FORMAT.MARKDOWN_NO_FOOTER,
					tabs.getComparisonFunction(this.scope.sort.value),
					this.scope.sort.invert
				)
			}).then(text => {
				if (!text) {
					return
				}

				return ClipboardUtils.copy(text, window.document)
			})
		}

		/**
		 * Clicked 'remove all highlights' menu item
		 * 
		 * @returns {Promise}
		 * @memberof Controller
		 */
		onClickRemoveAllHighlights() {
			return ChromeTabs.queryActiveTab().then(tab => {
				if (!tab) {
					return Promise.reject(new Error('no active tab'))
				}
		
				return new Highlighter(tab.id).deleteMatching(DB.formatMatch(tab.url))
			}).then(() => {
				window.close()
			})
		}

		// misc event handlers

		/**
		 * Clicked 'ok got it' button for the offline (file protocol) warning
		 * 
		 * @memberof Controller
		 */
		onClickDismissFileAccessRequiredWarning() {
			this.fileAccessRequiredWarningVisible = false
		}
	} // end class Controller

	// static properties

	Controller.CLOSE_BUTTON = {
		// name of data attribute containing hysteresis timer id
		TIMER_ID_ATTRIBUTE_NAME: 'timerId',
		// hysteresis time timoout
		TIMEOUT: 500
	}


	Controller.SCOPE = {
		NAME: {
			SORT: 'sort',
			// MANIFEST: 'manifest',
			// COMMANDS: 'commands',
			// SEARCH: 'search',
			// FILTERS: 'filters',

			FILE_ACCESS_REQUIRED_WARNING_VISIBLE: 'fileAccessRequiredWarningVisible',
			// HIGHLIGHT_DEFINITIONS: 'highlightDefinitions',
			// POPUP_HIGHLIGHT_TEXT_MAX_LENGTH: 'popupHighlightTextMaxLength',
			// GROUPED_DOCS: 'groupedDocs',
			// DOCS: 'docs',
		},
	}

	// TODO: unhandled promise
	new Controller($scope, window.document).init()
}])