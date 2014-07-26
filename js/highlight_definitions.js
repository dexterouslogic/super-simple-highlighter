/*global _stringUtils*/

var _highlightDefinitions = {
    /**
     * Lazy getter for default storage values
     * @returns {object}
     * @private
     */
    _getDefaults: function () {
        "use strict";
        if (_highlightDefinitions._defaults === undefined) {
            _highlightDefinitions._defaults = {
                "highlightDefinitions": [
                    _highlightDefinitions.create(chrome.i18n.getMessage("color_title_red"),
                        "default-red-aa94e3d5-ab2f-4205-b74e-18ce31c7c0ce", "#ff8080", "#000000"),
                    _highlightDefinitions.create(chrome.i18n.getMessage("color_title_orange"),
                        "default-orange-da01945e-1964-4d27-8a6c-3331e1fe7f14", "#ffd2AA", "#000000"),
                    _highlightDefinitions.create(chrome.i18n.getMessage("color_title_yellow"),
                        "default-yellow-aaddcf5c-0e41-4f83-8a64-58c91f7c6250", "#ffffAA", "#000000"),
                    _highlightDefinitions.create(chrome.i18n.getMessage("color_title_green"),
                        "default-green-c4d41e0a-e40f-4c3f-91ad-2d66481614c2", "#AAffAA", "#000000"),
                    _highlightDefinitions.create(chrome.i18n.getMessage("color_title_cyan"),
                        "default-cyan-f88e8827-e652-4d79-a9d9-f6c8b8ec9e2b", "#AAffff", "#000000"),
                    _highlightDefinitions.create(chrome.i18n.getMessage("color_title_purple"),
                        "default-purple-c472dcdb-f2b8-41ab-bb1e-2fb293df172a", "#FFAAFF", "#000000"),
                    _highlightDefinitions.create(chrome.i18n.getMessage("color_title_grey"),
                        "default-grey-da7cb902-89c6-46fe-b0e7-d3b35aaf237a", "#777777", "#FFFFFF")
                ],
                'sharedHighlightStyle': {
                    "border-radius": "0.2em",
                    //"padding": "0.2em",
                    "transition-property": "color, background-color",
                    "transition-duration": "0.1s, 0.1s",
                    "transition-timing-function": "linear, linear",

                    // color & font-style when highlight is defined by a class which no longer exists
                    // each specific style must override these, or inherit default
                    "color": "gray",
                    "background-color": "lightgray",
                    "font-style": "italic"
                }
            };
        }

        return _highlightDefinitions._defaults;
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

        // required
        var d = {
            title: title,// (title ? title : chrome.i18n.getMessage("highlight_title_undefined")),
            className: (className ? className : _stringUtils.createUUID({
                beginWithLetter: true
            })),

            style: {
                "background-color": backgroundColor ? backgroundColor : "#ff8080",
                "color": textColor ? textColor : "#000000",

                // must override the shared style
                "font-style": "inherit"
            }
        };


        return d;
    },

    /**
     * Get an array of objects describing highlight styles
     * @param {object} [callback] function (object), containing highlightDefinitions array, defaultHighlightStyle object
     */
    getAll: function (callback) {
        "use strict";
        chrome.storage.sync.get(_highlightDefinitions._getDefaults(), callback);
    },

    /**
     * Add/update a highlight definition. If one exists with this classname it is updated, else a new entry is created
     * @param {object} newDefinition
     * @param [callback] function(err)
     */
    set: function (newDefinition, callback) {
        "use strict";
        // if we need to update an existing definition, need to search for it
        _highlightDefinitions.getAll(function (result) {
            if (chrome.runtime.lastError) {
                if (callback) {
                    callback(chrome.runtime.lastError);
                }
                return;
            }

            // find the existing definition
            var index = _highlightDefinitions.getIndex(newDefinition.className, result.highlightDefinitions);
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
        _highlightDefinitions.getAll(function (result) {
            if (chrome.runtime.lastError) {
                if (callback) {
                    callback(chrome.runtime.lastError);
                }
                return;
            }

            var index = _highlightDefinitions.getIndex(className, result.highlightDefinitions);
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
};
