/*global angular, _eventPage, _i18n, _storage, */

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
 * Controllers module
 * @type {ng.IModule}
 */
var popupControllers = angular.module('popupControllers', []);


// array this is something to do with minification
popupControllers.controller('DocumentsController', ["$scope", function ($scope) {
	'use strict';
	// var backgroundPage;
	
	// active tab that the popup represents. Set in init()
	let activeTab = null

	// models
	$scope.manifest = chrome.runtime.getManifest();
	$scope.commands = {};
	$scope.sort = {}
	$scope.search = {}

	// filter predicates
	$scope.filters = {
		// by style and text of any document within group
		group: (group) => {
			const searchText = $scope.search.text && $scope.search.text.toLowerCase()

			return group.docs.some(doc => {
				// delegate to search.text and styleFilterPredicate
				return (
					!searchText ||
					(typeof doc.text === 'string' && doc.text.toLowerCase().indexOf(searchText) != -1)
				)
			})
		},

		// by current text search string of document
		text: (doc) => {
			const searchText = $scope.search.text && $scope.search.text.toLowerCase()

			return (!searchText
				|| (
					typeof doc.text === 'string'
					&& doc.text.toLowerCase().indexOf(searchText) != -1
				)
			)
		},
	}

	//

	// unhandled promise
	init()

	/**
	 * Initializer
	 * 
	 * @returns {Promise}
	 */
	function init() {
		// get storage values
		return new Promise(resolve => {
			// get active tab
			chrome.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs[0]))
		}).then(tab => {
			activeTab = tab

			$scope.title = activeTab.title

			// get database from background page
			return new Promise(resolve => { chrome.runtime.getBackgroundPage(b => resolve(b)) })
		}).then(({_database}) => {
			$scope.match = _database.buildMatchString(activeTab.url)
			
			return new ChromeHighlightStorage().getAll().then(items => {
				// array of highlight definitions
				$scope.highlightDefinitions = items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]
			
				return new ChromeStorage().get([
					ChromeStorage.KEYS.POPUP_HIGHLIGHT_TEXT_MAX_LENGTH,
					ChromeStorage.KEYS.FILE_ACCESS_REQUIRED_WARNING_DISMISSED,
					ChromeStorage.KEYS.HIGHLIGHT.SORT_BY,
					ChromeStorage.KEYS.HIGHLIGHT.INVERT_SORT,
				])
			})
		}).then(items => {
			// 1 - initialize controller variables
			if (items[ChromeStorage.KEYS.POPUP_HIGHLIGHT_TEXT_MAX_LENGTH]) {
				$scope.popupHighlightTextMaxLength = items[ChromeStorage.KEYS.POPUP_HIGHLIGHT_TEXT_MAX_LENGTH]
			}

			$scope.sort.value = items[ChromeStorage.KEYS.HIGHLIGHT.SORT_BY]
			$scope.sort.invert = items[ChromeStorage.KEYS.HIGHLIGHT.INVERT_SORT]

			// if the url protocol is file based, and the
			// user hasn't been warned to enable
			// file access for the extension, set a flag now. 
			// The view will set the warning's
			// visibility based on its value.
			
			// 2 - if its already been dismissed before, no need to check
			const dismissed = items[ChromeStorage.KEYS.FILE_ACCESS_REQUIRED_WARNING_DISMISSED] || (() => {
				// it not being a file protocol url is the same as invisible (dismissed)
				var u = purl(activeTab.url)
				return ('file' !== u.attr('protocol'))
			})()

			// name of property in scope object
			let name = 'fileAccessRequiredWarningVisible'
			$scope[name] = !dismissed

			// 3 - listen for variable change, and sync value to storage
			$scope.$watch(name, (newValue, oldValue) => {
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
					$scope.$apply(function () {
						for (const c of commands) {
							$scope.commands[c.name] = c
						}
					})

					resolve()
				})
			})
		}).then(() => updateDocs()).then(() => {
			// After the initial update, watch for changes to options object
			$scope.$watchCollection('sort', newSort => {
				// update storage
				return new ChromeStorage().set({
					[ChromeStorage.KEYS.HIGHLIGHT.SORT_BY]: newSort.value,
					[ChromeStorage.KEYS.HIGHLIGHT.INVERT_SORT]: newSort.invert,
				}).then(() => updateDocs()).then(() => $scope.$apply())
			})

			// this bullshit is done because if it finishes too quick the popup is the wrong height
			setTimeout(() => {
				$scope.$apply()

				// presumably the autofocus attribute effect gets overridden, so do it manually.
				$('#input-search').focus()

				// if we set this too early the first value would be animated
				$('#btn-sort-invert').addClass('button-animate-transition')
			}, 50)
		})
	}

	/**
	 * Clear and fill the 'docs' model
	 * @param {function} [callback] function(err, docs)
	 * @private
	 */
	var updateDocs = function () {
		return new Promise(resolve => {
			// get active tab
			chrome.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs[0]))
		}).then(activeTab => {
			return new Promise(resolve => { 
				chrome.runtime.getBackgroundPage(b => resolve(b)) 
			}).then(({_tabs, _database, _eventPage}) => {
				const comparator = _tabs.getComparisonFunction(activeTab.id, $scope.sort.value)

				// get all the documents (create & delete) associated with the match, then filter the deleted ones
				return _database.getCreateDocuments_Promise($scope.match).then(docs => {
					// if the highlight cant be found in DOM, flag that
					return Promise.all(docs.map(doc => {
						return _eventPage.isHighlightInDOM(activeTab.id, doc._id).then(isInDOM => {
							doc.isInDOM = isInDOM;
						}).catch(function () {
							// swallow
							doc.isInDOM = false
						}).then(function () {
							return doc;
						})
					}))
				}).then(docs => {
					// sort the docs using the sort value
					return _database.sortDocuments(docs, comparator)
				}).then(docs => {
					if ($scope.sort.invert) {
						docs.reverse()
					}

					// group by days since epoch
					let groups = []
		
					switch ($scope.sort.value) {
						case 'location':
							// a single untitled group containing all items sorted by location
							groups.push({ docs: docs })
							break
		
						case 'time':
							// a group for each unique day
							for (const doc of docs) {
								var date = new Date(doc.date)
								var daysSinceEpoch = Math.floor(date.getTime() / 8.64e7)
		
								// first, or different days since epoch of last group
								if (groups.length === 0 || daysSinceEpoch !== groups[groups.length - 1].daysSinceEpoch) {
									// each group defines its days since epoch and an ordered array of docs
									groups.push({
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
		
								groups[groups.length - 1].docs.push(doc)
							}
							break
		
						case 'style':
							// first map highlight classname to index of definition
							var m = new Map($scope.highlightDefinitions.map((d, idx) => [d.className, idx]))
		
							// a group for each non-empty style
							for (const doc of docs) {
								// docs are already sorted
								const definitionIndex = m.get(doc.className)
		
								if (groups.length === 0 || definitionIndex !== groups[groups.length - 1].definitionIndex) {
									groups.push({
										definitionIndex: definitionIndex,
										title: $scope.highlightDefinitions[definitionIndex].title,
										docs: []
									})
								}
		
								groups[groups.length - 1].docs.push(doc)
							}
							break
		
						default:
							console.assert(false)
					}
		
					$scope.groupedDocs = groups
					$scope.docs = docs
		
					return docs;
				})
			})
		})
	}

	/**
	 * Show the remaining hidden text for a specific highlight
	 * @param {Object} event mouse click event
	 * @param {Object} doc document for the specific highlight
	 */
	$scope.onClickMore = function (event, doc) {
		event.preventDefault()
		event.stopPropagation()

		// TODO: shouldn't really be in the controller...
		$(`#${doc._id} .highlight-text`).text(doc.text);
	};

	/**
	 * Click a highlight. Scroll to it in DOM
	 * @param {Object} doc document in db representing highlight clicked
	 * @returns {Promise} resolved when highlight is scrolled to
	 */
	$scope.onClickHighlight = function (doc) {
		if (!doc.isInDOM) {
			return Promise.reject(new Error())
		}

		// get background page
		return new Promise(resolve => { 
			chrome.runtime.getBackgroundPage(b => resolve(b)) 
		}).then(({_eventPage}) => {
			return _eventPage.scrollTo(activeTab.id, doc._id)
		})
	}

	/**
	 * Clicked 'select' button
	 * @param {Object} doc - document in db that should be selected
	 * @returns {Promise} resolved when highlight is selected
	 */
	$scope.onClickSelect = function (doc) {
		if (!doc.isInDOM) {
			return Promise.reject(new Error())
		}

		return new Promise(resolve => { 
			chrome.runtime.getBackgroundPage(b => resolve(b)) 
		}).then(({_eventPage}) => {
			_eventPage.selectHighlightText(activeTab.id, doc._id)

			// close popup
			window.close()
		})
	}

	/**
	 * Clicked 'copy' button for a highlight
	 * @param {string} docId - ID of doc to copy
	 * @returns {Promise} resolved when highlight is copied to clipboard
	 */
	$scope.onClickCopy = function (docId) {
		return new Promise(resolve => { 
			chrome.runtime.getBackgroundPage(b => resolve(b)) 
		}).then(({_eventPage}) => {
			_eventPage.copyHighlightText(docId)
			
			// close popup
			window.close()
		})
	}

	/**
	 * Clicked 'speak' button for a highlight
	 * @param {string} docId - ID of doc to speak
	 * @returns {Promise} resolved when highlight starts to speak
	 */
	$scope.onClickSpeak = function (docId) {
		return new Promise(resolve => { 
			chrome.runtime.getBackgroundPage(b => resolve(b)) 
		}).then(({_eventPage}) => {
			_eventPage.speakHighlightText(activeTab.id, docId)
		})
	}

	/**
	 * Clicked a style indicating a highlight's style should be changed
	 * 
	 * @param {MouseEvent} event mouse event
	 * @param {Object} doc document in db for highlight to change
	 * @param {number} index index of definition in `highlightDefinitions` array
	 * @returns {Promise} resolved when highlight starts to speak
	 */
	$scope.onClickRedefinition = function (event, doc, index) {
		event.stopPropagation()

		// get classname of new definition
		const d = $scope.highlightDefinitions[index]

		return new Promise(resolve => { 
			chrome.runtime.getBackgroundPage(b => resolve(b)) 
		}).then(({_eventPage}) => {
			return _eventPage.updateHighlight(activeTab.id, doc._id, d.className)
		}).then(() => {
			// update local classname, which will update class in dom
			doc.className = d.className

			// regroup if required
			if ($scope.sort.value !== 'style') {
				return
			}

			return updateDocs().then(() => $scope.$apply())
		})
	};

	/**
	 * Clicked 'undo' in menu
	 * 
	 * @returns {Promise}
	 */
	$scope.onClickUndoLastHighlight = function () {
		return new Promise(resolve => { 
			chrome.runtime.getBackgroundPage(b => resolve(b)) 
		}).then(({_eventPage}) => {
			return _eventPage.undoLastHighlight(activeTab.id)
		}).then(result => {
			if (!result.ok) {
				return Promise.reject(new Error());
			}

			return updateDocs()
		}).then(docs => {
			// console.log(docs)
			// // close popup on last doc removed
			if (docs.length === 0) {
				window.close()
				return
			}

			$scope.$apply();
		})
	}

	/**
	 * Clicked menu 'open overview' button.
	 * Opens a new tab, with the highlights fully displayed in it
	 */
	$scope.onClickOpenOverviewInNewTab = function () {
		// get the full uri for the tab. the summary page will get the match for it
		chrome.tabs.create({
			url: "overview.html?" +
			"id=" + activeTab.id + "&" +
			"url=" + encodeURIComponent(activeTab.url) + "&" +
			"title=" + encodeURIComponent($scope.title) + "&" +
			"sortby=" + encodeURIComponent($scope.sort.value) + "&" +
			"invert=" + ($scope.sort.invert === true ? "1" : "")
		});
	};

	/**
	 * Clicked on 'save' in menu
	 * 
	 * @returns {Promise} promise resolved when an anchor containing the text to save as a data url is saved
	 */
	$scope.onClickSaveOverview = function () {
		return new Promise(resolve => { 
			chrome.runtime.getBackgroundPage(b => resolve(b)) 
		}).then(({_tabs, _eventPage}) => {
			const comparator = _tabs.getComparisonFunction(activeTab.id, $scope.sort.value)

			// format all highlights as a markdown document
			return _eventPage.getOverviewText(
				"markdown", activeTab, comparator, $scope.styleFilterPredicate,
				$scope.sort.invert
			)
		}).then(text => {
			// create a temporary anchor to navigate to data uri
			var a = document.createElement("a");

			function utf8_to_b64(str) {
				return window.btoa(unescape(encodeURIComponent(str)));
			};

			a.download = chrome.i18n.getMessage("save_overview_file_name");
			a.href = "data:text;base64," + utf8_to_b64(text);

			// create & dispatch mouse event to hidden anchor
			var mEvent = document.createEvent("MouseEvent");
			mEvent.initMouseEvent("click", true, true, window,
				0, 0, 0, 0, 0, false, false, false, false, 0, null);

			a.dispatchEvent(mEvent);
		})
	};

	/**
	 * Clicked on 'copy' in menu
	 * 
	 * @returns {Promise} promise resolved when text copied
	 */
	$scope.onClickCopyOverview = function () {
		// format all highlights as a markdown document

		// sort the docs using the sort value
		return new Promise(resolve => { 
			chrome.runtime.getBackgroundPage(b => resolve(b)) 
		}).then(({_tabs, _eventPage}) => {
			const comparator = _tabs.getComparisonFunction(activeTab.id, $scope.sort.value)

			return _eventPage.getOverviewText(
				"markdown-no-footer", activeTab, comparator,
				$scope.styleFilterPredicate, $scope.sort.invert
			)
		}).then(text => {
			// Create element to contain markdown
			const pre = document.createElement('pre');
			pre.innerText = text

			document.body.appendChild(pre);

			const range = document.createRange()
			range.selectNode(pre);

			// make our node the sole selection
			const selection = document.getSelection()
			selection.removeAllRanges();
			selection.addRange(range);

			document.execCommand('copy');

			selection.removeAllRanges();
			document.body.removeChild(pre);

			window.close()
		})
	};

	/**
	 * Clicked 'remove' button for a highlight
	 * 
	 * @param {MouseEvent} event click event causing request
	 * @param {string} docId id of document in db to remove
	 * @returns {Promise} promise resolved when highlight removed from doc
	 */
	$scope.onClickRemoveHighlight = function (event, docId) {
		// don't scroll
		event.stopPropagation()

		return new Promise(resolve => { 
			chrome.runtime.getBackgroundPage(b => resolve(b)) 
		}).then(({_eventPage}) => {
			_eventPage.deleteHighlight(activeTab.id, docId)
		}).then(() => {
			return updateDocs()
		}).then(docs => {
			// close popup on last doc removed
			if (docs.length === 0) {
				window.close()
				return
			}

			$scope.$apply();
		})
	}

	/**
	 * Clicked 'remove all' button
	 * 
	 * @return {Promise} resolved when popup closed
	 */
	$scope.onClickRemoveAllHighlights = function () {
		return new Promise(resolve => { 
			chrome.runtime.getBackgroundPage(b => resolve(b)) 
		}).then(({_eventPage}) => {
			return _eventPage.deleteHighlights(activeTab.id, $scope.match)
		}).then(function () {
			window.close()
		})
	}

	/**
	 * Clicked 'ok got it' button for the offline (file protocol) warning
	 */
	$scope.onClickDismissFileAccessRequiredWarning = function () {
		// a listener created in the initializer will set the value to the storage
		$scope.fileAccessRequiredWarningVisible = false
	}
}]);