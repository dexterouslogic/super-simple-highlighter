/*global _storage, _stringUtils*/

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


var _stylesheet = {
	/**
	 * The ID of the style element that we use for our rules
     */
    styleElementId: null,
    
    /** 
     * Get the single style element, creating if required
     */
    getStyleElementId: function () {
       if (_stylesheet.styleElementId == null) {
		   // Create the <style> tag
		   var styleElement = document.createElement("style");
	   
		   styleElement.id = _stringUtils.createUUID({ beginWithLetter: true });
	   
		   // Add the <style> element to the page
		   document.head.appendChild(styleElement);

		   _stylesheet.styleElementId = styleElement.id;
	   }
               
	   return _stylesheet.styleElementId;
    },
    
    /**
     * Get the rules selector for the rules of a specific class. This uses
     * a filtered selector so the style element is the one we can reference
     */
    getRulesSelectorForClassName: function(className) {
		var id = _stylesheet.getStyleElementId()
       
		return "#" + id + " {." + className + "}"
    },
    
    /**
     * get the combined CSSText for every rule of the style sheet
     */
    getCSSTextForStyleElement: function() {
		var id = _stylesheet.getStyleElementId();
		var styleElement = document.getElementById(id);

		var rules = styleElement.sheet.cssRules;
		var cssText = "";

		for (var i=0; i < rules.length; i++) {
			cssText += rules[i].cssText;
		}

		return cssText;
    },    
    
    /**
	 * get *every* rule for *every* class of our style element as text,
	 * and apply to the style element's innerText property. This should
	 * evaluate to the same thing, but allow the element to be saved
	 */
	updateInnerTextForHighlightStyleElement: function() {
		"use strict";
		var id = _stylesheet.getStyleElementId();
		var styleElement = document.getElementById(id);

		if (styleElement) {
			   styleElement.innerText = _stylesheet.getCSSTextForStyleElement();
		}
	},
    


    /**
     * Apply rules of a single highlight style
     */
    setHighlightStyle: function (definition) {
        "use strict";

		// uses filtered selector (on our style element) so we can read all rules later
		var selector = _stylesheet.getRulesSelectorForClassName(definition.className);
		var $ss = $.stylesheet(selector);


        // The stored colours never specify alpha, to be able to be used in the HTML input element.
        // So we parse the rgba? colour, and add a constant alpha

        // definition.style["background-color"] must be a string in format "#RRGGBB"
        // copy because we modify the object
        var style = jQuery.extend(true, {}, definition.style);

        if (definition.inherit_style_color) {
            style.color = "inherit";
        }

        // account for styles defined before box-shadow was defined
        var backgroundColor = style['background-color'];
		
		if (!definition.disableBoxShadow) {
			style["box-shadow"] = "0 0 8px " + backgroundColor;
		}
			
        var re = new RegExp("^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})", "ig");
        var match = re.exec(backgroundColor);

        if (match && match.length >= 4) {
            return _storage.getHighlightBackgroundAlpha_Promise().then(function(alpha){
                style["background-color"] = "rgba(" +
                    parseInt(match[1], 16) + ", " +
                    parseInt(match[2], 16) + ", " +
                    parseInt(match[3], 16) + ", " +
                    (alpha || 1.0) +
				")";

                $ss.css(null).css(style);
            });
        } else {
            console.log("highlight style background colour not in #RRGGBB format");
            return Promise.reject();
        }
    },

    /**
     * Remove rules for a single style
     * @param className
     */
    clearHighlightStyle: function (className) {
		var selector = _stylesheet.getRulesSelectorForClassName(className);
		var $ss = $.stylesheet(selector);

		// reset
		$ss.css(null);
	},
};