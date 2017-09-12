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

/**
 * Singleton class for chrome.storage callback methods
 * 
 * @class ChromeStorageHandler
 */
class ChromeStorageHandler {
  /**
   * Add static methods of this class as listeners
   * 
   * @static
   * @memberof ChromeStorageHandler
   */
  static addListeners() {
    chrome.storage.onChanged.addListener(ChromeStorageHandler.onChanged)
  }

  /**
   * Fired when one or more items change.
   * 
   * @static
   * @param {Object} changes - Object mapping each key that changed to its corresponding storage.StorageChange for that item.
   * @param {string} areaName - The name of the storage area ("sync", "local" or "managed") the changes are for.
   * @returns {Promise}
   * @memberof ChromeStorageHandler
   */
  static onChanged(changes, areaName) {
    // Content of context menu depends on the highlight styles
    if (areaName !== 'sync' || !changes.highlightDefinitions) {
      return Promise.resolve()
    }

    // recreate menu
    // unhandled promise
    return ChromeContextMenusHandler.createSelectionMenu()
  }
}
