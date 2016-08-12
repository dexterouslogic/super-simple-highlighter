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
	  * Default values for storage key getter. Also index of legal keys
	  */
	_defaults: {
		// identifier for comparator to use for highlight sorting
		"highlight_sort_by": "time"
	},
	
	/**
	  * Generic value setter. TODO: replace all with this
	  */
	setValue: function(value, key) {
		"use strict";
		return new Promise(function (resolve, reject) {
			// key must be known
			if (!_storage._defaults.hasOwnProperty(key)) {
				throw "Unknown key";
			}
			
			// value to set
 			var items = {};
			items[key] = value;
			
	        chrome.storage.sync.set(items, function () {
	        	if (chrome.runtime.lastError) {
	        		reject(chrome.runtime.lastError)
	        	} else {
	        		resolve();
	        	}
	        });
		});
	},
	
	/**
	  * Generic value getter. TODO: replace all with this
	  */
	getValue: function(key) {
		"use strict";
		return new Promise(function (resolve, reject) {
			// key must be known
			if (!_storage._defaults.hasOwnProperty(key)) {
				throw "Unknown key";
			}
			
			// value to get, including default value
 			var items = {};
			items[key] = _storage._defaults[key];
			
	        chrome.storage.sync.get(items, function (result) {
	        	if (chrome.runtime.lastError) {
	        		reject(chrome.runtime.lastError)
	        	} else {
	        		resolve(result[key]);
	        	}
	        });
		});
	},
	
	
	/**
	 * Setter for 'has user explictly dismissed the 'you must enabled file access'' warning
	 * @param {Boolean} fileAccessRequiredWarningDismissed true if warning was dismissed
     * @param {function} callback standard storage setter callback
	 * @type function
	 */
	setFileAccessRequiredWarningDismissed_Promise: function(dismissed) {
		"use strict";
		return new Promise(function (resolve, reject) {
	        chrome.storage.sync.set({
	            fileAccessRequiredWarningDismissed: dismissed
	        }, function () {
	        	if (chrome.runtime.lastError) {
	        		reject(chrome.runtime.lastError)
	        	} else {
	        		resolve();
	        	}
	        });
		});
	},
	
	/**
	 * Getter for 'has user explictly dismissed the 'you must enabled file access'' warning
	 * @param {function} callback function(fileAccessRequiredWarningDismissed)
	 * @type function
	 */
	getFileAccessRequiredWarningDismissed_Promise: function () {
        "use strict";
		return new Promise(function (resolve, reject) {
	        chrome.storage.sync.get({
	            fileAccessRequiredWarningDismissed: false
	        }, function (items) {
	        	if (chrome.runtime.lastError) {
	        		reject(chrome.runtime.lastError)
	        	} else {
	        		resolve(items.fileAccessRequiredWarningDismissed);
	        	}
	        });
		});
	},
	
    /**
     * Set 'should selection be removed after selection' flag
     * @param {bool} unselectAfterHighlight
     * @param {function} [callback] Callback on success, or on failure (in which case runtime.lastError will be set).
     */
    setUnselectAfterHighlight_Promise: function (unselectAfterHighlight) {
        "use strict";
		return new Promise(function (resolve, reject) {
	        chrome.storage.sync.set({
	            unselectAfterHighlight: unselectAfterHighlight
	        }, function () {
	        	if (chrome.runtime.lastError) {
	        		reject(chrome.runtime.lastError)
	        	} else {
	        		resolve();
	        	}
	        });
		});
    },

    /**
     * Getter for unselect setting
     * @param {function} callback function(unselectAfterHighlight)
     */
    getUnselectAfterHighlight_Promise: function () {
        "use strict";
		return new Promise(function (resolve, reject) {
	        chrome.storage.sync.get({
	            unselectAfterHighlight: false
	        }, function (items) {
	        	if (chrome.runtime.lastError) {
	        		reject(chrome.runtime.lastError)
	        	} else {
	        		resolve(items.unselectAfterHighlight);
	        	}
	        });
		});
    },

    /**
     * Getter for max number of characters a highlight's text can show in popup before ellipsis/more link shows
     * @param {function} callback function(max)
     */
    getPopupHighlightTextMaxLength_Promise: function () {
        "use strict";
		return new Promise(function (resolve, reject) {
	        chrome.storage.sync.get({
	            popupHighlightTextMaxLength: 512
	        }, function (items) {
	        	if (chrome.runtime.lastError) {
	        		reject(chrome.runtime.lastError)
	        	} else {
	        		resolve(items.popupHighlightTextMaxLength);
	        	}
	        });
		});
    },

    /**
     * Setter for alpha storage
     * @param {number} alpha
     * @param {function} callback Callback on success, or on failure (in which case runtime.lastError will be set).
     */
    setHighlightBackgroundAlpha_Promise: function (alpha) {
        "use strict";
		return new Promise(function (resolve, reject) {
	        chrome.storage.sync.set({
	            highlightBackgroundAlpha: alpha
	        }, function () {
	        	if (chrome.runtime.lastError) {
	        		reject(chrome.runtime.lastError)
	        	} else {
	        		resolve();
	        	}
	        });
		});
    },

    /**
     * Get highlight background alpha setting
     * @param {function} callback function(alpha) (on error, alpha is undefined. call chrome.runtime.getLastError).
     *  Alpha is in range 0..1
     */
    getHighlightBackgroundAlpha_Promise: function () {
        "use strict";
		return new Promise(function (resolve, reject) {
			chrome.storage.sync.get({
	            highlightBackgroundAlpha: 0.8
	        }, function (items) {
	        	if (chrome.runtime.lastError) {
	        		reject(chrome.runtime.lastError)
	        	} else {
	        		resolve(items.highlightBackgroundAlpha);
	        	}
	        });
		});
    },
	
	setEnableHighlightBoxShadow_Promise: function (enableHighlightBoxShadow) {
        "use strict";
		return new Promise(function (resolve, reject) {
	        chrome.storage.sync.set({
	            "enableHighlightBoxShadow": enableHighlightBoxShadow
	        }, function () {
	        	if (chrome.runtime.lastError) {
	        		reject(chrome.runtime.lastError)
	        	} else {
	        		resolve();
	        	}
	        });
		});			
	},

	isHighlightBoxShadowEnabled_Promise: function () {
        "use strict";
		return new Promise(function (resolve, reject) {
	        chrome.storage.sync.get({
	            "enableHighlightBoxShadow": true,
	        }, function (items) {
	        	if (chrome.runtime.lastError) {
	        		reject(chrome.runtime.lastError)
	        	} else {
	        		resolve(items.enableHighlightBoxShadow);
	        	}
	        });
		})
	},

    /**
     * Namespace for highlight definitions things
     */
    highlightDefinitions: {
		_keyNames: {
			highlightDefinitions: "highlightDefinitions",
			sharedHighlightStyle: "sharedHighlightStyle"
		},
		
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
                    // "font-style": "inherit"
                }
            };
        },

		setAll_Promise: function(items) {
			var setKeys = {};
			var removeKeys = [];
			
			setKeys[this._keyNames.highlightDefinitions] = items.highlightDefinitions;
			setKeys[this._keyNames.sharedHighlightStyle] = items.sharedHighlightStyle;
			
			// keys with explicit null value are removed
			Object.keys(setKeys).forEach(function(key) {
				if (items[key] == null) {
					removeKeys.push(key);
					delete setKeys[key];
				}
			});
			
			var sync = chrome.storage.sync;
			
			return new Promise(function(resolve, reject) {
				sync.set(setKeys, function() {
					if (chrome.runtime.lastError) {
						reject(chrome.runtime.lastError);
					} else {
						resolve();
					}
				});
			}).then(function() {
				return new Promise(function(resolve, reject) {
					sync.remove(removeKeys, function() {
						if (chrome.runtime.lastError) {
							reject(chrome.runtime.lastError);
						} else {
							resolve();
						}
					});
				});
			});
		},

		/**
		 *  Get an array of objects describing highlight styles
		 */
        getAll_Promise: function (options) {
            "use strict";
			options = options || {};
			
			if (options.defaults === undefined) {
				options.defaults = true;
			}

			var keys = {};
			keys[this._keyNames.highlightDefinitions] = null;
			keys[this._keyNames.sharedHighlightStyle] = null;
			
			if (options.defaults) {
				// cache defaults
				if (this.defaultHighlightDefintions === undefined) {
					this.defaultHighlightDefintions = [
		                this.create(chrome.i18n.getMessage("color_title_red"),
		                    "default-red-aa94e3d5-ab2f-4205-b74e-18ce31c7c0ce", "#ff8080", "#000000"),
		                this.create(chrome.i18n.getMessage("color_title_orange"),
		                    "default-orange-da01945e-1964-4d27-8a6c-3331e1fe7f14", "#ffd2AA", "#000000"),
		                this.create(chrome.i18n.getMessage("color_title_yellow"),
		                    "default-yellow-aaddcf5c-0e41-4f83-8a64-58c91f7c6250", "#ffffAA", "#000000"),
		                this.create(chrome.i18n.getMessage("color_title_green"),
		                    "default-green-c4d41e0a-e40f-4c3f-91ad-2d66481614c2", "#AAffAA", "#000000"),
		                this.create(chrome.i18n.getMessage("color_title_cyan"),
		                    "default-cyan-f88e8827-e652-4d79-a9d9-f6c8b8ec9e2b", "#AAffff", "#000000"),
		                this.create(chrome.i18n.getMessage("color_title_purple"),
		                    "default-purple-c472dcdb-f2b8-41ab-bb1e-2fb293df172a", "#FFAAFF", "#000000"),
		                this.create(chrome.i18n.getMessage("color_title_grey"),
		                    "default-grey-da7cb902-89c6-46fe-b0e7-d3b35aaf237a", "#777777", "#FFFFFF")
					]
				}
				
				keys[this._keyNames.highlightDefinitions] = this.defaultHighlightDefintions;
				keys[this._keyNames.sharedHighlightStyle] = {
					"position": "relative",
	                "border-radius": "0.2em",
	                //"padding": "0.2em",
	                "transition-property": "color, background-color",
	                "transition-duration": "0.5s",
	                "transition-timing-function": "ease-in-out",

	                // color & font-style when highlight is defined by a class which no longer exists
	                // each specific style must override these, or inherit default
	                "color": "#AAAAAA",
	                "background-color": "#EEEEEE",
	//                        "box-shadow": "0 0 8px #D3D3D3",
	                "font": "inherit",

	                // "display": "inline-block",
	                "animation": "fontbulger 0.2s ease-in-out 0s 2 alternate"
	            };
			}
				
			return new Promise(function (resolve, reject) {
				chrome.storage.sync.get(keys, function(items) {
					if (chrome.runtime.lastError) {
						reject(chrome.runtime.lastError);
					} else {
						resolve(items);
					} 
				});
			});
        },

        /**
         * Add/update a highlight definition. If one exists with this classname it is updated, else a new entry is created
         * @param {object} newDefinition
         */
        set_Promise: function (newDefinition) {
            "use strict";
            // if we need to update an existing definition, need to search for it
            return _storage.highlightDefinitions.getAll_Promise().then(function (result) {
                // find the existing definition
                var index = _storage.highlightDefinitions.getIndex(
					newDefinition.className, result.highlightDefinitions);

                if (index === -1) {
                    // add as a new definition
                    result.highlightDefinitions.push(newDefinition);
                } else {
                    // replace
                    result.highlightDefinitions.splice(index, 1, newDefinition);
                }

                // replace entire array
				return new Promise(function(resolve, reject) {
	                chrome.storage.sync.set({
	                    highlightDefinitions: result.highlightDefinitions
	                }, function () {
						if (chrome.runtime.lastError) {
							reject(chrome.runtime.lastError);
						} else {
							resolve();
						}
	                });
				});
            });
        },


        /**
         * Remove a highlight definition
         * @param {string} className class name to identify definition
         */
        remove_Promise: function (className) {
            "use strict";
            // find the existing object with this class name
			return _storage.highlightDefinitions.getAll_Promise().then(function (result) {
                var index = _storage.highlightDefinitions.getIndex(className,
					result.highlightDefinitions);

                if (index === -1) {
					return Promise.reject(new Error("Unable to find defintion with this class name"))
               }

                result.highlightDefinitions.splice(index, 1);

                // replace existing array with this one
				return new Promise(function(resolve, reject) {
	                chrome.storage.sync.set({
	                    highlightDefinitions: result.highlightDefinitions
	                }, function () {
						if (chrome.runtime.lastError) {
							reject(chrome.runtime.lastError);
						} else {
							resolve();
						}
	                });
				});
            });
        },

        /**
         * Remove every highlight style from storage
         */
        removeAll_Promise: function () {
            "use strict";
			return new Promise(function(resolve, reject) {
				var key = _storage.highlightDefinitions._keyNames.highlightDefinitions;

				// remove any customized styles from storage (keep sharedHighlightStyle)
				chrome.storage.sync.remove(key, function () {
					if (chrome.runtime.lastError) {
						reject(chrome.runtime.lastError);
					} else {
						resolve();
					}
                });
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