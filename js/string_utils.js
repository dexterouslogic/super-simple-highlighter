var _stringUtils = {
    /**
     * Generates a UUID to use as the document id, and makes sure it doesn't begin with a number (because DOM elements
     * can't use ids that don't begin with a-z)
     * @param {object} [options] optional options object.
     * @return {string} uuid string.
     */
    createUUID: function (options) {
        "use strict";
        if (!options) {
            options = {
                beginWithLetter: false
            };
        }

        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c, index) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);

            // make sure first letter is a-f
            if (options.beginWithLetter && index === 0) {
                v = (v % 6) + 0xa;// Math.max(v, 0xa);
            }

            return v.toString(16);
        });
    }
};
