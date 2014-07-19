/*global angular, _highlightDefinitions, _stylesheet, _stringUtils*/

/**
 * Controllers module
 * @type {ng.IModule}
 */
var optionsControllers = angular.module('optionsControllers', []);

// TODO: rewrite, this is too linked with storage stuff

// array this is something to do with minification
optionsControllers.controller('DefinitionsController', ["$scope", function ($scope) {
    'use strict';
    var $modal;

    // model
    $scope.highlightClassName = "highlight";

    function onInit () {
        // cache
        $modal = $('#myModal');

        // listen for edit modal close
//        $modal.on('hidden.bs.modal', onModalHidden);

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

    }

    $scope.onClickModalSave = function () {
        // set contents of selectedDefintion into storage
        if ($scope.modalDefinition) {
            _highlightDefinitions.set($scope.modalDefinition);
        }

        $modal.modal('hide');
    };

    /**
     * Clicked the 'add new definition' button
     */
    $scope.onClickAdd = function () {
        // default new definition
        $scope.modalTitle = "Add New Style";
        $scope.modalDefinition = _highlightDefinitions.create();

        // activate the 'edit' model
        $modal.modal();
    };

    /**
     * Clicked the 'reset styles' button
     */
    $scope.onClickReset = function () {
        if (window.confirm("All existing highlights will lose their style. Are you sure you wish to continue?")) {
            _highlightDefinitions.removeAll();
        }
    };

    /**
     * Clicked an existing definition
     * @param {number} index index of definition in local array
     */
    $scope.onClickEdit = function (index) {
        // copy (not reference) definition
        $scope.modalDefinition = _highlightDefinitions.copy($scope.definitions[index]);
        $scope.modalTitle = "Edit Style";

        // activate the 'edit' model
        $modal.modal();
    };

    /**
     * Clicked the per-definition 'delete' button
     * @param className
     */
    $scope.onClickDelete = function (className) {
        // delete from storage. model should update automatically
        _highlightDefinitions.remove(className);
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

                // if we remove all teh styles (with reset button), newValue will be undefined.
                // so in that case, get the default styles
                var setDefinitions = function (definitions) {
                    // update model
                    $scope.definitions = definitions;
                    $scope.$apply();

                    // update stylesheet
                    definitions.forEach( function (definition) {
                        _stylesheet.setHighlightStyle(definition);
                    });
                };

                if (!change.newValue) {
                    // get defaults
                    _highlightDefinitions.getAll(function (items) {
                        setDefinitions(items.highlightDefinitions);
                    });
                } else {
                    setDefinitions (change.newValue);
                }
            }
        }
    };

    onInit();
}]);



optionsControllers.controller('DatabaseController', ["$scope", function ($scope) {
    'use strict';
    var backgroundPage;

    /**
     * Init
     * @param {object} _backgroundPage
     */
    function onInit(_backgroundPage){
        backgroundPage = _backgroundPage;

        // get an array of each unique match, and the number of associated documents (which is of no use)
        backgroundPage._database.getMatchSums(function (err, rows) {
            if (rows) {
                $scope.rows = rows.filter (function (row) {
                    return row.value > 0;
                });
                $scope.$apply();
            }
        });
    }

    /**
     * Clicked 'remove site' button
     * @param {number} index
     */
    $scope.onClickRemove = function (index){
        var match = $scope.rows[index].key;

        backgroundPage._database.removeDocuments(match, function (err, result) {
            if (!err) {
                $scope.rows.splice(index, 1);
                $scope.$apply();
            }
        });
    };

    /**
     * Clicked 'remove all sites' button.
     */
    $scope.onClickRemoveAll = function () {
        if (window.confirm("This operation can't be undone. Are you sure you wish to continue?")) {
            // destroy and re-create the database
            backgroundPage._database.resetDatabase(function (err, response) {
                if (!err) {
                    $scope.rows = [];
                    $scope.$apply();
                }
            });
        }
    };

    // starter
    chrome.runtime.getBackgroundPage(function (backgroundPage) {
        onInit(backgroundPage);
    });
}]);
