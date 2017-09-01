/*global angular, _stylesheet, _stringUtils, _i18n, _changelog, _libraries, _licenses*/
'use strict'

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

// disable console log
// console.log = function () { }
// console.assert = function () { }

/**
 * Controllers module
 * @type {ng.IModule}
 */
var optionsControllers = angular.module('optionsControllers', []);

// TODO: rewrite, this is too linked with storage stuff

// array this is something to do with minification
optionsControllers.controller('StylesController', ["$scope", "$timeout", function ($scope, $timeout) {
    // modal dialog div
    const $modal = $('#myModal')//document.getElementById('myModal')

    // always ignore shadow on options page
    const DISABLE_BOX_SHADOW = true
            
    /** 
     * Object to contain all other objects in the scope of this controller
     * @typedef {Object} StylesControllerScope
     * @prop {string} highlightClassName - class name used by each list item definining a highlight (only on options page)
     * @prop {Object} command - copy of current chrome commands
     * @prop {Object} options - watched options specific to scope
     * @prop {Object} definitions - watched and bound highlight definitions
     */
   
    /** @type {StylesControllerScope} */
    $scope.stylesController = {
        highlightClassName: StringUtils.newUUID()
    }

    // model
    // $scope.highlightClassName = // "highlight";

    // unhanled promise to initialize controller
    init()

    /**
     * Initializer
     * 
     * @returns {Promise} resolved on successful init
     */
    function init() {
        // 1 - add event listener to document for mouseover on page-text-list-item (highlight texts)
        const pagesElm = document.querySelector('#pages')
        const timeoutName = 'hysteresisTimeoutId'

        pagesElm.addEventListener('mouseenter', function (event) {
            const elm = event.target
            
            if (!(elm.classList && elm.classList.contains('page-text-list-item'))) {
                return
            }

            // remove hysteresis timer
            if (typeof elm[timeoutName] === 'number') {
                clearTimeout(elm[timeoutName])
                delete elm[timeoutName]
            }

            // show close button
            const closeElm = elm.querySelector('.list-item-close')
            closeElm.style.setProperty('opacity', '1')
        }, { capture: true, passive: true })

        // add event listener for leaving highlight text
        pagesElm.addEventListener('mouseleave', function (event) {
            const elm = event.target
            
            if (!(elm.classList && elm.classList.contains('page-text-list-item'))) {
                return
            }

            const closeElm = elm.querySelector('.list-item-close')

            // add a timeout once we leave the element. If we return we cancel the transition out
            elm[timeoutName] = setTimeout(() => {
                // transition out wasn't cancelled
                delete elm[timeoutName]

                closeElm.style.setProperty('opacity', '0')
            }, 500);
        }, { capture: true, passive: true })

        // 2 - add listener for changes to storage (sync area only)
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'sync') {
                return
            }

            // returns an unused promise
            onStorageChanged(changes)
        })

        // copy all shortcut command info into scoped object
        return new Promise(resolve => {
            chrome.commands.getAll(commands => resolve(commands))
        }).then(commands => {
            $scope.stylesController.commands = commands

            // get existing storage values for options
            return new ChromeStorage().get([
                ChromeStorage.KEYS.UNSELECT_AFTER_HIGHLIGHT,
                ChromeStorage.KEYS.ENABLE_HIGHLIGHT_BOX_SHADOW,
                ChromeStorage.KEYS.HIGHLIGHT_BACKGROUND_ALPHA,
            ])
        }).then(items => {
            !function () {
                const TIMEOUT = 1000
                const name = 'options'
                
                // copy to options object in scope
                $scope.stylesController[name] = Object.assign({}, items)
    
                let debounceTimerID = null
    
                // update storage when scoped options object changes
                $scope.$watchCollection(`stylesController.${name}`, (newOptions, oldOptions) => {
                    if (newOptions == oldOptions) {
                        return
                    }
                    
                    // debounce storage setting because there is a quota, and slider has no tracking options
                    if (debounceTimerID) {
                        $timeout.cancel(debounceTimerID)
                    }
                    
                    debounceTimerID = $timeout(() => {
                        // unhandled promise
                        new ChromeStorage().set(newOptions).then(() => debounceTimerID = null)
                    }, TIMEOUT);
    
                })
            }()
        }).then(() => {
            const name = 'definitions'
            $scope.stylesController[name] = {}
            
            // watch for changes to scoped definitions collection
            $scope.$watchCollection(`stylesController.${name}`, (newDefinitions, oldDefinitions) => {
                for (const d of newDefinitions) {
                    d.disableBoxShadow = DISABLE_BOX_SHADOW
                    _stylesheet.setHighlightStyle(d)
                }
            })

            // initial update via onStorageChange()
            return new ChromeHighlightStorage().getAll().then(items => {
                // define a change that resets styles to stored values
                const changes = {
                    [ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE]: { 
                        newValue: items[ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE] 
                    },
                    [ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]: { 
                        newValue: items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS] 
                    }, 
                }

                onStorageChanged(changes)
            })
        })
    }

    /**
     * Handler for click on 'add new style' button
     * 
     */
    $scope.onClickAddNewStyle = function () {
        // default new definition
        $scope.modalTitle = chrome.i18n.getMessage("create_new_style");
        $scope.modalSaveButtonTitle = chrome.i18n.getMessage("create");

        // new definition, to be altered and stored later
        $scope.modalDefinition = HighlightDefinitionFactory.createObject()
            
        // activate the 'edit' model
        $modal.modal();
    }
    
    /**
     * Handler for click on 'reset all styles' button
     * 
     * @returns {Promise} resolved when all highlight definitions removed from storage
     */
    $scope.onClickResetAllStyles = function () {
        if (!window.confirm(chrome.i18n.getMessage("confirm_reset_default_styles"))) {
            return Promise.resolve()
        }

        return new ChromeHighlightStorage().removeAll()
    }

    /**
     * Handler for click on 'save' button of new highlight definition dialog
     * 
     * @returns {Promise} resolved when definition is stored, and $scope.modalDefinition is deleted
     */
    $scope.onClickModalSave = function () {
        $modal.modal('hide');

        // set contents of selectedDefintion into storage
        if (!$scope.modalDefinition) {
            return Promise.reject(new Error())
        }

        // storage object and delete property value
        return new ChromeHighlightStorage().set($scope.modalDefinition)
            .then(() => delete $scope.modalDefinition)
    }

    /**
     * Clicked an existing definition
     * @param {number} index index of definition in local array
     */
    $scope.onClickEditDefinition = function (index) {
        $scope.modalTitle = chrome.i18n.getMessage("edit_style");
        $scope.modalSaveButtonTitle = chrome.i18n.getMessage("update");

        // deep copy
        $scope.modalDefinition = angular.copy($scope.stylesController.definitions[index]);//   _highlightDefinitions.copy($scope.definitions[index]);

        // activate the 'edit' model
        $modal.modal();
    }

    /**
     * Clicked the per-definition 'delete' button
     * @param {string} definitionClassName class name for definition in storage
     * @returns {Promise} resolves if storage updated or cancelled
     */
    $scope.onClickRemoveDefinition = function (definitionClassName) {
        event.preventDefault()
        event.stopPropagation()

        if (!window.confirm(chrome.i18n.getMessage("confirm_remove_style"))) {
            return Promise.resolve()
        }

        // delete from storage. model should update automatically
        return new ChromeHighlightStorage().remove(definitionClassName)
    }

    /**
     * Handler for changes to sync storage
     * 
     * @param {Object} changes Object mapping each key that changed to its corresponding storage.StorageChange for that item.
     * @returns {Promise} promise resolved when storage change handled
     */
    var onStorageChanged = function (changes) {
        // if the opacity storage value changed, we can reflect that by adding a change for HIGHLIGHT_DEFINITIONS
        // where there is no oldValue (nothing to clear), and the undefined newValue means 'read storage values'
        if (changes[ChromeStorage.KEYS.HIGHLIGHT_BACKGROUND_ALPHA]) {
            const name = ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS
            changes[name] = changes[name] || {}
        }
        
        // first update common (shared) style
        if (changes[ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE]) {
            const c = changes[ChromeHighlightStorage.KEYS.SHARED_HIGHLIGHT_STYLE]
            const className = $scope.stylesController.highlightClassName

            if (c.oldValue) {
                _stylesheet.clearHighlightStyle(className)
            }

            if (c.newValue) {
                _stylesheet.setHighlightStyle({
                    className: className,
                    style: c.newValue,
                    disableBoxShadow: DISABLE_BOX_SHADOW,
                })
            }
        }
        
        // then update specific definitions
        if (changes[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]) {
            const c = changes[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]

            if (c.oldValue) {
                for (const {className} of c.oldValue) {
                    _stylesheet.clearHighlightStyle(className)
                }
            }

            // name of property of `stylesController` containing definitions object
            const name = 'definitions'

            // if we remove all teh styles (with reset button), newValue will be undefined.
            // so in that case, get the default styles
            if (!c.newValue) {
                return new ChromeHighlightStorage().getAll().then(items => {
                    $scope.stylesController[name] = items[ChromeHighlightStorage.KEYS.HIGHLIGHT_DEFINITIONS]
                    $scope.$apply()
                })
            }

            $scope.stylesController[name] = c.newValue
            $scope.$apply()
        }

        return Promise.resolve()
    }
}]);

/**
 * 3 - Controller for Pages pane
 */
optionsControllers.controller('PagesController', ["$scope", function ($scope) {
    /** 
     * Object to contain all other objects in the scope of this controller
     * @typedef {Object} Options
     * @prop {string} groupBy
     * @prop {boolean} ascendingOrder
     * @prop {boolean} showPageText
     */

    /** 
     * Object to contain all other objects in the scope of this controller
     * @typedef {Object} PagesControllerScope
     * @prop {string} documentFilterText - text currently entered in document filter input text
     * @prop {Object} filters - filter predicate functions
     * @prop {Options} options - watched options specific to scope
     */
   
    /** @type {PagesControllerScope} */
    $scope.pagesController = {
        documentFilterText: "",
        filters: {
            // filter predicate called on individual groups
            // (delegates to document filter)
            group: (group) => group.docs.some(doc => $scope.pagesController.filters.document(doc)),
        
            // filter predicate called on individual documents of a group
            document: (doc) => {
                const t = $scope.pagesController.documentFilterText.toLowerCase()
    
                // always check title & match (url), optionally check page text objects
                return t.length === 0 ||
                    (typeof doc.title === 'string' && doc.title.toLowerCase().indexOf(t) != -1) ||
                    (doc.match.toLowerCase().indexOf(t) != -1) || (
                        $scope.pagesController.options.showPageText &&
                        doc.texts.some(o => {
                            // text may have introduced undefined (see context_menus)
                            return typeof o.text === 'string' && o.text.toLowerCase().indexOf(t) != -1
                        })
                    )
            }
        }
    }

    // docs before grouping
    let ungroupedDocs = []

    // starter
    init()

    function init() {
        // build default options object
        return new ChromeStorage().get([
            ChromeStorage.KEYS.OPTIONS.BOOKMARKS_GROUP_BY,
            ChromeStorage.KEYS.OPTIONS.BOOKMARKS_ASCENDING_ORDER,
            ChromeStorage.KEYS.OPTIONS.BOOKMARKS_SHOW_PAGE_TEXT,
        ]).then(items => {
            // initialize options of scope
            $scope.pagesController.options = {
                groupBy: items[ChromeStorage.KEYS.OPTIONS.BOOKMARKS_GROUP_BY],
                ascendingOrder: items[ChromeStorage.KEYS.OPTIONS.BOOKMARKS_ASCENDING_ORDER],
                showPageText: items[ChromeStorage.KEYS.OPTIONS.BOOKMARKS_SHOW_PAGE_TEXT], 
            }
            
            return new Promise(resolve => chrome.runtime.getBackgroundPage(b => resolve(b)))
        }).then(({_database}) => {
            // get an array of each unique match, and the number of associated documents (which is of no use)
            return _database.getMatchSums_Promise().then(rows => {
                // $scope.rows = rows.filter(row => row.value > 0)
                // $scope.$apply();

                // the key for each row (item in the array) is the 'match' for each document, 
                // and the value is the sum ('create'+1, 'delete'-1)
                return Promise.all(rows.filter(row => row.value > 0)
                    .map(row => _database.getDocuments_Promise(row.key, {
                        descending: false,
                        limit: 1   
                    }))
                )
            }).then(a => {
                // each entry in docs array is an array containing at most one doc
                const docs = a.filter(a => a.length === 1).map(a => a[0])
                // first doc should always be a 'create'
                console.assert(docs.every(doc => doc.verb === 'create'))
    
                // if we're grouping by last_date (date of the last non-deleted 'create' document),
                // or showing text for each highlight, we need to get all create documents too
                return Promise.all(docs.map(doc => {
                    return _database.getCreateDocuments_Promise(doc.match).then(a => {
                        // if the first create document has a corresponding delete document, then the title (stored only
                        // on the first document) will be removed along with the create document.
                        console.assert(a.length >= 1)
                        
                        // So we go through this dance.
                        if (a.length >= 1 && a[0]._id !== doc._id) {
                            a[0].title = doc.title
                        }
    
                        return a
                    })
                }))
            })
        }).then(createDocs => {
            // we have an array of array of createDocs

            // add temporary properties to first doc of each
            createDocs = createDocs.filter(a => a.length >= 1)
            createDocs.forEach(a => {
                // numeric date of creation of latest 'create' doc
                a[0].lastDate = a[a.length - 1].date
                // array of each text item for the page's 'create' docs, and its className (aka highlight style)
                a[0].texts = a.map(doc => {
                    return {
                        // text might be undefined if info.selectedText was undefined in context_menus.js (for some reason)
                        text: doc.text,
                        docId: doc._id,
                        date: doc.date,
                        className: doc.className,
                    }
                })
            })

            ungroupedDocs = createDocs.map(a => a[0])

            // group the documents by their title (if possible), and get a sorted array
            updateGroupedDocuments()
            $scope.$apply()

            // After the initial update, watch for changes to options object
            $scope.$watchCollection('pagesController.options', (newOptions, oldOptions) => {
                // update storage
                return new ChromeStorage().set({
                    [ChromeStorage.KEYS.OPTIONS.BOOKMARKS_GROUP_BY]: newOptions.groupBy,
                    [ChromeStorage.KEYS.OPTIONS.BOOKMARKS_ASCENDING_ORDER]: newOptions.ascendingOrder,
                    [ChromeStorage.KEYS.OPTIONS.BOOKMARKS_SHOW_PAGE_TEXT]: newOptions.showPageText,
                }).then(() => {
                    // only these need to cause update
                    // if (newValue.groupBy === oldValue.groupBy &&
                    //     newValue.ascendingOrder === oldValue.ascendingOrder) {
                    //     return
                    // }

                    // rebuild group documents array based on new options
                    updateGroupedDocuments()
                    $scope.$apply()
                })
            })
        })
    }

    /**
     * Group an array of documents by a common property
     * 
     * @param {[{Object}]} docs array of 'create' documents for the first of its matches 
     * @param {Object} [options] options object
     * @returns [{object}] array of groups
     */
    function groupDocuments(docs, options) {
        // grouped by property name (section title)
        var groups = {},
            untitledGroup = {
                // value: chrome.i18n.getMessage('untitled_page_group'),
                docs: []
            },
            numberGroup = { 
                value: "#",// chrome.i18n.getMessage('untitled_page_group'),
                docs: []
            }

        options = options || {}
        options.groupBy = options.groupBy || 'title'
        options.reverse = (typeof options.reverse === 'boolean' && options.reverse) || false

        docs.filter(d => d.texts.length > 0).forEach(doc => {
            // typeless value defining group
            const groupValue = (() => {
                switch (options.groupBy) {
                    case 'title':
                        const title = doc.title
                        return typeof title === 'string' && title.length >= 1 && title[0].toUpperCase() || undefined

                    case 'first_date':
                        // days since epoch
                        return Math.floor(new Date(doc.date).getTime() / 8.64e7)

                    case 'last_date':
                        // days since epoch
                        return Math.floor(new Date(doc.lastDate).getTime() / 8.64e7)

                    default:
                        console.assert(false)
                }
            })()

            const group = (() => {
                switch (typeof groupValue) {
                    case 'undefined':
                        return untitledGroup

                    case 'string':
                        // if the string (single letter) is a digit
                        if (options.groupBy === 'title' && !isNaN(parseInt(groupValue, 10))) {
                            return numberGroup
                        }
                        // fallthrough

                    default:
                        // if groups doesn't have a section with this title, add it
                        if (!groups.hasOwnProperty(groupValue)) {
                            groups[groupValue] = {
                                value: groupValue,      // formatted later (if not string)
                                docs: []
                            }
                        }

                        return groups[groupValue]
                }
            })()

            group.docs.push(doc)
        })

        // convert to array
        let sortedGroups = Object.getOwnPropertyNames(groups)
            .sort()
            .map(value => groups[value])

        Array.prototype.push.apply(sortedGroups, [
            numberGroup,
            untitledGroup
        ].filter(g => g.docs.length > 0))

        // if (numberGroup.docs.length > 0) {
        //     sortedGroups.push(numberGroup)
        // }

        // if (untitledGroup.docs.length > 0) {
        //     sortedGroups.push(untitledGroup)
        // }

        sortedGroups.forEach(group => {
            // currently groups only have a raw value - format it as text
            group.title = (() => {
                switch (typeof group.value) {
                    case 'undefined':
                        // untitled
                        return undefined
                    case 'string':
                        // value is the first letter of group title
                        return group.value
                    case 'number':
                        // value is days since epoch
                        const date = new Date(group.value * 8.64e7)

                        return date.toLocaleDateString(undefined, {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })

                    default:
                        console.assert(false)
                        break;
                }
            })()

            // not needed
            delete group.value

            // sort documents in-place within group
            group.docs.sort((() => {
                // return a specific comparison func
                switch (options.groupBy) {
                    case 'title':
                        return (d1, d2) => {
                            // title may be undefined 
                            if (typeof d1 === 'undefined' && typeof d2 === 'undefined') {
                                return 0;
                            }

                            return (d1.title || "").localeCompare(d2.title || "")
                        }

                    case 'first_date':
                        return (d1, d2) => d1.date - d2.date
                    case 'last_date':
                        return (d1, d2) => d1.lastDate - d2.lastDate
                }
            })())
        })

        if (options.reverse) {
            sortedGroups.reverse()

            sortedGroups.forEach(group => {
                group.docs.reverse()
            })
        }
        // groups.sort((a, b) => b.title.localeCompare(a.title))

        return sortedGroups
        // $scope.apply()
    }

    function updateGroupedDocuments() {
        // group the documents by their title (if possible), and get a sorted array
        $scope.groupedDocs = groupDocuments(ungroupedDocs, {
            groupBy: $scope.pagesController.options.groupBy,
            reverse: !$scope.pagesController.options.ascendingOrder,
        })
    }

    /**
     * Button on the text of each highlight was clicked
     * @param {Object} docId - id of doc that defines the actual highlight
     * @param {Object} initialDoc - initial doc for the page, containing array of text objects for all the highlights
     */
    $scope.onClickRemoveHighlight = (docId, initialDoc) => {
        // wait until transition on close button ends before updating model
        return new Promise(resolve => chrome.runtime.getBackgroundPage(b => resolve(b))).then(({_eventPage}) => {
            return _eventPage.deleteHighlight(undefined, docId)
        }).then(() => {
            const index = initialDoc.texts.findIndex(t => t.docId === docId)
            console.assert(index !== -1)

            // splice out of array of highlights (i.e. texts)
            initialDoc.texts.splice(index, 1)

            // regroup
            updateGroupedDocuments()
            $scope.$apply()
        })
    }

    /**
     * Clicked 'remove all highlights for this site' button (x)
     */
    $scope.onClickRemoveAllHighlights = function (doc, group) {
        if (!window.confirm(chrome.i18n.getMessage("confirm_remove_all_highlights"))) {
            return Promise.resolve()
        }

        // var match = $scope.rows[index].key;
        return new Promise(resolve => chrome.runtime.getBackgroundPage(b => resolve(b))).then(({_database}) => {
            return _database.removeDocuments_Promise(doc.match)
        }).then(result => {
            // remove the corresponding doc from our '$scope.groupedDocs' via the handy reference
            const index = group.docs.indexOf(doc)
            if (index === -1) {
                return Promise.reject(new Error("document not found"))
            }

            group.docs.splice(index, 1)
            $scope.$apply()
        })
    };

    /**
     * Clicked 'remove all pages' button.
     */
    $scope.onClickRemoveAllPages = function () {
        if (!window.confirm(chrome.i18n.getMessage("confirm_remove_all_pages"))) {
            return Promise.resolve()
        }

        // destroy and re-create the database
        return new Promise(resolve => chrome.runtime.getBackgroundPage(b => resolve(b))).then(({_database}) => {
            return _database.reset()
        }).then(() => {
            $scope.groupedDocs = []
            $scope.$apply()
        });
    }
}]);

/**
 * 3 - Controller for Experimental pane
 */
optionsControllers.controller('ExperimentalController', ["$scope", function ($scope) {
    // keys in exported db file
    const KEYNAMES = {
        magic: 'magic',
        version: 'version'
    };

    // magic string added to exported db
    const VALUE_MAGIC = "Super Simple Highlighter Exported Database";

    init()

    function init() {
         // add event listener to files input element
         document.getElementById('files').addEventListener('change', onFileSelect, false);
    }

    function onFileSelect(evt) {
        var file = evt.target.files[0];	// FileList object
        var reader = new FileReader();

        // Closure to capture the file information.
        reader.onload = function (e) {
            // newline delimited json
            const ldjson = e.target.result
            const jsonObjects = ldjson.split('\n')
            
            // newline delimited json
            return new Promise((resolve, reject) => {
                // validate header
                const header = JSON.parse(jsonObjects.shift())
    
                if (header[KEYNAMES.magic] !== VALUE_MAGIC || header[KEYNAMES.version] !== 1) {
                    reject({
                        status: 403,
                        message: "Invalid File"
                    });
                } else {
                    resolve()
                }
            }).then(function () {
                // the first line-delimited json object is the storage highlights object. Don't use them until the database loads successfully
                const items = JSON.parse(jsonObjects.shift())
    
                // remainder is the database
                return new Promise(resolve => chrome.runtime.getBackgroundPage(b => resolve(b))).then(({_database}) => {
                    return _database.load(jsonObjects.join('\n'))
                }).then(() => {
                    // set associated styles. null items are removed (implying default should be used)
                    return new ChromeHighlightStorage().setAll(items)
                })
            }).then(() => {
                location.reload();
            }).catch(function (err) {
                // error loading or replicating tmp db to main db
                alert(`Status: ${err.status}\nMessage: ${err.message}`)
            });
        };

        // Read in the image file as a data URL.
        reader.readAsText(file, "utf-8");
        // reader.readAsDataURL(file);
    }

    /**
     * Dump DB to line delimited json string, and simulate a click on an anchor with it as its data url (i.e. save it)
     * 
     * @returns {Promise} resolved on click dispatch
     */
    $scope.onClickDump = function () {
        // header
        const header = {
            [KEYNAMES.magic]: VALUE_MAGIC,
            [KEYNAMES.version]: 1,
        }

        let ldjson = JSON.stringify(header)

        return new ChromeHighlightStorage().getAll({defaults: false}).then(items => {
            // the first item is always the highlights object
            ldjson += '\n' + JSON.stringify(items) + '\n';

            // the remainder is the dumped database
            const stream = new window.memorystream();

            stream.on('data', function (chunk) {
                ldjson += chunk.toString();
            });

            return new Promise(resolve => chrome.runtime.getBackgroundPage(b => resolve(b))).then(({_database}) => {
                return _database.dump(stream)
            })
        }).then(() => {
            function utf8_to_b64(str) {
                return window.btoa(unescape(encodeURIComponent(str)));
            }
        
            // function b64_to_utf8(str) {
            //     return decodeURIComponent(escape(window.atob(str)));
            // }
        
        

            // create a temporary anchor to navigate to data uri
            const elm = document.createElement("a")

            elm.download = chrome.i18n.getMessage("experimental_database_export_file_name")
            elm.href = "data:text;base64," + utf8_to_b64(ldjson)

            // a.href = "data:text/plain;charset=utf-8;," + encodeURIComponent(dumpedString);
            // a.href = "data:text;base64," + utf8_to_b64(dumpedString);
            // a.href = "data:text;base64," + utf8_to_b64(dumpedString);
            //window.btoa(dumpedString);

            // create & dispatch mouse event to hidden anchor
            const event = document.createEvent("MouseEvent")

            event.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
            elm.dispatchEvent(event)
        });
    };
}]);

/**
 * 4 - Controller for About pane
 */
optionsControllers.controller('AboutController', ["$scope", function ($scope) {
    // TODO: move up a level
    $scope.manifest = chrome.runtime.getManifest()
    
    // scope access to array of libraries
    $scope.aboutController = {
        libraries: _libraries,
        cc: _licenses
    }

	/**
	 * Handler for 'restore all warnings' button.
     * @returns {Promise} resolved on storage update
	 */
    $scope.onClickRestoreAllWarnings = function () {
        return new ChromeStorage().set(false, ChromeStorage.KEYS.FILE_ACCESS_REQUIRED_WARNING_DISMISSED)
    };
}]);
