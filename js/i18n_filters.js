/*global angular*/

var i18nFilters = angular.module('i18nFilters', []);

i18nFilters.filter('i18n', function() {
    'use strict';
    return function (key) {
        return chrome.i18n.getMessage(key);
    };
});