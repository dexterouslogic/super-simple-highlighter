/*global angular*/

/**
 * Filters module
 * @type {ng.IModule}
 */
var myFilters = angular.module('popupFilters', []);

myFilters.filter('checkmark', function () {
    'use strict';
    return function (input) {
        return input ? '\u2713' : '\u2718';
    };
});

