/*global _stringUtils*/

var _highlightDefinitions = {
    /**
     * Lazy getter for default storage values
     * @private
     * @returns {object}
     */
    _getDefaults: function () {
        "use strict";
        if (_highlightDefinitions._defaults === undefined) {
            _highlightDefinitions._defaults = {
                "highlightDefinitions": [
                    _highlightDefinitions.create("Red", "default-red-aa94e3d5-ab2f-4205-b74e-18ce31c7c0ce",
                        "#ff8080", "#000000"),
                    _highlightDefinitions.create("Orange", "default-orange-da01945e-1964-4d27-8a6c-3331e1fe7f14",
                        "#ffd2AA", "#000000"),
                    _highlightDefinitions.create("Yellow", "default-yellow-aaddcf5c-0e41-4f83-8a64-58c91f7c6250",
                        "#ffffAA", "#000000"),
                    _highlightDefinitions.create("Green", "default-green-c4d41e0a-e40f-4c3f-91ad-2d66481614c2",
                        "#AAffAA", "#000000"),
                    _highlightDefinitions.create("Cyan", "default-cyan-f88e8827-e652-4d79-a9d9-f6c8b8ec9e2b",
                        "#AAffff", "#000000"),
                    _highlightDefinitions.create("Purple", "default-purple-c472dcdb-f2b8-41ab-bb1e-2fb293df172a",
                        "#FFAAFF", "#000000"),
                    _highlightDefinitions.create("Black", "default-black-da7cb902-89c6-46fe-b0e7-d3b35aaf237a",
                        "#000000", "#FFFFFF"),


//                    _highlightDefinitions.create("Red", "aa94e3d5-ab2f-4205-b74e-18ce31c7c0ce-default-red",
//                        "#FF0000", "#000000"),
//                    _highlightDefinitions.create("Orange", "da01945e-1964-4d27-8a6c-3331e1fe7f14-default-orange",
//                        "#FFA500", "#000000"),
//                    _highlightDefinitions.create("Yellow", "aaddcf5c-0e41-4f83-8a64-58c91f7c6250-default-yellow",
//                        "#FFFF60", "#000000"),
//                    _highlightDefinitions.create("Green", "c4d41e0a-e40f-4c3f-91ad-2d66481614c2-default-green",
//                        "#60FF60", "#000000"),
//                    _highlightDefinitions.create("Cyan", "f88e8827-e652-4d79-a9d9-f6c8b8ec9e2b-default-cyan",
//                        "#60FFFF", "#000000"),
//                    _highlightDefinitions.create("Purple", "c472dcdb-f2b8-41ab-bb1e-2fb293df172a-default-purple",
//                        "#FF60FF", "#000000"),
//                    _highlightDefinitions.create("Black", "da7cb902-89c6-46fe-b0e7-d3b35aaf237a-default-black",
//                        "#000000", "#FFFFFF"),

                ],
                    'sharedHighlightStyle': {
                        "border-radius": "0.2em",
//                        "padding": "0.2em",
                        "transition-property": "color, background-color",
                        "transition-duration": "0.1s, 0.1s",
                        "transition-timing-function": "linear, linear",

                        // color & font-style when highlight is defined by a class which no longer exists
                        // each specific style must override these, or inherit default
                        "color": "black",
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
        var definition = {};

        definition.title = (title ? title : "Untitled");

        definition.className = (className ? className : _stringUtils.createUUID({
            beginWithLetter: true
        }));

        definition.style = {
            "background-color": backgroundColor ? backgroundColor : "#ff8080",
            "color": textColor ? textColor : "#00000",

            // must override the shared style
            "font-style": "inherit"
        };

        return definition;
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
        chrome.storage.sync.remove([
            "highlightDefinitions",
        ], function () {
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
    },

    /**
     * Copy (not reference) an existing definition
     * @param oldDefinition
     * @return {object}
     */
    copy: function (oldDefinition) {
        "use strict";
        return {
            className: oldDefinition.className,
            title: oldDefinition.title,
            style: {
                "color": oldDefinition.style.color,
                "background-color": oldDefinition.style["background-color"]
            }
        };
    }
};
