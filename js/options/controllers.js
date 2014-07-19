/*global angular, _highlightDefinitions, _stylesheet, _stringUtils*/

/**
 * Controllers module
 * @type {ng.IModule}
 */
var optionsControllers = angular.module('optionsControllers', []);

// array this is something to do with minification
optionsControllers.controller('HighlightDefinitionsController', ["$scope", function ($scope) {
    'use strict';
    var $modal;

    // model
    $scope.highlightClassName = "highlight";

    $scope.definitions = [];
    $scope.modalDefinition = null;//change.newValue[0];

    $scope.modalTitle = null;

    function onInit () {
        // listen for changes to styles
        chrome.storage.onChanged.addListener(onStorageChanged);

        // fake a change for initial update
        _highlightDefinitions.getAll(function (result) {
            onStorageChanged({
                sharedHighlightStyle: {
                    newValue: result.sharedHighlightStyle
                },
                highlightDefinitions: {
                    newValue: result.highlightDefinitions
                }
            }, "sync");
        });

        // cache
        $modal = $('#myModal');

        // listen for edit modal close
        $modal.on('hidden.bs.modal', onModalHidden);
    }

    $scope.onClickMyModalSave = function () {
        // set contents of selectedDefintion into storage
        if ($scope.modalDefinition) {
            _highlightDefinitions.set($scope.modalDefinition);
        }

        $modal.modal('hide');
    };

    /**
     * Clicked an existing definition
     * @param className
     */
    $scope.onClickEditDefinition = function (className) {
        var index = _highlightDefinitions.getIndex(className, $scope.definitions);
        if( index === -1 ) {
            return;
        }

        // copy (not reference) definition
        $scope.modalDefinition = _highlightDefinitions.copy($scope.definitions[index]);
        $scope.modalTitle = "Edit Style";

        // activate the 'edit' model
        $modal.modal();
    };

    /**
     * Clicked the 'add new definition' button
     */
    $scope.onClickAddDefinition = function () {
        // default new definition
        $scope.modalDefinition = _highlightDefinitions.createDefault();
        $scope.modalTitle = "Add New Style";

        // activate the 'edit' model
        $modal.modal();
    };

    /**
     * Clicked the per-definition 'delete' button
     * @param className
     */
    $scope.onClickDeleteDefinition = function (className) {
        // delete from storage. model should update automatically
        _highlightDefinitions.remove(className);
    };

    /**
     * Edit modal dialog closed
     * @param e
     */
    var onModalHidden = function (e) {
        $scope.modalDefinition = null;
    };

    /**
     * A value in the storage changed
     * @param changes
     * @param namespace
     */
    var onStorageChanged = function (changes, namespace) {
        if (namespace === "sync") {
            // changes is an Object mapping each key that changed to its
            // corresponding storage.StorageChange for that item.
            var change;

            // default FIRST
            if (changes.sharedHighlightStyle) {
                change = changes.sharedHighlightStyle;

                if (change.oldValue) {
                    _stylesheet.clearHighlightStyle($scope.highlightClassName);
                }

                if (change.newValue) {
                    _stylesheet.setHighlightStyle({
                        className: $scope.highlightClassName,
                        style: change.newValue
                    });
                }
            }

            // specific last
            if (changes.highlightDefinitions) {
                change = changes.highlightDefinitions;

                if (change.oldValue) {
                    change.oldValue.forEach( function (h) {
                        _stylesheet.clearHighlightStyle(h.className);
                    });
                }

                if (change.newValue) {
                    // update model
                    $scope.definitions = change.newValue;

                    $scope.$apply();

                    // update stylesheet
                    change.newValue.forEach( function (h) {
                        _stylesheet.setHighlightStyle(h);
                    });
                }
            }
        }
    };

    onInit();
}]);

optionsControllers.controller('DatabaseController', ["$scope", function ($scope) {
    'use strict';
    $scope.rows = [];

    function onInit() {
        // listen for database deletions

        chrome.storage.onChanged.addListener(onStorageChanged);

    }

    onInit();
}]);
