
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
