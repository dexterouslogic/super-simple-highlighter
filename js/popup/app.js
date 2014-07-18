/*global angular, _storage, _stylesheet*/

/**
 * App Module
 * @type {ng.IModule}
 */
var popupApp = angular.module('popupApp', [
    'popupControllers',
    'popupFilters'
]);

$().ready(function () {
    "use strict";
    // 1 - get current highlight styles, and apply to DOM
    // Note that we share this script with the content page (directly)
    _highlightDefinitions.getAll(function (result) {
        // shared highlight styles
        if (result.defaultHighlightStyle) {
            _stylesheet.setHighlightStyle({
                className: "highlight",
                style: result.defaultHighlightStyle
            });
        }

        // must apply per-style rules last
        if (result.highlightDefinitions) {
            result.highlightDefinitions.forEach(function (h) {
                _stylesheet.setHighlightStyle(h);
            });
        }
    });
});

