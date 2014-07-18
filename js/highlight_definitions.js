var _highlightDefinitions = {
    /**
     * Get an array of objects describing highlight styles
     * @param {object} [callback] function (object), containing highlightDefinitions array, defaultHighlightStyle object
     */
    getAll: function (callback) {
        "use strict";
        chrome.storage.sync.get({
            "highlightDefinitions": [
                // remember to inherit things that the default highlight style defines
                {
                    className: "something1",
                    title: "Red",
                    style: {
                        'color': '#ff00ff',
                        'background-color': '#ff0000'
                    }
                },
                {
                    className: "something2",
                    title: "Green",
                    style: {
                        'color': '#ff00ff',
                        'background-color': '#00ff00'
                    }
                }
            ],

            'sharedHighlightStyle': {
                "border-radius": "6px",
                "box-shadow": "rgba(0,0,0, 0.42) 3px 3px 4px",
                "padding": "0.2em",
                "transition-property": "color, background-color, box-shadow",
                "transition-duration": "0.2s, 0.2s, 0.2s",
                "transition-timing-function": "linear, linear, linear",

                "background-color": "grey",
                "font-size": "x-large"
            }
        }, callback);
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
