/*global angular, _eventPage, _i18n, _storage, purl*/

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

// disable console log
// console.log = function() {}

/**
 * Controllers module
 * @type {ng.IModule}
 */
var overviewControllers = angular.module('overviewControllers', []);


// array this is something to do with minification
overviewControllers.controller('DocumentsController', ["$scope", function ($scope) {
    'use strict';
	var backgroundPage;
	
    $scope.manifest = chrome.runtime.getManifest();

    /**
     * Initializer, called from the starter section
     * @param {number} [tabId] tab id of the tab associated with the popup that navigated here, or NaN if not known or specified
     * @param {string} url tab url
     * @param {string} [title] optional tab title
     * @param {Object} bgPage
	   * @param {string} sortby
	   * @param {boolean} invert
     */
    function onInit(tabId, url, title, bgPage, sortby, invert){
		$scope.tabId = tabId;
		$scope.url = url;

		// share title with that of the source page
		$scope.title = title;
		$scope.sortby = sortby;
		// document.title = chrome.i18n.getMessage("overview_document_title", [title]);

		// used to scroll tab's page to the clicked highlight
		backgroundPage = bgPage;

		const db = new DB()
		const match = DB.formatMatch(url) 
		const tabs = new ChromeTabs(tabId)
		
		// get all the documents (create & delete) associated with the match, then filter the deleted ones
		return db.getMatchingDocuments(match, { excludeDeletedDocs: true}).then(docs => {
			const comparator = tabs.getComparisonFunction(sortby)

			// default to native order
			return (comparator && DB.sortDocuments(docs, comparator)) || docs
		}).then(docs => {
			if (invert) {
				docs.reverse()
			}
			
			// group by days since epoch
			let groupedDocs = []

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
			
			$scope.groupedDocs = groupedDocs
            $scope.docs = docs
			
			// we form the plural string in the controller instead of the view, because ngPluralize can't refer to i18n things
			let messageName = (() => {
				switch (docs.length) {
					case 0:
						return "plural_zero_highlights"
					case 1:
						return "plural_one_highlight"
					default:
						return "plural_other_highlights"
				}
			})()
			
			$scope.docsCount = chrome.i18n.getMessage(messageName, [docs.length])
			$scope.$apply();

			// if the highlight cant be found in DOM, flag that
			if (isNaN(tabId)) {
				return
			}
			
			return Promise.all(docs.map(doc => {
				return tabs.isHighlightInDOM(doc._id).then(value => doc.isInDOM = value)
			})).then(() => $scope.$apply())

            // if (!isNaN(tabId)) {
            //     docs.forEach(function (doc) {
            //         // default to undefined, implying it IS in the DOM
            //         backgroundPage._eventPage.isHighlightInDOM(tabId, doc._id).then(function (isInDOM) {
            //             doc.isInDOM = isInDOM;

            //             $scope.$apply();
            //         });
            //     });
            // }
        });
    }

	/**
	 * Clicked the header, showing the source page title.
     * Makes corresponding tab active
	 * @type function
	 */
	// $scope.onClickPageUrl = function () {
	// 	// make the tab which was associated with the popup that launched us the active tab.
	// 	// If it has been closed nothing will happen (but the user can open explicitly from the anchor instead)
	// 	chrome.tabs.update($scope.tabId, {
	// 		active: true
	// 	});
	// }

	/**
	 * Clicked a highlight. Make the associated tab active, and scroll it to its position
	 * @param {Object} doc highlight document which was clicked
	 */	
	$scope.onClickHighlight = function(doc) {
		const tabId = $scope.tabId

		return new ChromeTabs(tabId).scrollToHighlight(doc._id).then(ok => {
			if (!ok) {
				return
			}
			
			// if scrolling to the element is successful, only then we can make the tab active
			chrome.tabs.update(tabId, { active: true })
		})
	}

	/**
	 * Starter 
	 * parse href (supplied by popup's controller) to find url, which is used to find match string
	 */
	const searchParams = new URL(location.href).searchParams

	if (searchParams.has('url')) {
		chrome.runtime.getBackgroundPage(function (backgroundPage) {
			const id = searchParams.get('id')
			const url = searchParams.get('url')
			const title = searchParams.get('title')
			const sortby = searchParams.get('sortby')
			const invert = Boolean(searchParams.get('invert'))
			
            onInit(parseInt(id), url, title, backgroundPage, sortby, invert)
        })
	}
}]);