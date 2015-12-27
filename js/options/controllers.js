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

// disable console log
console.log = function() {}

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
        _storage.getUnselectAfterHighlight_Promise().then(function (unselect) {
            $scope.unselectAfterHighlight = unselect;

            $scope.$watch('unselectAfterHighlight', function (newVal, oldVal) {
                if (newVal !== oldVal) {
                    console.log(newVal);
					
                    _storage.setUnselectAfterHighlight_Promise(newVal);
                }
            });
        });

		// 1b - same, but for disable box shadow
        _storage.isHighlightBoxShadowEnabled_Promise().then(function (isEnabled) {
            $scope.isHighlightBoxShadowEnabled = isEnabled;

            $scope.$watch('isHighlightBoxShadowEnabled', function (newVal, oldVal) {
                if (newVal !== oldVal) {
                    console.log(newVal);
					
                    _storage.setEnableHighlightBoxShadow_Promise(newVal);
                }
            });
        });	

        // 2
        _storage.getHighlightBackgroundAlpha_Promise().then(function (opacity) {
            if (opacity === undefined) {
				 return;
			 }

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

                        _storage.setHighlightBackgroundAlpha_Promise(newVal);
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
        return _storage.highlightDefinitions.getAll_Promise().then(function (result) {
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
        $modal.modal('hide');

        // set contents of selectedDefintion into storage
        if ($scope.modalDefinition) {
            return _storage.highlightDefinitions.set_Promise($scope.modalDefinition);
        } else {
        	return Promise.reject();
        }
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
            return _storage.highlightDefinitions.removeAll_Promise();
        } else {
        	return Promise.resolve();
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
            return _storage.highlightDefinitions.remove_Promise(className);
        } else {
        	return Promise.resolve();
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

			var disableBoxShadow = true;

            // default FIRST
            if (changes.sharedHighlightStyle) {
                change = changes.sharedHighlightStyle;

                if (change.oldValue) {
                    _stylesheet.clearHighlightStyle($scope.highlightClassName);
                }

                if (change.newValue) {
                    _stylesheet.setHighlightStyle({
                        className: $scope.highlightClassName,
                        style: change.newValue,
						disableBoxShadow: disableBoxShadow,
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
						definition.disableBoxShadow = disableBoxShadow;
                        _stylesheet.setHighlightStyle(definition);
                    });
                };

                if (!change.newValue) {
                    // get defaults
                    _storage.highlightDefinitions.getAll_Promise().then(function (items) {
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
    function onInit(bp){
        backgroundPage = bp;

        // get an array of each unique match, and the number of associated documents (which is of no use)
        return backgroundPage._database.getMatchSums_Promise().then(function (rows) {
            $scope.rows = rows.filter (function (row) {
                return row.value > 0;
            });

            $scope.$apply();
        });
    }

    /**
     * Clicked 'remove all highlights for this site' button (x)
     * @param {number} index
     */
    $scope.onClickRemoveAllHighlights = function (index){
        if (window.confirm(chrome.i18n.getMessage("confirm_remove_all_highlights"))) {
            var match = $scope.rows[index].key;

            return backgroundPage._database.removeDocuments_Promise(match).then(function(result) {
                $scope.rows.splice(index, 1);
                $scope.$apply();
            });
        } else {
        	return Promise.reject();
        }
    };

    /**
     * Clicked 'remove all pages' button.
     */
    $scope.onClickRemoveAllPages = function () {
        if (window.confirm(chrome.i18n.getMessage("confirm_remove_all_pages"))) {
            // destroy and re-create the database
            return backgroundPage._database.reset().then(function() {
                $scope.rows = [];
                $scope.$apply();
            });
        } else {
        	return Promise.reject();
        }
    };
	
    // starter
    chrome.runtime.getBackgroundPage(function (backgroundPage) {
        onInit(backgroundPage);
    });
}]);

/**
 * Controller for Experimental pane
 */
optionsControllers.controller('ExperimentalController', ["$scope", function ($scope) {
    'use strict';
    var backgroundPage;

	const KEYNAMES = {
		magic: 'magic',
		version: 'version'
	};
	
	const VALUE_MAGIC = "Super Simple Highlighter Exported Database";

	function utf8_to_b64(str) {
	    return window.btoa(unescape(encodeURIComponent(str)));
	}

	function b64_to_utf8(str) {
	    return decodeURIComponent(escape(window.atob(str)));
	}
	

	function onFileSelect(evt) {
		var file = evt.target.files[0];	// FileList object
		var reader = new FileReader();
  	  	
		// Closure to capture the file information.
        reader.onload = function(e) {
			// newline delimited json
			var dumpedString = e.target.result;
			
			load(dumpedString).then(function() {
				location.reload();
			}).catch(function(err) {
				// error loading or replicating tmp db to main db
				var text = "Status: " + err.status + "\nMessage: " + err.message;
	        	alert(text);
	        });
		};
        
		 // Read in the image file as a data URL.
        reader.readAsText(file, "utf-8");
		// reader.readAsDataURL(file);
	}

    /**
     * Init
     * @param {object} _backgroundPage
     */
    function onInit(_backgroundPage){
        backgroundPage = _backgroundPage;
		
		// add event listener to files input element
		document.getElementById('files').addEventListener('change', onFileSelect, false);
    }
	
	/**
	 * dump database to text, copy to clipboard
	 */
	$scope.onClickDump = function () {
		// header
		var header = {};
		
		header[KEYNAMES.magic] = VALUE_MAGIC;
		header[KEYNAMES.version] = 1;
		
		var dumpedString = JSON.stringify(header);
		
		return _storage.highlightDefinitions.getAll_Promise({
			defaults: false
		}).then(function (items) {
			// the first item is always the highlights object
			dumpedString += '\n' + JSON.stringify(items) + '\n';

			// the remainder is the dumped database
			var stream = new window.memorystream();

			stream.on('data', function(chunk) {
				dumpedString += chunk.toString();
			});
			
			return backgroundPage._database.dump(stream);
		}).then(function () {
			// create a temporary anchor to navigate to data uri
			var a = document.createElement("a");
			
			a.download = chrome.i18n.getMessage("experimental_database_export_file_name");
			a.href = "data:text;base64," + utf8_to_b64(dumpedString);
			
			// a.href = "data:text/plain;charset=utf-8;," + encodeURIComponent(dumpedString);
			// a.href = "data:text;base64," + utf8_to_b64(dumpedString);
			// a.href = "data:text;base64," + utf8_to_b64(dumpedString);
				//window.btoa(dumpedString);

			// create & dispatch mouse event to hidden anchor
			var mEvent = document.createEvent("MouseEvent");
			mEvent.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
		
			a.dispatchEvent(mEvent);
		});
	};

	function load(dumpedString) {
		var jsonObjects = dumpedString.split('\n');
		var highlightDefinitions;
		
		// newline delimited json
		return new Promise(function(resolve, reject) {
			// validate header
			var header = JSON.parse(jsonObjects.shift());
			
			if (header[KEYNAMES.magic] === VALUE_MAGIC || header[KEYNAMES.version] === 1) {
				resolve()
			} else {
				reject({
					status: 403,
					message: "Invalid File"
				});
			}
		}).then(function() {
			// the first line-delimited json object is the storage highlights object. Don't use them until the database loads successfully
			highlightDefinitions = JSON.parse(jsonObjects.shift());
			
			// remainder is the database
			return backgroundPage._database.load(jsonObjects.join('\n'));
		}).then(function() {
			// set associated styles. null items are removed (implying default should be used)
			return _storage.highlightDefinitions.setAll_Promise(highlightDefinitions);
		});
	}
	
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
		return _storage.setFileAccessRequiredWarningDismissed_Promise(false);
	};
}]);
