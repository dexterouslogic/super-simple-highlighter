/*global angular*/

var optionsFilters = angular.module('optionsFilters', []);

optionsFilters.filter('alphaPercent', function() {
    return function(input) {
        return (input * 100) + "%";// input ? '\u2713' : '\u2718';
    };
});
