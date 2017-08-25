/**
 * Chrome storage access helper
 * 
 * @class ChromeStorage
 */
class ChromeStorage {
	/**
   * Creates an instance of Storage.
   * @param {string} [store='sync'] - store to reference. Must be 'sync' or 'local' 
   * @memberof Storage
   */
  constructor(store='sync') {
		this.storage = chrome.storage[store]
	}

  /**
   * Get value(s) for storage key(s)
   * 
   * @param {string|[string]|Object} keys - keys to get. If object, the name is the key name, and value is its default
   * @returns {Promise<*>} promise resolving to an object (if single key requested), else object
   * @memberof Storage
   */
  get(keys) {
    const keysType = typeof keys

    if (keysType === 'string') {
      keys = [keys]
    }

    // convert keys to array of objects
    if (Array.isArray(keys)) {
      // convert to an object where each key names the storage property
      const o = {}

      // add default values to keys with undefined values (if keys wasn't an object)
      for (const k of keys) {
        Object.defineProperty(o, k, { value: ChromeStorage.DEFAULTS[k] })
      }

      keys = o
    }

    return new Promise((resolve, reject) => {
			this.storage.get(keys, items => {
				if (chrome.runtime.lastError) {
					reject(chrome.runtime.lastError)
					return
				}

        // if a single key was requested, resolve to a single value
        resolve (keysType === 'string' ? 
          items[Object.getOwnPropertyNames(keys)[0]] : 
          items
        )
			})
		})
  }
  
  /**
   * Set value(s) for storage key(s)
   * 
   * @param {string|Object[]} value - value for key param, or Object specifying each key/value to set
   * @param {string} [key] - optional key implying value param is its value, and only one value is to be set 
   * @returns {Promise} promise that rejects on runtime error
   * @memberof Storage
   */
  set(value, key) {
    if (typeof key === 'string') {
      value = Object.defineProperty({}, key, {value: value})
    }

    return new Promise((resolve, reject) => {
      this.storage.set(value, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
        }

        resolve()
      })
    })
  }
}

// Static properties

ChromeStorage.KEYS = {
	ENABLE_HIGHLIGHT_BOX_SHADOW: 'enableHighlightBoxShadow',
	HIGHLIGHT_BACKGROUND_ALPHA: 'highlightBackgroundAlpha',
	FILE_ACCESS_REQUIRED_WARNING_DISMISSED: 'fileAccessRequiredWarningDismissed',
	UNSELECT_AFTER_HIGHLIGHT: 'unselectAfterHighlight',
	POPUP_HIGHLIGHT_TEXT_MAX_LENGTH: 'popupHighlightTextMaxLength',

	HIGHLIGHT: {
		SORT_BY: 'highlight_sort_by',
		INVERT_SORT: 'highlight_invert_sort',
	},

	OPTIONS: {
		BOOKMARKS_GROUP_BY: 'options_bookmarks_group_by',
		BOOKMARKS_ASCENDING_ORDER: 'options_bookmarks_ascending_order',
		BOOKMARKS_SHOW_PAGE_TEXT: 'options_bookmarks_show_page_text',
	},
}

ChromeStorage.DEFAULTS = {
	[ChromeStorage.KEYS.ENABLE_HIGHLIGHT_BOX_SHADOW]: true,
	[ChromeStorage.KEYS.HIGHLIGHT_BACKGROUND_ALPHA]: 0.8,
	[ChromeStorage.KEYS.FILE_ACCESS_REQUIRED_WARNING_DISMISSED]: false,
	[ChromeStorage.KEYS.UNSELECT_AFTER_HIGHLIGHT]: false,
	[ChromeStorage.KEYS.POPUP_HIGHLIGHT_TEXT_MAX_LENGTH]: 512,

	[ChromeStorage.KEYS.HIGHLIGHT.SORT_BY]: 'time',
	[ChromeStorage.KEYS.HIGHLIGHT.INVERT_SORT]: false,

	[ChromeStorage.KEYS.OPTIONS.BOOKMARKS_GROUP_BY]: 'title',
	[ChromeStorage.KEYS.OPTIONS.BOOKMARKS_ASCENDING_ORDER]: true,
	[ChromeStorage.KEYS.OPTIONS.BOOKMARKS_SHOW_PAGE_TEXT]: false,
}