/*global angular, _storage, _stylesheet*/

/**
 * App Module
 * @type {ng.IModule}
 */
var optionsApp = angular.module('optionsApp', [
    'optionsControllers',
    'i18nFilters'
]);

// http://stackoverflow.com/questions/15606751/angular-changes-urls-to-unsafe-in-extension-page
optionsApp.config( [ '$compileProvider', function( $compileProvider ) {
    "use strict";
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|file|mailto):/);
    $compileProvider.imgSrcSanitizationWhitelist(/^\s*(file|chrome-extension):/);
}]);
//
//$().ready(function () {
//    "use strict";
//    $('.color-picker').colorpicker();
//});

