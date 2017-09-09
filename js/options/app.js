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

const appModule = angular.module('optionsApp', [
    'stylesControllers',
    'bookmarksControllers',
    'advancedControllers',
    'aboutControllers',

    'ui-rangeSlider',
    'i18nFilters',
    'optionsFilters',
]);

// http://stackoverflow.com/questions/15606751/angular-changes-urls-to-unsafe-in-extension-page
appModule.config( [ '$compileProvider', function( $compileProvider ) {
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|file|mailto|chrome-extension):/);
    $compileProvider.imgSrcSanitizationWhitelist(/^\s*(chrome-extension):/);
}])

// allow tab selection from the location hash
!function () {
	const anchorElm = /** @type {HTMLAnchorElement} */ 
		(location.hash && (document.querySelector(`a[href="${location.hash}"]`))) || null

	if (!anchorElm) {
		return
	}

	anchorElm.click()
		
	// if (location.hash) {
	setTimeout(() => window.scrollTo(0, 0), 1)
	// }
}()
