/*global PouchDB, emit, purl, _stringUtils */

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

// PouchDB.debug.enable('*');

var _database = {
    db: null,
	dbname: 'sos',

    /**
     * Lazy getter for database instance
     * @return {object} database
     */
    getDatabase: function () {
        "use strict";
        if (!_database.db) {
            _database.db = new PouchDB(_database.dbname, {
                auto_compaction: true,
                adapter: 'idb',
            });
        }

        return _database.db;
    },

    /**
     * Put the standard design documents
     * @param [callback] function(err, result) result = [{ok:"true,id:"123",rev:"456"}, ...]
     */
    putDesignDocuments: function () {
        "use strict";
        return _database.getDatabase().bulkDocs([
			{
                _id: '_design/match_date_view',
                views: {
                    'match_date_view': {
                        map: function (doc) {
                            if (doc.match) {
                                emit([doc.match, doc.date]);
                            }
                        }.toString()
                    }
                }
            },
            {
                _id: '_design/sum_view',
                views: {
                    'sum_view': {
                        map: function (doc) {
                            // the values will be reduced with '_sum'. If that == 0, number of create == delete
                            switch (doc.verb) {
                            case 'create':
                                emit(doc.match, 1);
                                break;
                            case 'delete':
                                emit(doc.match, -1);
                                break;
                            }
                        }.toString(),
                        reduce: "_sum"
                    }
                }
            }
       ]);
    },

	destroy: function () {
        "use strict";
		return _database.getDatabase().destroy().then(function() {
			_database.db = null;
		});
	},

    /**
     * Destroy the database, then create it again, and put its design documents (as runtime.onInstalled does)
     * @param {function} [callback] function(err, response) (see putDesignDocuments)
     */
    reset: function () {
        "use strict";
		return _database.destroy().then(function() {
            return _database.putDesignDocuments();
		});
    },

    /**
     * Get the parts of the url used as a key for transactions based on the url
     * Basically, url minus fragment
     * @param {string} pageUrl full uri (http://www.techmeme.com/mini?q=abc#here)
     * @param {string} [frameUrl] url of the frame specific to the match. May be null if same as pageUrl
     * @param {object} [options]
     * @return {string} match (www.example.com/mini?q=abc)
     */
    buildMatchString: function (pageUrl, frameUrl, options) {
        "use strict";
        var u = purl(pageUrl), host = u.attr('host');

        if (!options) {
            // TODO: build an options object based on whether the host is in the exceptions list



            if (!options) {
                // defaults
                options = {
                    scheme: true,
                    query: true,
                    fragment: false
                };
            }
        }

        // shortcut - basically the match is the entire url
        if( options.scheme && options.query && options.fragment ) {
            return pageUrl;
        }

        var port = u.attr('port'), query = u.attr('query'), fragment = u.attr('fragment');

        // http://blah.com
        var match = options.scheme ? (u.attr('protocol') + "://") : "";
        match += host;

        // [:80]
        if (port && port.length !== 0) {
            match += (":" + port);
        }

        // /mini
        match += u.attr('path');

        // [?q=123]
        if (options.query && query && query.length !== 0) {
            match += ("?" + query);
        }

        // [#something]
        if (options.fragment && fragment && fragment.length !== 0) {
            match += ("#" + fragment);
        }

        return match;
    },
	
    /**
     * Post a new document with the 'create' verb
     * @param match
     * @param range
     * @param className
     * @param text
     * @param {string} [title]
     * @param callback function(err, res)
     */
    postCreateDocument_Promise: function (match, range, className, text, title) {
        "use strict";
        // required
        let doc = {
            _id: _stringUtils.createUUID({ beginWithLetter: true }),
            // _rev: undefined,

            match: match,
            date: Date.now(),
            verb: "create",

            range: range,
            className: className,
            text: text
        };

        // optionals
        if (typeof title === 'string') {
            doc.title = title
        }

        return _database.getDatabase().put(doc)
    },

    /**
     * Post a new document with the 'delete' verb
     * @param documentId the id for an existing document which specifies the
     * @param callback
     * corresponding highlight we wish to mark as deleted
     */
    postDeleteDocument_Promise: function (documentId) {
        "use strict";
        return _database.getDocument_Promise(documentId).then(function (doc) {
            var match = doc.match;

            // create a new document, detailing the 'delete' verb transaction
            // no need for createUUID, as it won't be used as an id/class attribute
            doc = {
                match: doc.match,
                date: Date.now(),
                verb: "delete",
                //
                correspondingDocumentId: documentId
            };

            // var options = {};
            return _database.getDatabase().post(doc);
        });
    },

    /**
     * Update the className for latest revision to a 'create' document
     * @param documentId id of existing 'create' document
     * @param className new class name
     * @param callback function(err, doc)
     */
    updateCreateDocument_Promise: function (documentId, options) {
        "use strict"
        return _database.getDocument_Promise(documentId).then(doc => {
            // can only update 'create' documents
            if (doc.verb !== 'create') {
                return Promise.reject(
                    new Error('Attempted to update document with unhandled verb: ' + doc.verb));
            }

            options.className = options.className || doc.className
            options.title = options.title || doc.title

            // change required?
            if (doc.className === options.className && doc.title === options.title) {
                // no change
				return {
					'ok': true,
					'id': doc._id,
					'rev': doc._rev
				}
            }

            // put new revision
            doc.className = options.className 
            doc.title = options.title

            return _database.getDatabase().put(doc);
        })
    },

    /**
     * Get document (of any verb). Always latest revision
     * @param {string} documentId
     * @param {function} callback (err, doc)
	*/
    getDocument_Promise: function (documentId) {
        "use strict";
        // var options = {};
        return _database.getDatabase().get(documentId);
    },
	

    /**
     * Get all documents for a match, in ascending date order.
     * @param {string} match - match string to search for in each doc
     * @param {Object} [opt] - search options
     */
    getDocuments_Promise: function (match, opt) {
        opt = opt || {}
        
        // defaults
        opt.descending = opt.descending || false
        opt.verbs = (typeof opt.verbs === 'string' && [opt.verbs]) || opt.verbs

        let queryOptions = {
            startkey: !opt.descending ? [match] : [match, {}],
            endkey: !opt.descending ? [match, {}] : [match],
            descending: opt.descending,
            include_docs: true
        }

        if (typeof opt.limit === 'number') {
            queryOptions.limit = opt.limit
        }

        // promise version
		return _database.getDatabase().query("match_date_view", queryOptions).then(result => {
            let docs = result.rows.map(row => row.doc)
            
            // filter by verb
            if (Array.isArray(opt.verbs)) {
                const verbs = new Set(opt.verbs)

                docs = docs.filter(doc => verbs.has(doc.verb))
            }

            return docs
        });
    },
	
    /**
     * Delete a specific document (any verb).
     * This is usually only called after a postDeleteDocument(), when the check for stale documents finds something,
     * or from event page's createHighlight(), when something went wrong inserting it in the DOM
     * @param docId
     * @param docRev
     * @param {object} [callback] *seems to be required*
     */    
    removeDocument_Promise: function (docId, docRev) {
        "use strict";
        // var options = {};
        return _database.getDatabase().remove(docId, docRev);
    },

    /**
     * Delete all documents associated with 'match' key (any verb).
     * Usually called via a 'remove all' button
     * @param {string} match key (eg www.google.com/something?qq)
     */	
	removeDocuments_Promise: function(match) {
        "use strict";
		// promise version
        return _database.getDocuments_Promise(match).then(function(docs) {
            docs.forEach(function (doc) {
               doc._deleted = true;
            });

            return _database.getDatabase().bulkDocs(docs);
        })
	},

    /**
     * map-reduce on a view of all documents associated with a key of 'match'.
     * The reduce is on the sum of the value of the document, where a 'create' verb is +1 and 'delete' -1.
     * if the sum is zero we can safely remove all documents with this key.
     * if it's < 0 somethings wrong.
     * @param {string} match
     * @param {function} [callback] function(err, sum)
     */
    getMatchSum_Promise: function (match) {
        "use strict";
        return _database.getDatabase().query('sum_view', {
            key: match
        }).then(function(result) {
            var sum = (result.rows.length === 0 ? 0 : result.rows[0].value);
			
            if (sum < 0) {
                console.log("WARNING: create/delete sum < 0");
            }

            return sum;
        });
    },

    /**
     * Get an array of unique matches, and the number of documents (accounting for 'delete' documents)
     * If the value is zero, all documents with its match (key) can be removed
     * @param {function} callback function(err, rows): rows = [{key: match, value: count}]
     */
    getMatchSums_Promise: function() {
        "use strict";
        return _database.getDatabase().query("sum_view", {
            group: true,
            group_level: 1,
            include_docs: false
        }).then(function (result) {
			return result.rows;
        });
    },

    /**
     * Get all documents for a match, in ascending date order.
     * If a 'delete' document exists, it is filtered out, along with its corresponding 'create' document.
     * @param {string} match
     */
	getCreateDocuments_Promise: function (match) {
        "use strict";
		// promise version
		
        // get all the documents (create & delete) associated with the match, then filter the deleted ones
        return _database.getDocuments_Promise(match).then(docs => {
            // set of ids of documents that can be removed
            let s = new Set()

            docs.filter(doc => doc.verb === 'delete').forEach(doc => {
                s.add(doc._id)
                s.add(doc.correspondingDocumentId)
            })
            
            return docs.filter(doc => !s.has(doc._id))
        })
	},

    /**
     * As design docs are deleted or modified, their associated index files (in CouchDB) or
     * companion databases (in local PouchDBs) continue to take up space on disk.
     * viewCleanup() removes these unnecessary index files.
     * @param {function} [callback] function(result): { ok: "true" }
     */
    viewCleanup_Promise: function () {
        "use strict";
        return _database.getDatabase().viewCleanup();
    },

    /**
     * Runs compaction of the database. Fires callback when compaction is done.
     */
    compact: function () {
        "use strict";
        return _database.getDatabase().compact();
    },

	/**
	 * Dump database to a stream
	 * @param {Object} stream - stream to dump to
	 * @returns - {Promise}
	 */
	dump: function (stream) {
		return _database.getDatabase().dump(stream, {
			filter: function (doc) {
				// don't include internal documents
				// return doc._id.match(/^_/) === null;
				return doc._id.match(/^_design\//) === null;
			}
		});
	},
	
	/**
	 * Load database from url or string
	 * @param {String} urlOrString - source
	 * @returns - {Promise}
	 */
	load: function (urlOrString) {
		// attempt to load database into a temporary db (not in-memory, though)
		var tmpdb = new PouchDB("_tmpdb", {
            storage: 'temporary',
        });
		
		return tmpdb.load(urlOrString).then(function() {
			// safe to destroy existing database
			return _database.destroy();
		}).then(function() {
			// replicate loaded database. Design docs were filtered out
			return PouchDB.replicate(tmpdb, _database.getDatabase());
		}).then(function() {
			// add design docs
			return _database.putDesignDocuments();
		}).then(function() {
			// cleanup
			return tmpdb.destroy();
		}).catch(function(err) {
			// cleanup
			tmpdb.destroy();

			// let caller handle error
			throw err;
		});
	},
	
	/**
	 * Sort documents using promise that resolves to a comparable value
     * @param {Array<Object>} docs - array of document objects
     * @param {Function<Promise>} [comparator] - Function that returns a promise that returns a comparable value
	 */
	sortDocuments: function (docs, comparator) { 
		comparator = comparator || (doc => Promise.resolve(doc.date))

		// object in which each attribute's value corresponds to the resolved
		// promise result for it. If the promise rejected, no attribute is
        // added. Every attribute's value must be of the same type
        let values = new Map()
		
		return Promise.all(docs.map(doc => {
			return comparator(doc).then(value => values.set(doc._id, value)).catch(() => { /* ignore */ })
		})).then(() => {
            // shallow copy docs, and sort it
            return docs.slice().sort((d1, d2) => {
                const v1 = values.get(d1._id)
                const v2 = values.get(d2._id)
                const t1 = typeof v1

                if (t1 === 'undefined') {
                    return (typeof v2 === 'undefined') ? 0 : -1;
                }
                if (typeof v2 === 'undefined') {
                    return (typeof v1 === 'undefined') ? 0 : 1;
                }

                switch (t1) {
                    case 'string':
                        return v1.localeCompare(v2)
                    default:
                        return v1 - v2
                }
            })
		})
	},
};

