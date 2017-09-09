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

// depended on by app module
const controllerModule = angular.module('controller', []);

controllerModule.controller('overviewController', ["$scope", function ($scope) {
	/**
	 * @typedef {Object} Scope
	 * @prop {Object} manifest
	 * @prop {string} url
	 * @prop {string} [title]
	 * @prop {string} sortby
	 * @prop {string} docsCountText
	 * @prop {Object[]} groupedDocs 
	 */

	class Controller {
		/**
		 * Creates an instance of Controller.
		 * @param {Scope} scope - controller $scope
		 * @param {number} tabId - id of tab that launched overview
		 * @param {Document} document - html document
		 * @memberof Controller
		 */
		constructor(scope, tabId, document) {
			this.scope = scope
			this.tabId = tabId
			this.document = document

			this.scope.manifest = chrome.runtime.getManifest()

			for (const func of [this.onClickHighlight]) {
				this.scope[func.name] = func.bind(this)
			}
		}

		/**
		 * Async init
		 * 
		 * @param {URL} locationURL - URL of the document (not the page it refers to)
		 * @returns {Promise}
		 * @memberof Controller
		 */
		init(locationURL) {
			const tabs = new ChromeTabs(this.tabId)
			const db = new DB()

			const searchParams = locationURL.searchParams
			
			this.scope.sortby = searchParams.get('sortby')

			// if the url doesn't have a query value for the page's url, get it from the tab id
			return tabs.get().then(tab => {
				this.scope.url = searchParams.has('url') ? searchParams.get('url') : tab.url
				this.scope.title = searchParams.has('title') ? searchParams.get('title') : tab.title
				
				return new ChromeHighlightStorage().getAll()
			}).then(items => {
				const styleSheetManager = new StyleSheetManager(this.document)
				
				// adds style element to document
				styleSheetManager.init()

				// 1 - shared highlight styles
				let key = ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE

				if (items[key]) {
					styleSheetManager.setRule({
						className: "highlight",
						style: items[key]
					})
				}

				// 2 - must apply per-style rules last
				key = ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS
				if (items[key]) {
						for (const hd of items[key]) {
							styleSheetManager.setRule(hd)
						}
				}
		
				// get all the documents (create & delete) associated with the match, then filter the deleted ones
				return db.getMatchingDocuments(DB.formatMatch(this.scope.url), { excludeDeletedDocs: true})
			}).then(docs => {
				const comparator = tabs.getComparisonFunction(this.scope.sortby)
	
				// default to native order
				return (comparator && DB.sortDocuments(docs, comparator)) || docs
			}).then(docs => {
				if (Boolean(locationURL.searchParams.get('invert'))) {
					docs.reverse()
				}
				
				this.docs = docs

				// group by days since epoch
				const groupedDocs = []
	
				for (const d of docs) {
					const date = new Date(d[DB.DOCUMENT.NAME.DATE])
					const daysSinceEpoch = Math.floor(date.getTime() / 8.64e7)
	
					// first, or different days since epoch of last group
					if (groupedDocs.length === 0 || daysSinceEpoch !== groupedDocs[groupedDocs.length-1].daysSinceEpoch) {
						// each group defines its days since epoch and an ordered array of docs
						groupedDocs.push({
							daysSinceEpoch: daysSinceEpoch,
							representativeDate: date,
							docs: []
						})
					}
	
					groupedDocs[groupedDocs.length-1].docs.push(d)
				}
				
				this.scope.groupedDocs = groupedDocs
				
				// we form the plural string in the controller instead of the view, because ngPluralize can't refer to i18n things
				this.scope.docsCountText = chrome.i18n.getMessage((() => {
					switch (docs.length) {
						case 0:
							return "plural_zero_highlights"
						case 1:
							return "plural_one_highlight"
						default:
							return "plural_other_highlights"
					}
				})(), [docs.length])

				// if the highlight cant be found in DOM, flag that
				if (!isNaN(this.tabId)) {
					return Promise.all(docs.map(doc => {
						return tabs.isHighlightInDOM(doc._id).then(value => doc.isInDOM = value)
					}))
				}
			}).then(() => {
				$scope.$apply()
			})
		} // end init()

		// click handlers

		onClickHighlight(doc) {
			return new ChromeTabs(this.tabId).scrollToHighlight(doc._id).then(ok => {
				if (!ok) {
					return Promise.reject(new Error('unable to scroll to highlight'))
				}
				
				// if scrolling to the element is successful, only then we can make the tab active
				return new Promise(resolve => {
					chrome.tabs.update(this.tabId, { active: true }, tab => { resolve(tab) })
				})
			})
		}
	}// end class

	let url = new URL(location.href)

	// unhandled promise
	new Controller($scope, parseInt(url.searchParams.get('tabId')), document).init(url)
}]);