/*global angular, _stylesheet, _stringUtils, _i18n, _changelog, _libraries, _licenses*/
'use strict'

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

// disable console log
// console.log = function () { }
// console.assert = function () { }

/**
 * Controllers module
 * @type {ng.IModule}
 */
var optionsControllers = angular.module('optionsControllers', []);

// TODO: rewrite, this is too linked with storage stuff

// array this is something to do with minification
optionsControllers.controller('StylesController', ["$scope", "$timeout", function ($scope, $timeout) {
    // modal dialog div
    const $modal = $('#myModal')//document.getElementById('myModal')

    // always ignore shadow on options page
    const DISABLE_BOX_SHADOW = true
            
    /** 
     * Object to contain all other objects in the scope of this controller
     * @typedef {Object} StylesControllerScope
     * @prop {string} highlightClassName - class name used by each list item definining a highlight (only on options page)
     * @prop {Object} command - copy of current chrome commands
     * @prop {Object} options - watched options specific to scope
     * @prop {Object} definitions - watched and bound highlight definitions
     */
   
    /** @type {StylesControllerScope} */
    $scope.stylesController = {
        highlightClassName: StringUtils.newUUID()
    }

    // model
    // $scope.highlightClassName = // "highlight";

    // unhanled promise to initialize controller
    init()

    /**
     * Initializer
     * 
     * @returns {Promise} resolved on successful init
     */
    function init() {
        // 2 - add listener for changes to storage (sync area only)
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'sync') {
                return
            }

            // returns an unused promise
            onStorageChanged(changes)
        })

        // copy all shortcut command info into scoped object
        return new Promise(resolve => {
            chrome.commands.getAll(commands => resolve(commands))
        }).then(commands => {
            $scope.stylesController.commands = commands

            // get existing storage values for options
            return new ChromeStorage().get([
                ChromeStorage.KEYS.UNSELECT_AFTER_HIGHLIGHT,
                ChromeStorage.KEYS.ENABLE_HIGHLIGHT_BOX_SHADOW,
                ChromeStorage.KEYS.HIGHLIGHT_BACKGROUND_ALPHA,
            ])
        }).then(items => {
            !function () {
                const TIMEOUT = 1000
                const name = 'options'
                
                // copy to options object in scope
                $scope.stylesController[name] = Object.assign({}, items)
    
                let debounceTimerID = null
    
                // update storage when scoped options object changes
                $scope.$watchCollection(`stylesController.${name}`, (newOptions, oldOptions) => {
                    if (newOptions == oldOptions) {
                        return
                    }
                    
                    // debounce storage setting because there is a quota, and slider has no tracking options
                    if (debounceTimerID) {
                        $timeout.cancel(debounceTimerID)
                    }
                    
                    debounceTimerID = $timeout(() => {
                        // unhandled promise
                        new ChromeStorage().set(newOptions).then(() => debounceTimerID = null)
                    }, TIMEOUT);
    
                })
            }()
        }).then(() => {
            const name = 'definitions'
            $scope.stylesController[name] = {}
            
            // watch for changes to scoped definitions collection
            $scope.$watchCollection(`stylesController.${name}`, (newDefinitions, oldDefinitions) => {
                for (const d of newDefinitions) {
                    d.disableBoxShadow = DISABLE_BOX_SHADOW
                    _stylesheet.setHighlightStyle(d)
                }
            })

            // initial update via onStorageChange()
            return new ChromeHighlightStorage().getAll().then(items => {
                // define a change that resets styles to stored values
                const changes = {
                    [ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE]: { 
                        newValue: items[ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE] 
                    },
                    [ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]: { 
                        newValue: items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS] 
                    }, 
                }

                onStorageChanged(changes)
            })
        })
    }

    /**
     * Handler for click on 'add new style' button
     * 
     */
    $scope.onClickAddNewStyle = function () {
        // default new definition
        $scope.modalTitle = chrome.i18n.getMessage("create_new_style");
        $scope.modalSaveButtonTitle = chrome.i18n.getMessage("create");

        // new definition, to be altered and stored later
        $scope.modalDefinition = HighlightDefinitionFactory.createObject()
            
        // activate the 'edit' model
        $modal.modal();
    }
    
    /**
     * Handler for click on 'reset all styles' button
     * 
     * @returns {Promise} resolved when all highlight definitions removed from storage
     */
    $scope.onClickResetAllStyles = function () {
        if (!window.confirm(chrome.i18n.getMessage("confirm_reset_default_styles"))) {
            return Promise.resolve()
        }

        return new ChromeHighlightStorage().removeAll()
    }

    /**
     * Handler for click on 'save' button of new highlight definition dialog
     * 
     * @returns {Promise} resolved when definition is stored, and $scope.modalDefinition is deleted
     */
    $scope.onClickModalSave = function () {
        $modal.modal('hide');

        // set contents of selectedDefintion into storage
        if (!$scope.modalDefinition) {
            return Promise.reject(new Error())
        }

        // storage object and delete property value
        return new ChromeHighlightStorage().set($scope.modalDefinition)
            .then(() => delete $scope.modalDefinition)
    }

    /**
     * Clicked an existing definition
     * @param {number} index index of definition in local array
     */
    $scope.onClickEditDefinition = function (index) {
        $scope.modalTitle = chrome.i18n.getMessage("edit_style");
        $scope.modalSaveButtonTitle = chrome.i18n.getMessage("update");

        // deep copy
        $scope.modalDefinition = angular.copy($scope.stylesController.definitions[index]);//   _highlightDefinitions.copy($scope.definitions[index]);

        // activate the 'edit' model
        $modal.modal();
    }

    /**
     * Clicked the per-definition 'delete' button
     * @param {string} definitionClassName class name for definition in storage
     * @returns {Promise} resolves if storage updated or cancelled
     */
    $scope.onClickRemoveDefinition = function (definitionClassName) {
        event.preventDefault()
        event.stopPropagation()

        if (!window.confirm(chrome.i18n.getMessage("confirm_remove_style"))) {
            return Promise.resolve()
        }

        // delete from storage. model should update automatically
        return new ChromeHighlightStorage().remove(definitionClassName)
    }

    /**
     * Handler for changes to sync storage
     * 
     * @param {Object} changes Object mapping each key that changed to its corresponding storage.StorageChange for that item.
     * @returns {Promise} promise resolved when storage change handled
     */
    var onStorageChanged = function (changes) {
        // if the opacity storage value changed, we can reflect that by adding a change for HIGHLIGHT_DEFINITIONS
        // where there is no oldValue (nothing to clear), and the undefined newValue means 'read storage values'
        if (changes[ChromeStorage.KEYS.HIGHLIGHT_BACKGROUND_ALPHA]) {
            const name = ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS
            changes[name] = changes[name] || {}
        }
        
        // first update common (shared) style
        if (changes[ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE]) {
            const c = changes[ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE]
            const className = $scope.stylesController.highlightClassName

            if (c.oldValue) {
                _stylesheet.clearHighlightStyle(className)
            }

            if (c.newValue) {
                _stylesheet.setHighlightStyle({
                    className: className,
                    style: c.newValue,
                    disableBoxShadow: DISABLE_BOX_SHADOW,
                })
            }
        }
        
        // then update specific definitions
        if (changes[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]) {
            const c = changes[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]

            if (c.oldValue) {
                for (const {className} of c.oldValue) {
                    _stylesheet.clearHighlightStyle(className)
                }
            }

            // name of property of `stylesController` containing definitions object
            const name = 'definitions'

            // if we remove all teh styles (with reset button), newValue will be undefined.
            // so in that case, get the default styles
            if (!c.newValue) {
                return new ChromeHighlightStorage().getAll().then(items => {
                    $scope.stylesController[name] = items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]
                    $scope.$apply()
                })
            }

            $scope.stylesController[name] = c.newValue
            $scope.$apply()
        }

        return Promise.resolve()
    }
}]);