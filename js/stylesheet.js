/*global _storage*/

var _stylesheet = {
    /**
     * Apply rules of a single highlight style
     */
    setHighlightStyle: function (definition) {
        "use strict";
        var $ss = $.stylesheet('.' + definition.className);

        // The stored colours never specify alpha, to be able to be used in the HTML input element.
        // So we parse the rgba? colour, and add a constant alpha

        // definition.style["background-color"] must be a string in format "#RRGGBB"
        // copy because we modify the object
        var style = jQuery.extend(true, {}, definition.style);

        if (definition.inherit_style_color) {
            style.color = "inherit";
        }

        var re = new RegExp("^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})", "ig");
        var match = re.exec(style['background-color']);

        if (match && match.length >= 4) {
            _storage.getHighlightBackgroundAlpha(function(alpha){
                if (alpha === undefined) { return; }

                style["background-color"] = "rgba(" +
                    parseInt(match[1], 16) + ", " +
                    parseInt(match[2], 16) + ", " +
                    parseInt(match[3], 16) + ", " +
                    alpha +
                    ")";

                $ss.css(null).css(style);
            });
        } else {
            console.log("highlight style background colour not in #RRGGBB format");
        }

//
//
//
//
//        $ss.css(null).css(definition.style);
//
//        // The stored colours never specify alpha, to be able to be used in the HTML input element.
//        // So we parse the rgba? colour, and add a constant alpha
//        var re = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/;
//
//        var match = re.exec($ss.css('background-color'));
//        if (match && match.length >= 4) {
//            chrome.storage.sync.get({
//                highlightBackgroundAlpha: 0.8
//            }, function (items) {
//                if (chrome.runtime.lastError) {
//                    return;
//                }
//
//                var rgba = "rgba(" +
//                    match[1] + ", " +
//                    match[2] + ", " +
//                    match[3] + ", " +
//                    items.highlightBackgroundAlpha +
//                    ")";
//
//                $ss.css('background-color', rgba);
//            });
//        }
    },

    /**
     * Remove rules for a single style
     * @param className
     */
    clearHighlightStyle: function (className) {
        "use strict";
        $.stylesheet('.' + className).css(null);
    }
};