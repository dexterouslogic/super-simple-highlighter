/*global angular, _storage, _stylesheet*/

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
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|file):/);
    $compileProvider.imgSrcSanitizationWhitelist(/^\s*(chrome-extension):/);
}]);
//
//$().ready(function () {
//    "use strict";
//    $('.color-picker').colorpicker();
//});

