/*global _stringUtils*/

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


var _storage = {
	/**
	 * Setter for 'has user explictly dismissed the 'you must enabled file access'' warning
	 * @param {Boolean} fileAccessRequiredWarningDismissed true if warning was dismissed
     * @param {function} callback standard storage setter callback
	 * @type function
	 */
	setFileAccessRequiredWarningDismissed: function(fileAccessRequiredWarningDismissed, callback) {
		"use strict";
        chrome.storage.sync.set({
            fileAccessRequiredWarningDismissed: fileAccessRequiredWarningDismissed
        }, callback);
	},
	
	/**
	 * Getter for 'has user explictly dismissed the 'you must enabled file access'' warning
	 * @param {function} callback function(fileAccessRequiredWarningDismissed)
	 * @type function
	 */
	getFileAccessRequiredWarningDismissed: function (callback) {
        "use strict";
        chrome.storage.sync.get({
            fileAccessRequiredWarningDismissed: false
        }, function (items) {
			if (callback) {
				callback (items.fileAccessRequiredWarningDismissed);
			}
        });
	},
	
    /**
     * Set 'should selection be removed after selection' flag
     * @param {bool} unselectAfterHighlight
     * @param {function} [callback] Callback on success, or on failure (in which case runtime.lastError will be set).
     */
    setUnselectAfterHighlight: function (unselectAfterHighlight, callback) {
        "use strict";
        chrome.storage.sync.set({
            unselectAfterHighlight: unselectAfterHighlight
        }, callback);
    },

    /**
     * Getter for unselect setting
     * @param {function} callback function(unselectAfterHighlight)
     */
    getUnselectAfterHighlight: function (callback) {
        "use strict";
        chrome.storage.sync.get({
            unselectAfterHighlight: false
        }, function (items) {
			if (callback) {
				callback (items.unselectAfterHighlight);
			}
        });
    },

    /**
     * Getter for max number of characters a highlight's text can show in popup before ellipsis/more link shows
     * @param {function} callback function(max)
     */
    getPopupHighlightTextMaxLength: function (callback) {
        "use strict";
        chrome.storage.sync.get({
            popupHighlightTextMaxLength: 512
        }, function (items) {
            callback (items.popupHighlightTextMaxLength);
        });
    },

    /**
     * Setter for alpha storage
     * @param {number} alpha
     * @param {function} callback Callback on success, or on failure (in which case runtime.lastError will be set).
     */
    setHighlightBackgroundAlpha: function (alpha, callback) {
        "use strict";
        chrome.storage.sync.set({
            highlightBackgroundAlpha: alpha
        }, callback);
    },

    /**
     * Get highlight background alpha setting
     * @param {function} callback function(alpha) (on error, alpha is undefined. call chrome.runtime.getLastError).
     *  Alpha is in range 0..1
     */
    getHighlightBackgroundAlpha: function (callback) {
        "use strict";
        chrome.storage.sync.get({
            highlightBackgroundAlpha: 0.8
        }, function (items) {
            callback (items.highlightBackgroundAlpha);
        });
    },

    /**
     * Namespace for highlight definitions things
     */
    highlightDefinitions: {
//        _defaults: {
//            "highlightDefinitions": [
//                _storage.highlightDefinitions.create(chrome.i18n.getMessage("color_title_red"),
//                    "default-red-aa94e3d5-ab2f-4205-b74e-18ce31c7c0ce", "#ff8080", "#000000"),
//                _storage.highlightDefinitions.create(chrome.i18n.getMessage("color_title_orange"),
//                    "default-orange-da01945e-1964-4d27-8a6c-3331e1fe7f14", "#ffd2AA", "#000000"),
//                _storage.highlightDefinitions.create(chrome.i18n.getMessage("color_title_yellow"),
//                    "default-yellow-aaddcf5c-0e41-4f83-8a64-58c91f7c6250", "#ffffAA", "#000000"),
//                _storage.highlightDefinitions.create(chrome.i18n.getMessage("color_title_green"),
//                    "default-green-c4d41e0a-e40f-4c3f-91ad-2d66481614c2", "#AAffAA", "#000000"),
//                _storage.highlightDefinitions.create(chrome.i18n.getMessage("color_title_cyan"),
//                    "default-cyan-f88e8827-e652-4d79-a9d9-f6c8b8ec9e2b", "#AAffff", "#000000"),
//                _storage.highlightDefinitions.create(chrome.i18n.getMessage("color_title_purple"),
//                    "default-purple-c472dcdb-f2b8-41ab-bb1e-2fb293df172a", "#FFAAFF", "#000000"),
//                _storage.highlightDefinitions.create(chrome.i18n.getMessage("color_title_grey"),
//                    "default-grey-da7cb902-89c6-46fe-b0e7-d3b35aaf237a", "#777777", "#FFFFFF")
//            ],
//            'sharedHighlightStyle': {
//                "border-radius": "0.2em",
//                //"padding": "0.2em",
//                "transition-property": "color, background-color, box-shadow",
//                "transition-duration": "0.1s, 0.1s, 0.1s",
//                "transition-timing-function": "linear, linear, linear",
//
//                // color & font-style when highlight is defined by a class which no longer exists
//                // each specific style must override these, or inherit default
//                "color": "#806060",
//                "background-color": "#D3D3D3",
//            //                        "box-shadow": "0 0 8px #D3D3D3",
//                "font-style": "italic"
//            }
//        },

        /**
         * Create a new definition object, with the default properties
         * @param {string} [title] optional title
         * @param {string} [className] optional class name
         * @param {string} [backgroundColor] optional background color in form #RRGGBB
         * @param {string} [textColor] optional background text colour in form #RRGGBB
         * @return {object}
         */
        create: function (title, className, backgroundColor, textColor) {
            "use strict";
            if (!backgroundColor) {
                backgroundColor = "#ff8080";
            }

            if (!className) {
                className = _stringUtils.createUUID({
                    beginWithLetter: true
                });
            }

            if (!textColor) {
                textColor = "#000000";
            }

            // required
            return {
                title: title,// (title ? title : chrome.i18n.getMessage("highlight_title_undefined")),
                className: className,
                inherit_style_color: false,

                style: {
//                    "box-shadow": "0 0 8px " + backgroundColor,
                    "background-color": backgroundColor,
                    "color": textColor,

                    // must override the shared style
                    "font-style": "inherit"
                }
            };
        },

        /**
         * Get an array of objects describing highlight styles
         * @param {function} callback function (object), containing highlightDefinitions array, defaultHighlightStyle object
         */
        getAll: function (callback) {
            "use strict";
            chrome.storage.sync.get({
                "highlightDefinitions": null,
                'sharedHighlightStyle': {
                    "border-radius": "0.2em",
                    //"padding": "0.2em",
                    "transition-property": "color, background-color, box-shadow",
                    "transition-duration": "0.1s, 0.1s, 0.1s",
                    "transition-timing-function": "linear, linear, linear",

                    // color & font-style when highlight is defined by a class which no longer exists
                    // each specific style must override these, or inherit default
                    "color": "#806060",
                    "background-color": "#D3D3D3",
//                        "box-shadow": "0 0 8px #D3D3D3",
                    "font-style": "italic"
                }
            }, function (items1) {
                // if we've already defined highlight definition, and we'll always have sharedHighlightStyle, its OK
                if (items1.highlightDefinitions) {
                    callback(items1);
                    return;
                }

                // if there's no highlightDefinitions, use the default set. BUT this must both be random per-user, but
                // survive 'reset all styles'
                chrome.storage.sync.get("defaultHighlightDefinitions", function (items2) {
                    /**
                     * Create a class name for one of the default styles
                     * @return {string}
                     * @private
                     */
                    function createClassName() {
                        return "default-" + _stringUtils.createUUID();
                    }

                    // have defaults not yet been specified
                    if (!items2.defaultHighlightDefinitions) {
                        // TODO: eventually, once everyone has defaults with the default-color-xxx class, use the random function
                        items2.defaultHighlightDefinitions = [
                            _storage.highlightDefinitions.create(chrome.i18n.getMessage("color_title_red"),
                                "default-red-aa94e3d5-ab2f-4205-b74e-18ce31c7c0ce", "#ff8080", "#000000"),
                            _storage.highlightDefinitions.create(chrome.i18n.getMessage("color_title_orange"),
                                "default-orange-da01945e-1964-4d27-8a6c-3331e1fe7f14", "#ffd2AA", "#000000"),
                            _storage.highlightDefinitions.create(chrome.i18n.getMessage("color_title_yellow"),
                                "default-yellow-aaddcf5c-0e41-4f83-8a64-58c91f7c6250", "#ffffAA", "#000000"),
                            _storage.highlightDefinitions.create(chrome.i18n.getMessage("color_title_green"),
                                "default-green-c4d41e0a-e40f-4c3f-91ad-2d66481614c2", "#AAffAA", "#000000"),
                            _storage.highlightDefinitions.create(chrome.i18n.getMessage("color_title_cyan"),
                                "default-cyan-f88e8827-e652-4d79-a9d9-f6c8b8ec9e2b", "#AAffff", "#000000"),
                            _storage.highlightDefinitions.create(chrome.i18n.getMessage("color_title_purple"),
                                "default-purple-c472dcdb-f2b8-41ab-bb1e-2fb293df172a", "#FFAAFF", "#000000"),
                            _storage.highlightDefinitions.create(chrome.i18n.getMessage("color_title_grey"),
                                "default-grey-da7cb902-89c6-46fe-b0e7-d3b35aaf237a", "#777777", "#FFFFFF")
                        ];

                        // store 'defaultHighlightDefinitions' array
                        chrome.storage.sync.set(items2);
                    }

                    // use the defaults as the actual highlight definitions (but don't store it like that)
                    items1.highlightDefinitions = items2.defaultHighlightDefinitions;
                    callback(items1);
                });
            });




//            chrome.storage.sync.get(_storage.highlightDefinitions._defaults, callback);
        },

        /**
         * Add/update a highlight definition. If one exists with this classname it is updated, else a new entry is created
         * @param {object} newDefinition
         * @param [callback] function(err)
         */
        set: function (newDefinition, callback) {
            "use strict";
            // if we need to update an existing definition, need to search for it
            _storage.highlightDefinitions.getAll(function (result) {
                if (chrome.runtime.lastError) {
                    if (callback) {
                        callback(chrome.runtime.lastError);
                    }
                    return;
                }

                // find the existing definition
                var index = _storage.highlightDefinitions.getIndex(newDefinition.className, result.highlightDefinitions);
                if (index === -1) {
                    // add as a new definition
                    result.highlightDefinitions.push(newDefinition);
                } else {
                    // replace
                    result.highlightDefinitions.splice(index, 1, newDefinition);
                }

                // replace entire array
                chrome.storage.sync.set({
                    highlightDefinitions: result.highlightDefinitions
                }, function () {
                    if (callback) {
                        callback(chrome.runtime.lastError);
                    }
                });
            });
        },


        /**
         * Remove a highlight definition
         * @param {string} className class name to identify definition
         * @param {function} [callback] function(err) {...} (runtime.lastError set on failure)
         */
        remove: function (className, callback) {
            "use strict";
            // find the existing object with this class name
            _storage.highlightDefinitions.getAll(function (result) {
                if (chrome.runtime.lastError) {
                    if (callback) {
                        callback(chrome.runtime.lastError);
                    }
                    return;
                }

                var index = _storage.highlightDefinitions.getIndex(className, result.highlightDefinitions);
                if (index === -1) {
                    if (callback) {
                        callback({
                            message: "Unable to find defintion with this class name"
                        });
                    }
                    return;
                }

                result.highlightDefinitions.splice(index, 1);

                // replace existing array with this one
                chrome.storage.sync.set({
                    highlightDefinitions: result.highlightDefinitions
                }, function () {
                    if (callback) {
                        callback(chrome.runtime.lastError);
                    }
                });
            });
        },

        /**
         * Remove every highlight style from storage
         * @param {function} [callback] function(err): if !err, success
         */
        removeAll: function (callback) {
            "use strict";
            chrome.storage.sync.remove("highlightDefinitions", function () {
                if (callback) {
                    callback(chrome.runtime.lastError);
                }
            });
        },

        /**
         * Helper to get the index of a definition in the array
         * @param {string} className
         * @param {Array} all
         * @return {number} index, or -1
         */
        getIndex: function (className, all) {
            "use strict";
            for(var i=0; i < all.length; i++) {
                if(all[i].className === className){
                    return i;
                }
            }

            return -1;
        }
    }
};