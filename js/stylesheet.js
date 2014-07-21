var _stylesheet = {
    /**
     * Apply rules of a single highlight style
     */
    setHighlightStyle: function (definition) {
        "use strict";
        var $ss = $.stylesheet('.' + definition.className);

        $ss.css(null).css(definition.style);

        // The stored colours never specify alpha, to be able to be used in the HTML input element.
        // So we parse the rgba? colour, and add a constant alpha
        var re = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/;

        var match = re.exec($ss.css('background-color'));
        if (match && match.length >= 4) {
            $ss.css('background-color', "rgba(" +
                match[1] + ", " +
                match[2] + ", " +
                match[3] + ", " +
                "0.7");
        }
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