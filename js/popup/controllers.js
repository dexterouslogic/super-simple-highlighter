/*global angular, _eventPage*/

/**
 * Controllers module
 * @type {ng.IModule}
 */
var popupControllers = angular.module('popupControllers', []);

// array this is something to do with minification
popupControllers.controller('DocumentsController', ["$scope", function ($scope) {
    'use strict';
    var backgroundPage;
    var activeTabId;

    // models
//    $scope.docs = [];
//    $scope.match = "hello";

    /**
     * Ini
     * @param {object} activeTab
     * @param {object} _backgroundPage
     */
    function onInit(activeTab, _backgroundPage){
        activeTabId = activeTab.id;
        backgroundPage = _backgroundPage;

        $scope.title = activeTab.title;
        $scope.match = backgroundPage._database.buildMatchString(activeTab.url);

        updateDocs();
    }

    /**
     * Click a highlight. Scroll to it in DOM
     * @param {string} documentId
     */
    $scope.onClickHighlight = function (documentId) {
        backgroundPage._eventPage.scrollTo(activeTabId, documentId);
    };

    /**
     * Clicked 'copy' button for a highlight
     * @param documentId
     */
    $scope.onClickCopy = function (documentId) {
        backgroundPage._eventPage.copyHighlightText(documentId);
        window.close();
    };

    /**
     * Clicked 'speak' button for a highlight
     * @param documentId
     */
    $scope.onClickSpeak = function (documentId) {
        backgroundPage._eventPage.speakHighlightText(documentId);
    };

    /**
     * Clicked 'remove' button for a highlight
     * @param {string} documentId highlight id
     */
    $scope.onClickRemove = function (documentId) {
        backgroundPage._eventPage.deleteHighlight(activeTabId,  documentId, function (err, result) {
            if (result && result.ok ) {
                updateDocs();
            }
        });
    };

    /**
     * Clicked 'remove all' button
     */
    $scope.onClickRemoveAll = function () {
        if(window.confirm("This operation can't be undone. Are you sure you wish to continue?")) {
            backgroundPage._eventPage.deleteHighlights(activeTabId, $scope.match);
            window.close();
        }
    };

    /**
     * Clear and fill the 'docs' model
     */
    var updateDocs = function () {
        // get all the documents (create & delete) associated with the match, then filter the deleted ones
        backgroundPage._database.getCreateDocuments($scope.match, function (err, docs) {
            if (err) {
                return;
            }

            // if the highlight cant be found in DOM, flag that
            docs.forEach(function(doc){
                // default to undefined, implying it IS in the DOM
                backgroundPage._eventPage.isHighlightInDOM(activeTabId, doc._id, function (isInDOM) {
                    doc.isInDOM =  isInDOM;
                    $scope.$apply();
                });
            });

            $scope.docs = docs;
            $scope.$apply();
        });
    };

    // starter
    chrome.tabs.query({ active: true, currentWindow: true }, function (result) {
        chrome.runtime.getBackgroundPage(function (backgroundPage) {
            onInit(result[0], backgroundPage);
        });
    });

}]);