/**
 * Factory for objects defining a highlight (style, title etc)
 * 
 * @class HighlightDefinitionFactory
 */
class HighlightDefinitionFactory {
  /**
   * Create a new highlight definition object
   * 
   * @static
   * @param {string} title - highlight title
   * @param {Object} [options] {
   *     title,
   *     className = StringUtils.newUUID({ beginWithLetter: true }),
   *     backgroundColor = HighlightDefinitionFactory.DEFAULT_VALUES[HighlightDefinitionFactory.KEYS.INHERIT_STYLE]['background-color'],
   *     color = HighlightDefinitionFactory.DEFAULT_VALUES[HighlightDefinitionFactory.KEYS.INHERIT_STYLE]['color']
   *   } 
   * @returns 
   * @memberof HighlightDefinitionFactory
   */
  static createObject(title, {
    className = StringUtils.newUUID({ beginWithLetter: true }),
    backgroundColor = HighlightDefinitionFactory.DEFAULT_VALUES[HighlightDefinitionFactory.KEYS.INHERIT_STYLE]['background-color'],
    color = HighlightDefinitionFactory.DEFAULT_VALUES[HighlightDefinitionFactory.KEYS.INHERIT_STYLE]['color']
  } = {}) {
    return {
      [HighlightDefinitionFactory.KEYS.TITLE]: title,
      [HighlightDefinitionFactory.KEYS.CLASS_NAME]: className,
      [HighlightDefinitionFactory.KEYS.INHERIT_STYLE_COLOR]:
        HighlightDefinitionFactory.DEFAULT_VALUES[HighlightDefinitionFactory.KEYS.INHERIT_STYLE_COLOR],
      [HighlightDefinitionFactory.KEYS.STYLE]: {
        'background-color': backgroundColor,
        'color': color,
      }
    }
  }
}

// static values

HighlightDefinitionFactory.KEYS = {
  TITLE: 'title',
  CLASS_NAME: 'className',
  INHERIT_STYLE_COLOR: 'inherit_style_color',
  STYLE: 'style',

  DISABLE_BOX_SHADOW: 'disableBoxShadow',
}

HighlightDefinitionFactory.DEFAULT_VALUES = {
  [HighlightDefinitionFactory.KEYS.INHERIT_STYLE_COLOR]: false,
  [HighlightDefinitionFactory.KEYS.STYLE]: {
    'background-color': '#ff8080',
    'color': '#000000'
  }
}

//

/**
 * sync-Storage for highlights in chrome store
 * 
 * @class ChromeHighlightStorage
 * @extends {ChromeStorage}
 */
class ChromeHighlightStorage extends ChromeStorage {
  constructor() {
    super('sync')
  }

  /**
   * Lazy getter for array of default highlight definitions
   * 
   * @readonly
   * @memberof HighlightStorage
   */
  get defaultHighlightDefinitions() {
    if (!Array.isArray(this._defaultHighlightDefintions)) {
      this._defaultHighlightDefintions = [
        ['color_title_red', 'default-red-aa94e3d5-ab2f-4205-b74e-18ce31c7c0ce', '#ff8080', '#000000'],
        ['color_title_orange', 'default-orange-da01945e-1964-4d27-8a6c-3331e1fe7f14', '#ffd2AA', '#000000'],
        ['color_title_yellow', 'default-yellow-aaddcf5c-0e41-4f83-8a64-58c91f7c6250', '#ffffAA', '#000000'],
        ['color_title_green', 'default-green-c4d41e0a-e40f-4c3f-91ad-2d66481614c2', '#AAffAA', '#000000'],
        ['color_title_cyan', 'default-cyan-f88e8827-e652-4d79-a9d9-f6c8b8ec9e2b', '#AAffff', '#000000'],
        ['color_title_purple', 'default-purple-c472dcdb-f2b8-41ab-bb1e-2fb293df172a', '#FFAAFF', '#000000'],
        ['color_title_grey', 'default-grey-da7cb902-89c6-46fe-b0e7-d3b35aaf237a', '#777777', '#FFFFFF'],
      ].map(([titleMessageId, className, backgroundColor, color]) => {
        return HighlightDefinitionFactory.createObject(
          chrome.i18n.getMessage(titleMessageId), {
            className: className,
            backgroundColor: backgroundColor,
            color: color
          }
        )
      })
    }

    return this._defaultHighlightDefintions
  }

  /**
   * Get definitions for all highlights, and the shared highlight style CSS definition
   * 
   * @param {Object} [options={defaults=true}] - options
   * @returns {Promise<Object>} object with HIGHLIGHT_DEFINITIONS & SHARED_HIGHLIGHT_STYLE defined (unless undefined && !options.defaults)
   * @memberof HighlightStorage
   */
  getAll({ defaults = true } = {}) {
    return this.get({
      [ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]: (defaults && this.defaultHighlightDefinitions) || null,
      [ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE]: (defaults && ChromeHighlightStorage.SHARED_HIGHLIGHT_STYLE) || null
    })
  }

  /**
   * Set the entire array of highlight definitions AND/OR the shared highlight style CSS object. Unset keys are removed.
   * 
   * @param {Object} items - object optionally defining HIGHLIGHT_DEFINITIONS array AND/OR SHARED_HIGHLIGHT_STYLE object
   * @returns {Promise} - resolves if storage updated OK
   * @memberof HighlightStorage
   */
  setAll(items) {
    // keys to process
    const keys = [
      ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS,
      ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE,
    ]

    // keys to be removed because they're not definied in items object
    const removeKeys = new Set(keys.filter(k => !items[k]))
    const setObject = {}

    // add property for each object defined in items
    for (const k of keys.filter(k => items[k])) {
      setObject[k] = items[k]
    }

    return Promise.all([
      super.set(setObject),
      super.remove(Array.from(removeKeys))
    ])
  }

  /**
   * Set/Update a highlight definitions
   * 
   * @param {Object|Object[]} definitions - single definition or array of definitions to process
   * @returns {Promise} - resolves if storage updated OK
   * @memberof HighlightStorage
   */
  set(definitions) {
    // we update the array of definitions, so we get it first
    return this.getAll().then(({ highlightDefinitions }) => {
      // should we add or update? Get index of definition
      if (!Array.isArray(definitions)) {
        definitions = [definitions]
      }

      for (const d of definitions) {
        const index = highlightDefinitions.findIndex(x => x.className === d.className)

        highlightDefinitions.splice(
          index === -1 ? highlightDefinitions.length : index,
          index === -1 ? 0 : 1,
          d
        )
      }

      // replace entire array
      return super.set(highlightDefinitions, ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS)
    })
  }

  /**
   * Remove a highlight definition from the store
   * 
   * @param {string} definitionClassName - highlight defined by its class name
   * @returns {Promise} - resolves if storage updated
   * @memberof HighlightStorage
   */
  remove(definitionClassName) {
    return this.getAll().then(({ highlightDefinitions }) => {
      // find current definition with this class name
      const index = highlightDefinitions.findIndex(d => d.className === definitionClassName)
      if (index === -1) {
        return
      }

      // remove
      highlightDefinitions.splice(index, 1)
      // update
      return super.set(highlightDefinitions, ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS)
    })
  }

  /**
   * Remove all hihglight definitions
   * 
   * @returns {Promise} - resolves if storage updated
   * @memberof HighlightStorage
   */
  removeAll() {
    return super.remove(ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS)
  }
}

// Static properties

Object.assign(ChromeHighlightStorage.KEYS, {
  HIGHLIGHT_DEFINITIONS: 'highlightDefinitions',
  SHARED_HIGHLIGHT_STYLE: 'sharedHighlightStyle',
})

ChromeHighlightStorage.SHARED_HIGHLIGHT_STYLE = {
  'position': "relative",
  'border-radius': "0.2em",
  //"padding": "0.2em",
  'transition-property': 'color, background-color',
  'transition-duration': '0.3s',
  'transition-timing-function': 'ease-in-out',

  // color & font-style when highlight is defined by a class which no longer exists
  // each specific style must override these, or inherit default
  'color': '#AAAAAA',
  'background-color': '#EEEEEE',
  //                        "box-shadow": "0 0 8px #D3D3D3",
  'font': 'inherit',

  // "display": "inline-block",
  'animation': 'fontbulger 0.2s ease-in-out 0s 2 alternate'
}