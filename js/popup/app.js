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
var popupApp = angular.module('popupApp', [
    'popupControllers',
    'i18nFilters'
]);

$().ready(function () {
    "use strict";
    // 1 - get current highlight styles, and apply to DOM
    // Note that we share this script with the content page (directly)
    _storage.highlightDefinitions.getAll_Promise().then(function (items) {
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

