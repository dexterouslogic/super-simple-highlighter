/*global angular, _highlightDefinitions, _stylesheet*/

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
    _highlightDefinitions.getAll(function (items) {
        if (!items) {
            return;
        }

        // shared highlight styles
        if (items.sharedHighlightStyle) {
            _stylesheet.setHighlightStyle({
                className: "simple-highlight",
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

