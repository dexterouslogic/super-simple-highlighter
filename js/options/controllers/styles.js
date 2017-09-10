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

// 'stylesControllers' module containing a single controller, named 'style'
angular.module('stylesControllers', []).controller('styles', ["$scope", function ($scope) {
  class Controller {
    /**
     * @typedef {Object} Options
     * @prop {boolean} unselectAfterHighlight
     * @prop {boolean} enableHighlightBoxShadow
     * @prop {number} highlightBackgroundAlpha
     * @memberof Controller
     */
   
    /**
     * @typedef {Object} Modal
     * @prop {string} dialogTitle
     * @prop {string} saveButtonTitle
     * @prop {Object} highlightDefinition
     * @prop {Function} onClickSave - callback for click on modal dialog save button
     * @memberof Controller
     */

    /**
     * @typedef {Object} Scope
     * @prop {string} highlightClassName - class name used for every highlight in our DOM. Randomized at init
     * @prop {Object[]} highlightDefinitions - array of ?
     * @prop {Object[]} commands - array of chrome.Command objects
     * @prop {Options} options
     * @prop {Modal} [modal] - object for modal dialog properties
     * @memberof Controller
     */

    /**
     * Creates an instance of Controller.
     * @param {Scope} scope 
     * @param {Document} document - html document 
     * @memberof Controller
     */
    constructor(scope, document) {
      this.scope = scope

      this.scope.highlightClassName = StringUtils.newUUID()
      this.scope.highlightDefinitions = []

      this.styleSheetManager = new StyleSheetManager(document).init()

      // always ignore box shadow property of highlight
      this.disableBoxShadow = true

      // 2 - add listener for changes to storage (sync area only)
      chrome.storage.onChanged.addListener(this.onStorageChanged.bind(this))

      for (const func of [
        this.onClickStyle,
        this.onClickRemoveStyle,
        this.onClickCreateNewStyle,
        this.onClickResetToDefaultStyles,
      ]) {
				this.scope[func.name] = func.bind(this)
      }

      // update storage when scoped options object changes
      this.scope.$watchCollection('options', this.onOptionsCollectionChanged.bind(this))
      this.scope.$watchCollection('highlightDefinitions', this.onHighlightDefinitionsCollectionChanged.bind(this))
    }

    /**
     * Async initializer
     * 
     * @returns {Promise}
     * @memberof Controller
     */
    init() {
      // copy all shortcut command info into scoped object
      return new Promise(resolve => {
        chrome.commands.getAll(commands => resolve(commands))
      }).then(commands => {
        this.scope.commands = commands

        // get existing storage values for options
        return new ChromeStorage().get([
            ChromeStorage.KEYS.UNSELECT_AFTER_HIGHLIGHT,
            ChromeStorage.KEYS.ENABLE_HIGHLIGHT_BOX_SHADOW,
            ChromeStorage.KEYS.HIGHLIGHT_BACKGROUND_ALPHA,
        ])
      }).then(items => {
        this.scope.options = items

        // initial update is via a fake call to onStorageChange()
        return new ChromeHighlightStorage().getAll()
      }).then(items => {
        // define a change that resets styles to stored values
        return this.onStorageChanged({
          [ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE]: { 
              newValue: items[ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE] 
          },
          [ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]: { 
              newValue: items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS] 
          }, 
        }, 'sync')
      })
    }

    // storage

    /**
     * Fired when one or more items change.
     * 
     * @param {Object} changes - Object mapping each key that changed to its corresponding storage.StorageChange for that item.
     * @param {string} areaName 
     * @returns {Promise} (unhandled)
     * @memberof Controller
     */
    onStorageChanged(changes, areaName) {
      if (areaName !== 'sync') {
          return Promise.resolve()
      }

      // if the opacity storage value changed, we can reflect that by adding a change for HIGHLIGHT_DEFINITIONS
      // where there is no oldValue (nothing to clear), and the undefined newValue means 'read storage values'
      if (changes[ChromeStorage.KEYS.HIGHLIGHT_BACKGROUND_ALPHA]) {
        const key = ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS
        
        if (!changes[key]) {
          changes[key] = {}
        }
      }

      // 1 - update common (shared) style
      let key = ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE

      if (changes[key]) {
        const change = changes[key]
        const highlightClassName = this.scope.highlightClassName

        if (change.oldValue) {
          this.styleSheetManager.deleteRule(highlightClassName)
        }

        if (change.newValue) {
          this.styleSheetManager.setRule({
            className: highlightClassName,
            style: change.newValue,
            disableBoxShadow: this.disableBoxShadow,
          })
        }
      }

      // 2 - update specific definitions
      key = ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS

      if (!changes[key]) {
        return Promise.resolve()
      }

      const change = changes[key]

      if (change.oldValue) {
          for (const {className} of change.oldValue) {
            this.styleSheetManager.deleteRule(className)
          }
      }

      // name of property of `stylesController` containing definitions object
      // const name = 'definitions'

      // if we remove all teh styles (with reset button), newValue will be undefined.
      // so in that case, get the default styles
      return (changes.newValue ?
        Promise.resolve(change.newValue) :
        new ChromeHighlightStorage().getAll().then(items => items[key])
      ).then(highlightDefinitions => {
        this.scope.highlightDefinitions = highlightDefinitions
        this.scope.$apply()
      })
    }// end onStorageChanged()

    // watches

    /**
     * scope.options collection changed
     * 
     * @param {Options} newOptions 
     * @param {Options} oldOptions 
     * @memberof Controller
     */
    onOptionsCollectionChanged(newOptions, oldOptions) {
      if (newOptions == oldOptions) {
          return
      }
      
      // debounce storage setting because there is a quota, and slider has no tracking options
      this.debounceTimerID = (timerId => {
        if (timerId) {
          clearTimeout(timerId)
        }

        return setTimeout(() => {
          // unhandled promise
          return new ChromeStorage().set(newOptions).then(() => {
            this.debounceTimerID = 0
          })
        }, Controller.DEBOUNCE_TIMEOUT)
      })(this.debounceTimerID)
    }

    /**
     * this.scope.highlightDefinitions changed
     * 
     * @param {Object[]} newHighlightDefinitions 
     * @memberof Controller
     */
    onHighlightDefinitionsCollectionChanged(newHighlightDefinitions) {
      for (const hd of newHighlightDefinitions) {
          hd.disableBoxShadow = this.disableBoxShadow

          this.styleSheetManager.setRule(hd)
      }
    }

    // click handlers

     /**
     * Clicked an existing definition
     * 
     * @param {number} index index of definition in highDefinitions array
     * @memberof Controller
     */
    onClickStyle(index) {
      this.scope.modal = {
        dialogTitle: chrome.i18n.getMessage("edit_style"),
        saveButtonTitle: chrome.i18n.getMessage("update"),
        highlightDefinition: angular.copy(this.scope.highlightDefinitions[index]),  // deep copy
        onClickSave: () => {
          // close dialog
          $(Controller.SELECTOR.MODAL).modal('hide')

          // store update
          return this.scope.modal.highlightDefinition ? 
            new ChromeHighlightStorage().set(this.scope.modal.highlightDefinition) :
            Promise.resolve()
        }
      }

      // show
      $(Controller.SELECTOR.MODAL).modal()
    }

    /**
     * Clicked 'remove style' button (x)
     * 
     * @param {Object} highlightDefinition 
     * @returns {Promise}
     * @memberof Controller
     */
    onClickRemoveStyle(highlightDefinition) {
      // don't propagate to enclosing div
      event.stopPropagation()

      if (!window.confirm(chrome.i18n.getMessage("confirm_remove_style"))) {
        return Promise.resolve()
      }

      // delete from storage. model should update automatically
      return new ChromeHighlightStorage().remove(highlightDefinition.className)
    }

    /**
     * Clicked 'create new style' button
     * 
     * @memberof Controller
     */
    onClickCreateNewStyle() {
      this.scope.modal = {
        dialogTitle: chrome.i18n.getMessage("create_new_style"),
        saveButtonTitle: chrome.i18n.getMessage("create"),
        highlightDefinition: HighlightDefinitionFactory.createObject(),
        onClickSave: () => {
          // close dialog
          $(Controller.SELECTOR.MODAL).modal('hide')

          // store update
          return this.scope.modal.highlightDefinition ? 
            new ChromeHighlightStorage().set(this.scope.modal.highlightDefinition) :
            Promise.resolve()
        }
      }

      $(Controller.SELECTOR.MODAL).modal()
    }

    /**
     * Clicked 'reset to default styles' button
     * 
     * @memberof Controller
     */
    onClickResetToDefaultStyles () {
      if (!window.confirm(chrome.i18n.getMessage("confirm_reset_default_styles"))) {
        return Promise.resolve()
      }

      return new ChromeHighlightStorage().removeAll()
    }
    
  } // end class

  // static properties

  Controller.DEBOUNCE_TIMEOUT = 1000

  Controller.SELECTOR = {
    // selector for jQuery modal div
    MODAL: '#myModal'
  }

  // unhandled promise
  new Controller($scope, document).init()
}])