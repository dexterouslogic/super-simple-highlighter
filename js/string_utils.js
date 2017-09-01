
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

class StringUtils {
    /**
     * Create a UUID
     * If string is to be used as an element ID it must begin with [::alpha::] (not number)
     * 
     * @static
     * @param {Object} [options={beginWithLetter=false}] - options
     * @returns {string} new UUID
     * @memberof StringUtils
     */
    static newUUID({ beginWithLetter=true } = {}) {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c, index) => {
            let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);

            // make sure first letter is a-f
            if (beginWithLetter && index === 0) {
                v = (v % 6) + 0xa;// Math.max(v, 0xa);
            }

            return v.toString(16);
        });
    }
}