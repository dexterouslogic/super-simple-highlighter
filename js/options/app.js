/*global angular, _storage, _stylesheet*/

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
 * App Module
 * @type {ng.IModule}
 */
var optionsApp = angular.module('optionsApp', [
    'optionsControllers',
    'ui-rangeSlider',
    'i18nFilters',
    'optionsFilters'
]);

// http://stackoverflow.com/questions/15606751/angular-changes-urls-to-unsafe-in-extension-page
optionsApp.config( [ '$compileProvider', function( $compileProvider ) {
    "use strict";
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|file|mailto|chrome-extension):/);
    $compileProvider.imgSrcSanitizationWhitelist(/^\s*(chrome-extension):/);
}]);
//
//$().ready(function () {
//    "use strict";
//    $('.color-picker').colorpicker();
//});

