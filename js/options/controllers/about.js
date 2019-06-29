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

// 'aboutControllers' module containing a single controller, named 'about'
angular.module('aboutControllers', []).controller('about', ["$scope", function ($scope) {
  class Controller {
    /**
     * @typedef {Object} Scope
     * @prop {Object} manifest
     * @prop {Object[]} libraries
     * @prop {Object[]} licenses
     */

    /**
		 * Creates an instance of Controller.
		 * @param {Scope} scope - controller $scope
		 * @memberof Controller
		 */
    constructor(scope) {
      this.scope = scope

      this.scope.manifest = chrome.runtime.getManifest()
      this.scope.libraries = Controller.LIBRARIES
      this.scope.licenses = Controller.LICENSES

      for (const func of [this.onClickRestoreAllWarnings]) {
				this.scope[func.name] = func.bind(this)
			}
    }

    /**
     * Clicked 'restore all warning' button
     * 
     * @returns {Promise}
     */
    onClickRestoreAllWarnings() {
      return new ChromeStorage().set(false, ChromeStorage.KEYS.FILE_ACCESS_REQUIRED_WARNING_DISMISSED)
    }
  } // end class

  // static properties

  Controller.LIBRARIES = [
    {
      href: "https://angularjs.org/",
      text: "AngularJS"
    },
    {
      href: "http://danielcrisp.github.io/angular-rangeslider/",
      text: "Angular-Rangeslider"
    },
    {
      href: "http://getbootstrap.com/",
      text: "Bootstrap"
    },
    {
      href: "http://glyphicons.com/",
      text: "Glyph Icons"
    },
    {
      href: "http://jquery.com/",
      text: "jQuery"
    },
    {
      href: "http://pouchdb.com/",
      text: "PouchDB"
    }
  ]

  Controller.LICENSES = [
    {
      work: {
        href: "http://www.iconarchive.com/show/soft-scraps-icons-by-hopstarter/Highlighter-Blue-icon.html",
        text: "Highlighter Blue Icon"
      },
      author: {
        href: "http://hopstarter.deviantart.com",
        text: "Hopstarter"

      },
      license: {
        href: "http://creativecommons.org/licenses/by-nc-nd/3.0/",
        text: "CC BY-NC-ND 3.0"
      }
    },

    {
      work: {
        href: "https://www.iconfinder.com/icons/32453/alert_attention_danger_error_exclamation_hanger_message_problem_warning_icon",
        text: "Exclamation"
      },
      author: {
        href: "http://www.aha-soft.com/",
        text: "Aha-soft"

      },
      license: {
        href: "http://creativecommons.org/licenses/by/3.0/",
        text: "CC BY 3.0"
      }
    },

    {
      work: {
        href: "https://www.flickr.com/photos/colemama/5264395373/",
        text: "Highlighter On Page (Promotional Image)"
      },
      author: {
        href: "https://www.flickr.com/photos/colemama/",
        text: "Marie Coleman"

      },
      license: {
        href: "https://creativecommons.org/licenses/by-nc-sa/2.0/",
        text: "CC BY-NC-SA 2.0"
      }
    },

    {
      work: {
        href: "",
        text: "Super Simple Highlighter"
      },
      author: {
        href: "http://dexterouslogic.com",
        text: "Dexterous Logic"
      },
      license: {
        href: "http://www.gnu.org/licenses/gpl-3.0.txt",
        text: "GPL v3.0"
      }
    }
  ]

	new Controller($scope)
}])