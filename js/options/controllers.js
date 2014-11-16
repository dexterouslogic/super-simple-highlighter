/*global angular, _storage, _stylesheet, _stringUtils, _i18n, _changelog, _libraries, _licenses*/

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
 * Controllers module
 * @type {ng.IModule}
 */
var optionsControllers = angular.module('optionsControllers', []);

// TODO: rewrite, this is too linked with storage stuff

// array this is something to do with minification
optionsControllers.controller('StylesController', ["$scope", "$timeout", function ($scope, $timeout) {
    'use strict';

    // cache modal dialog
    var $modal;

    // model
    // $scope.unselectAfterHighlight = true;
    $scope.highlightClassName = "highlight";
//    $scope.html_highlight_keyboard_shortcut_help = $sce.trustAsHtml(
//        chrome.i18n.getMessage("html_highlight_keyboard_shortcut_help"));

    function onInit () {
        // cache
        $modal = $('#myModal');

        // 1 - get storage value, and set up a watch on it
        _storage.getUnselectAfterHighlight(function (unselectAfterHighlight) {
            $scope.unselectAfterHighlight = unselectAfterHighlight;

            $scope.$watch('unselectAfterHighlight', function (newVal, oldVal) {
                if (newVal !== oldVal) {
                    console.log(newVal);
                    _storage.setUnselectAfterHighlight(newVal);
                }
            });
        });

        // 2
        _storage.getHighlightBackgroundAlpha(function (opacity) {
            if (opacity === undefined) { return; }

            $scope.opacity = opacity;

            // watch our model, sync on change
            var timeout = null;     // debounce
            $scope.$watch('opacity', function (newVal, oldVal) {
                if (newVal !== oldVal) {
                    // save the new value. debounce for 1 second
                    if (timeout) {
                        $timeout.cancel(timeout);
                    }

                    timeout = $timeout(function () {
                        console.log(newVal);

                        _storage.setHighlightBackgroundAlpha(newVal);
                    }, 1000);
                }
            });
        });

        // shortcut commands array
        chrome.commands.getAll(function (commands) {
            $scope.commands = commands;
        });

        // listen for edit modal close
//        $modal.on('hidden.bs.modal', onModalHidden);

        // listen for changes to styles
        chrome.storage.onChanged.addListener(onStorageChanged);

        // fake a change for initial update
        resetStylesheetHighlightStyle();
    }

    /**
     * Get the current highlight definitions, and (re)create the stylesheet for us using them
     * @private
     */
    function resetStylesheetHighlightStyle() {
        _storage.highlightDefinitions.getAll(function (result) {
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
            _storage.highlightDefinitions.set($scope.modalDefinition);
        }

        $modal.modal('hide');
    };

    /**
     * Clicked the 'add new definition' button
     */
    $scope.onClickAdd = function () {
        // default new definition
        $scope.modalTitle = chrome.i18n.getMessage("create_new_style");
        $scope.modalSaveButtonTitle = chrome.i18n.getMessage("create");

        $scope.modalDefinition = _storage.highlightDefinitions.create();
//        $scope.$apply();

        // activate the 'edit' model
        $modal.modal();
    };

    /**
     * Clicked the 'reset styles' button
     */
    $scope.onClickReset = function () {
        if (window.confirm(chrome.i18n.getMessage("confirm_reset_default_styles"))) {
            _storage.highlightDefinitions.removeAll();

//            chrome.storage.sync.set({
//                highlightBackgroundAlpha: 0.8
//            });
        }
    };

    /**
     * Clicked an existing definition
     * @param {number} index index of definition in local array
     */
    $scope.onClickEdit = function (index) {
        $scope.modalTitle = chrome.i18n.getMessage("edit_style");
        $scope.modalSaveButtonTitle = chrome.i18n.getMessage("update");

        // deep copy
        $scope.modalDefinition = angular.copy($scope.definitions[index]);//   _highlightDefinitions.copy($scope.definitions[index]);

        // activate the 'edit' model
        $modal.modal();
    };

    /**
     * Clicked the per-definition 'delete' button
     * @param className
     */
    $scope.onClickDelete = function (className) {
        if (window.confirm(chrome.i18n.getMessage("confirm_remove_style"))) {
            // delete from storage. model should update automatically
            _storage.highlightDefinitions.remove(className);
        }
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

            if (changes.highlightBackgroundAlpha) {
                change = changes.highlightBackgroundAlpha;

                if (change.newValue) {
                    $scope.opacity = change.newValue;

                    // get all the highlights using the new opacity, and set them
                    resetStylesheetHighlightStyle();
                }
            }

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
                    _storage.highlightDefinitions.getAll(function (items) {
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


/**
 * Controller for Sites pane
 */
optionsControllers.controller('PagesController', ["$scope", function ($scope) {
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
     * Clicked 'remove all highlights for this site' button (x)
     * @param {number} index
     */
    $scope.onClickRemoveAllHighlights = function (index){
        if (window.confirm(chrome.i18n.getMessage("confirm_remove_all_highlights"))) {
            var match = $scope.rows[index].key;

            backgroundPage._database.removeDocuments(match, function (err, result) {
                if (!err) {
                    $scope.rows.splice(index, 1);
                    $scope.$apply();
                }
            });
        }
    };

    /**
     * Clicked 'remove all pages' button.
     */
    $scope.onClickRemoveAllPages = function () {
        if (window.confirm(chrome.i18n.getMessage("confirm_remove_all_pages"))) {
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

/**
 * Controller for About pane
 */
optionsControllers.controller('AboutController', ["$scope", function ($scope) {
    'use strict';
    $scope.manifest = chrome.runtime.getManifest();
//    $scope.changelog = _changelog;
    $scope.libraries = _libraries;
    $scope.cc = _licenses;
	
	/**
	 * Clicked 'restore all warnings' button. Clears the 'dismissed' property for all warning dialogs
	 * @type function
	 */
	$scope.onClickRestoreAllWarnings = function () {
		// TODO: remember to keep all property setters in sync with this method
		_storage.setFileAccessRequiredWarningDismissed(false);
	};
	
}]);
