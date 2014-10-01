/*global angular, _eventPage, _i18n, _storage, purl*/

/**
 * Controllers module
 * @type {ng.IModule}
 */
var summaryControllers = angular.module('summaryControllers', []);


// array this is something to do with minification
summaryControllers.controller('DocumentsController', ["$scope", function ($scope) {
    'use strict';

    /**
     * Initializer
     * @param {number} [id] tab id number, or Nan if not known or specified
     * @param {string} url tab url
     * @param {string} [title] optional tab title
     * @param {object} backgroundPage
     */
    function onInit(id, url, title, backgroundPage){
        console.log("init");

        $scope.title = title;

        // get all the documents (create & delete) associated with the match, then filter the deleted ones
        var match = backgroundPage._database.buildMatchString(url);

        backgroundPage._database.getCreateDocuments(match, function (err, docs) {
            if (!err) {
                $scope.docs = docs;
                $scope.$apply();

                // if the highlight cant be found in DOM, flag that
                if (!isNaN(id)) {
                    docs.forEach(function (doc) {
                        // default to undefined, implying it IS in the DOM
                        backgroundPage._eventPage.isHighlightInDOM(id, doc._id, function (isInDOM) {
                            //                    if (!isInDOM) {
                            //                        console.log("Not in DOM");
                            //                    }

                            doc.isInDOM = isInDOM;
                            $scope.$apply();
                        });
                    });
                }
            }
        });
    }


    // starter - parse href to find url used to find match string
    var u = purl(location.href),
        id = u.param('id'), url = u.param('url'), title = u.param('title');

    if (url !== undefined) {
        chrome.runtime.getBackgroundPage(function (backgroundPage) {
            onInit(parseInt(id), url, title, backgroundPage);
        });
    }



//    chrome.tabs.query({ active: true, currentWindow: true }, function (result) {
//        chrome.runtime.getBackgroundPage(function (backgroundPage) {
//            onInit(result[0], backgroundPage);
//        });
//    });

}]);