"use strict";

var _stylesheet = {
    /**
     * Apply rules of a single highlight style
     */
    setHighlightStyle: function (h) {
        var $ss = $.stylesheet('.' + h.className);
//        if (reset) {
//            $ss.css(null);
//
//            // remove version in the DOM also
////            $("#" + h.className).remove();
//        }
//

        $ss.css(null).css(h.style);

//        // also modify DOM to include a style element which can be saved
//        var rules = $ss.rules();
//
//        // does our new element have any rules?
//        if (rules && rules.length > 0) {
//            // find existing element if possible
//            var $elm = $("#" + h.className);
//            if ($elm.length === 0) {
//                // create new
//                $('head').append('<style id="' + h.className + '"></style>');
//                $elm = $("#" + h.className);
//            }
//
//            // copy rules into element
//            $elm.text(rules[0].cssText);
//        }
    },

    /**
     * Remove rules for a single style
     * @param className
     */
    clearHighlightStyle: function (className) {
        $.stylesheet('.' + className).css(null);
    }

//    clearHighlightStyles: function (highlightDefinitions) {
//        "use strict";
//        highlightDefinitions.forEach(function (h) {
//            $.stylesheet('.' + h.className).css(null);
//        });
//    },


//    /**
//     * Apply style rules defined in a highlightstyles object
//     * @param highlightDefinitions see highlight_definitions.js
//     * @param reset if true, clear existing style before applying
//     */
//    setHighlightStyles: function (highlightDefinitions, reset) {
//        "use strict";
//        highlightDefinitions.forEach(function (h) {
//            _stylesheet.setHighlightStyle(h, reset);
//        });
//    },
//
//    /**
//     * Remove all the styles defined by a highlightDefinitions object.
//     * Usually the result on onStorageChanged() event for storage
//     * @param highlightDefinitions
//     */
//    removeHighlightStyles: function (highlightDefinitions) {
//        "use strict";
//        highlightDefinitions.forEach(function (h) {
//            $.stylesheet('.' + h.className).css(null);
//        });
//    }
};