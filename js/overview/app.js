/*global angular, _storage, _stylesheet*/

/**
 * App Module
 * @type {ng.IModule}
 */
var overviewApp = angular.module('overviewApp', [
    'overviewControllers',
    'i18nFilters'
]);

// http://stackoverflow.com/questions/15606751/angular-changes-urls-to-unsafe-in-extension-page
overviewApp.config( [ '$compileProvider', function( $compileProvider ) {
    "use strict";
    // $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|file):/);
    $compileProvider.imgSrcSanitizationWhitelist(/^\s*(chrome-extension):/);
}]);

$().ready(function () {
    "use strict";
    // 1 - get current highlight styles, and apply to DOM
    // Note that we share this script with the content page (directly)
    _storage.highlightDefinitions.getAll(function (items) {
        if (!items) {
            return;
        }

        // shared highlight styles
        if (items.sharedHighlightStyle) {
            _stylesheet.setHighlightStyle({
                className: "highlight",
                style: items.sharedHighlightStyle
            });
        }

        // must apply per-style rules last
        if (items.highlightDefinitions) {
            items.highlightDefinitions.forEach(function (definition) {
                _stylesheet.setHighlightStyle(definition);
            });
        }
    });
});

