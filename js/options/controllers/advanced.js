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
angular.module('advancedControllers', []).controller('advanced', ["$scope", function ($scope) {
  class Controller {
    /**
     * Creates an instance of Controller.
     * @param {Object} scope - controller $scope
     * @memberof Controller
     */
    constructor(scope) {
      this.scope = scope

      for (const func of [
        this.onClickExport,
        this.onFilesChange
      ]) {
				this.scope[func.name] = func.bind(this)
      }
      
      // TODO: move this to html
			document.querySelector('#files').addEventListener('change', this.onFilesChange)
    }

    /**
     * @typedef {Object} Header
     * @prop {string} magic
     * @prop {number} version
     */

    /**
     * A file was selected for import
     * 
     * @memberof Controller
     */
    onFilesChange() {
      const file = event.target.files[0]
      const reader = new FileReader()

      // Closure to capture the file information.
      reader.onload = () => {
          // newline delimited json
          const ldjson = event.target.result
          const jsonObjects = ldjson.split('\n')
          
          // newline delimited json
          return new Promise((resolve, reject) => {
              // validate header

              /** @type {Header} */
              const header = JSON.parse(jsonObjects.shift())
  
              if (header.magic !== Controller.MAGIC || header.version !== 1) {
                  reject({
                      status: 403,
                      message: "Invalid File"
                  });
              } else {
                  resolve()
              }
          }).then(() => {
          //     return new Promise(resolve => { chrome.runtime.getBackgroundPage(p => resolve(p)) })
          // }).then(({factory}) => {
              // the first line-delimited json object is the storage highlights object. Don't use them until the database loads successfully
              // remainder is the database
              return new DB().loadDB(jsonObjects.join('\n'))
          }).then(() => {
              // set associated styles. null items are removed (implying default should be used)
              const items = JSON.parse(jsonObjects.shift())
              return new ChromeHighlightStorage().setAll(items)
          }).then(() => {
              location.reload();
          }).catch(function (err) {
              // error loading or replicating tmp db to main db
              alert(`Status: ${err.status}\nMessage: ${err.message}`)
          })
      }

      // Read in the image file as a data URL.
      reader.readAsText(file, "utf-8");
      // reader.readAsDataURL(file);
    }

    onClickExport() {
      /** @type {Header} */
      const header = {
        magic: Controller.MAGIC,
        version: 1,
      }

      // start with header
      let ldjson = JSON.stringify(header)

      return new ChromeHighlightStorage().getAll({defaults: false}).then(items => {
          // the first item is always the highlights object
          ldjson += `\n${JSON.stringify(items, null, '\t')}\n`

          // the remainder is the dumped database
          const stream = new window.memorystream();

          stream.on('data', chunk => {
              ldjson += chunk.toString();
          })

          return new DB().dumpDB(stream)
      }).then(() => {
          // create a temporary anchor to navigate to data uri
          const elm = document.createElement("a")

          elm.download = chrome.i18n.getMessage("advanced_database_export_file_name")
          elm.href = "data:text;base64," + Base64Utils.utf8_to_b64(ldjson, window)

          // a.href = "data:text/plain;charset=utf-8;," + encodeURIComponent(dumpedString);
          // a.href = "data:text;base64," + utf8_to_b64(dumpedString);
          // a.href = "data:text;base64," + utf8_to_b64(dumpedString);
          //window.btoa(dumpedString);

          // create & dispatch mouse event to hidden anchor
          const event = document.createEvent("MouseEvent")

          event.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
          elm.dispatchEvent(event)
      })
    }
  } // end class

  // static properties

  Controller.MAGIC = 'Super Simple Highlighter Exported Database'

  // initialize
  new Controller($scope)
}])