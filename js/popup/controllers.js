/*global angular, _eventPage, _i18n, _storage, */

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
var popupControllers = angular.module('popupControllers', []);


// array this is something to do with minification
popupControllers.controller('DocumentsController', ["$scope", function ($scope) {
    'use strict';
    var backgroundPage;
    var activeTab;

    // models
    $scope.manifest = chrome.runtime.getManifest();
	
	// array of highlight definitions
    _storage.highlightDefinitions.getAll_Promise().then(function (items) {
        $scope.highlightDefinitions = items.highlightDefinitions;
    });
	
	$scope.commands = {};
	$scope.sort = {}
	
	// current style filter. null for none
	$scope.styleFilterHighlightDefinition = null;

	// predicate for filter by style
	$scope.styleFilterPredicate = function(doc, index) {
		if (!$scope.styleFilterHighlightDefinition) {
			return true;
		}
		
		return doc.className === $scope.styleFilterHighlightDefinition.className;
	};

	var utf8_to_b64 = function(str) {
	    return window.btoa(unescape(encodeURIComponent(str)));
	};

    /**
     * Clear and fill the 'docs' model
     * @param {function} [callback] function(err, docs)
     * @private
     */
    var updateDocs = function () {
        // get all the documents (create & delete) associated with the match, then filter the deleted ones
        return backgroundPage._database.getCreateDocuments_Promise($scope.match).then(function (docs) {
            // if the highlight cant be found in DOM, flag that
			return Promise.all(docs.map(function (doc) {
                return backgroundPage._eventPage.isHighlightInDOM(activeTab.id, doc._id).then(function (isInDOM) {
                    doc.isInDOM = isInDOM;
                }).catch(function () {
                	// swallow
					doc.isInDOM = false
                }).then(function () {
                	return doc;
                })
			}));

        }).then(function (docs) {
			// sort the docs using the sort value
			var compare = (backgroundPage._tabs.getComparisonFunction(
				activeTab.id, $scope.sort.value)) || null;
			
			// var compare = backgroundPage._tabs.getComparisonFunction(
			// 	activeTab.id, "location")
			
			return (compare && 
				backgroundPage._database.sortDocuments(docs, compare)) ||
				Promise.resolve(docs);
        }).then(function (docs) {
        	$scope.docs = docs
			
			return docs;
        });
    };
	
	// starter
	chrome.tabs.query({ 
		active: true, 
		currentWindow: true 
	}, function (result) {
	    chrome.runtime.getBackgroundPage(function (bgPage) {
	        // onInit(result[0], backgroundPage);
	        activeTab = result[0];
	        backgroundPage = bgPage;

			// initialize controller variables
	        _storage.getPopupHighlightTextMaxLength_Promise().then(function (max) {
	            if (max) {
	                $scope.popupHighlightTextMaxLength = max;
	            }
	        });
			
			// if the url protocol is file based, and the
			// user hasn't been warned to enable
			// file access for the extension, set a flag now. 
			// The view will set the warning's
			// visibility based on its value.
			_storage.getFileAccessRequiredWarningDismissed_Promise().then(function(dismissed) {
				// if its already been dismissed before, no need to check
				if (!dismissed) {
					// it not being a file protocol url is the same as invisible (dismissed)
					var u = purl(activeTab.url);
					dismissed = ('file' !== u.attr('protocol'));
				}
				
				$scope.fileAccessRequiredWarningVisible = !dismissed;
			});
			
			// listener for variable change. syncs value to storage
            $scope.$watch('fileAccessRequiredWarningVisible', function (newVal, oldVal) {
                if (newVal === oldVal) {
					return;
				}
				
                console.log(newVal);
                _storage.setFileAccessRequiredWarningDismissed_Promise(!newVal);
            });			
			
			
	        // default to no clamp
	//        chrome.storage.sync.get({
	//            "highlightTextLineClamp": null
	//        }, function (result) {
	//            if (result) {
	//                $scope.webkitLineClamp = (result.highlightTextLineClamp ?
	//                    result.highlightTextLineClamp.toString() : null);
	//            }
	//        });

	        $scope.title = activeTab.title;
	        $scope.match = backgroundPage._database.buildMatchString(activeTab.url);
			
	        // shortcut commands array
	        chrome.commands.getAll(function (allCommands) {
				// key commands by their name in the scope attribute
				// can't identify specific commands in angular
				$scope.$apply(function () {
					allCommands.forEach(function (command) {
						$scope.commands[command.name] = command;
					});
				});
	        });

			// get the values needed before first updateDocs can happen
			_storage.getValue("highlight_sort_by").then(function (value) {
				$scope.sort.value = value
			}).then(function () {
				return updateDocs();				
			}).then(function () {
				$scope.$apply();
			})
	    });
	});
	
    /**
     * Clicked an existing definition
     */
    $scope.onClickStyleFilter = function (event, definition) {
		event.stopPropagation();
		
		$scope.styleFilterHighlightDefinition = definition;
		// $scope.$apply();
    };
	
	$scope.onChangeSelectSort = function () {
		// update the stored sort value
	    return _storage.setValue($scope.sort.value, "highlight_sort_by").then(function () {
			// update the docs array, taking into account the current sort value
			return updateDocs()
		}).then(function () {
			// reflect in DOM
			$scope.$apply()
		})
	};

	/**
	 * Show the remaining hidden text for a specific highlight
	 * @param {Object} doc document for the specific highlight
	 */
    $scope.onClickMore = function (event, doc) {
		event.preventDefault(); 
		event.stopPropagation()

        // TODO: shouldn't really be in the controller...
        $("#" + doc._id + " .highlight-text").text(doc.text);
    };

    /**
     * Click a highlight. Scroll to it in DOM
     * @param {object} doc
     */
    $scope.onClickHighlight = function (doc) {
        if (!doc.isInDOM) {
			return Promise.reject();
		}
		
		return backgroundPage._eventPage.scrollTo(activeTab.id, doc._id);
    };

    /**
     * Clicked 'select' button
     * @param {object} doc
     */
    $scope.onClickSelect = function (doc) {
        if (doc.isInDOM) {
            backgroundPage._eventPage.selectHighlightText(activeTab.id, doc._id);
            window.close();
        }
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
        backgroundPage._eventPage.speakHighlightText(activeTab.id, documentId);
    };

    /**
     * Clicked an existing definition
     * @param {number} index index of definition in local array
     */
    $scope.onClickRedefinition = function (event, doc, index) {
		event.stopPropagation()

		// get classname of new definition
		var newDefinition = $scope.highlightDefinitions[index];

		backgroundPage._eventPage.updateHighlight(activeTab.id, 
			doc._id, newDefinition.className);
			
		// update local classname, which will update class in dom
		doc.className = newDefinition.className;
    };

	$scope.onClickUndoLastHighlight = function () {
		// event.preventDefault();
		// event.stopPropagation();

        return backgroundPage._eventPage.undoLastHighlight(activeTab.id).then(function (result) {
            if (result.ok ) {
				return updateDocs();
			} else {
				return Promise.reject();
			}
		}).then(function (docs) {
			// console.log(docs)
            // // close popup on last doc removed
            if (docs.length === 0) {
                window.close();
            } else {
				$scope.$apply();
            }
        });
	};

    /**
     * Clicked menu 'open overview' button. Opens a new tab, with the highlights fully displayed in it
     */
    $scope.onClickOpenOverviewInNewTab = function () {
        // get the full uri for the tab. the summary page will get the match for it
        chrome.tabs.create({
            url: "overview.html?" +
                "id=" + activeTab.id + "&" +
                "url=" + encodeURIComponent(activeTab.url) + "&" +
                "title=" + encodeURIComponent($scope.title)
        });
    };
	
	$scope.onClickSaveOverview = function (docs) {
		var comparisonPredicate = backgroundPage._tabs.getComparisonFunction(
			activeTab.id, $scope.sort.value);
		
		// format all highlights as a markdown document
		return backgroundPage._eventPage.getOverviewText(
			"markdown", activeTab, comparisonPredicate, $scope.styleFilterPredicate).then(function (text) {
				// create a temporary anchor to navigate to data uri
				var a = document.createElement("a");

				a.download = chrome.i18n.getMessage("save_overview_file_name");
				a.href = "data:text;base64," + utf8_to_b64(text);

				// create & dispatch mouse event to hidden anchor
				var mEvent = document.createEvent("MouseEvent");
				mEvent.initMouseEvent("click", true, true, window,
					0, 0, 0, 0, 0, false, false, false, false, 0, null);

				a.dispatchEvent(mEvent);
			});
	};
	
	$scope.onClickCopyOverview = function (docs) {
		// format all highlights as a markdown document

		// sort the docs using the sort value
		var comparisonPredicate = backgroundPage._tabs.getComparisonFunction(
			activeTab.id, $scope.sort.value);
		
		return backgroundPage._eventPage.getOverviewText(
			"markdown-no-footer", activeTab, comparisonPredicate, $scope.styleFilterPredicate).then(function (text) {
				// Create element to contain markdown
				var pre = document.createElement('pre');
				pre.innerText = text;
		
				document.body.appendChild(pre);

				var range = document.createRange();
			    range.selectNode(pre);
		
				// make our node the sole selection
				var selection = document.getSelection();
				selection.removeAllRanges();
				selection.addRange(range);

				document.execCommand('copy');

				selection.removeAllRanges();
		        document.body.removeChild(pre);

				window.close();
			});
	};

    /**
     * Clicked 'remove' button for a highlight
     * @param {string} documentId highlight id
     */
    $scope.onClickRemoveHighlight = function (event, documentId) {
		// event.preventDefault();
		// event.stopPropagation();
		
		 $(event.currentTarget).css({
			'opacity': 0,
			'transform': 'scale(5)'
		});
		
		 // wait until button disappears before sending message to remove highlight
		event.currentTarget.addEventListener("transitionend", function(event) {
			if (event.propertyName !== "opacity") {
				return;
			}

			backgroundPage._eventPage.deleteHighlight(activeTab.id, documentId).then(function (result) {
				if (result.ok ) {
					return updateDocs();
				} else {
					return Promise.reject();
				}
			}).then(function (docs) {
				// close popup on last doc removed
				if (docs.length === 0) {
					window.close();
				} else {
					$scope.$apply();
				}
			});
		}, false);

        // backgroundPage._eventPage.deleteHighlight(activeTab.id, documentId).then(function (result) {
        //     if (result.ok ) {
	    //         return updateDocs();
		// 	} else {
		// 		return Promise.reject();
		// 	}
		// }).then(function (docs) {
        //     // close popup on last doc removed
        //     if (docs.length === 0) {
        //         window.close();
        //     } else {
		// 		$scope.$apply();
        //     }
        // });
    };

    /**
     * Clicked 'remove all' button
     */
    $scope.onClickRemoveAllHighlights = function () {
        // if (window.confirm(chrome.extension.getMessage("confirm_remove_all_highlights"))) {
	    return backgroundPage._eventPage.deleteHighlights(activeTab.id, $scope.match).then(function(){
	    	window.close();
	    });
            
        // }
    };
	
	/**
	 * Clicked 'ok got it' button for the offline (file protocol) warning
	 */	
	$scope.onClickDismissFileAccessRequiredWarning = function () {
		// a listener created in the initializer will set the value to the storage
		$scope.fileAccessRequiredWarningVisible = false;
	};

}]);