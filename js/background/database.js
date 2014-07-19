"use strict";
/*global PouchDB, emit, purl, _stringUtils */

var _database = {
    db: null,

    /**
     * Lazy getter for database instance
     * @return {null}
     */
    getDatabase: function () {
        if (!_database.db) {
            _database.db = new PouchDB('index1');
        }

        return _database.db;
    },

    /**
     * Put the standard design documents
     * @param [callback] function(err, result)
     */
    putDesignDocuments: function (callback) {
        _database.getDatabase().bulkDocs([
            {
                _id: '_design/matches_count_view',
                views: {
                    'matches_count_view': {
                        map: function (doc) {
                            if (doc.match) {
                                emit(doc.match);
                            }
                        }.toString(),
                        reduce: "_count"
                    }
                }
            },
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
                        reduce: "_sum",
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
                        }.toString()
                    }
                }
            },

//            {
//                /**
//                 * View of 'create' document's class names
//                 */
//                _id: '_design/class_name_view',
//                views: {
//                    'class_name_view': {
//                        map: function (doc) {
//                            if (doc.verb === "create") {
//                                emit(doc.className);
//                            }
//                        }.toString()
//                    }
//                }
//            },
//
//            {
//                _id: '_design/delete_verb_filter',
//                "filters": {
//                    'delete_verb_filter': function (doc, req) {
//                        // existence of verb property implies not a design document
//                        return doc.verb === "delete";
//                    }.toString()
//                }
//            }
        ], callback);
    },

    /**
     * Get the parts of the url used as a key for transactions based on the url
     * Basically, url minus scheme, port and fragment
     * @param {string} url full uri (http://www.techmeme.com/mini?q=abc#here)
     * @param {object} [options]
     * @return {string} match (www.techmeme.com/mini?q=abc)
     */
    buildMatchString: function (url, options) {
        if (!options) {
            options = {
                exclude_query: false
            };
        }

        var u = purl(url), port = u.attr('port'), query = u.attr('query');

        // www.techmeme.com
        var match = u.attr('host');

        // :80
        if (port && port.length !== 0) {
            match += (":" + port);
        }
        // /mini
        match += u.attr('path');

        // ?q=123
        if (!options.exclude_query && query && query.length !== 0) {
            //
            match += ("?" + query);
        }

        return match;
    },

    /**
     * Post a new document with the 'create' verb
     * @param match
     * @param range
     * @param className
     * @param text
     * @param callback function(err, res)
     */
    postCreateDocument: function (match, range, className, text, callback) {
        _database.getDatabase().put({
            match: match,
            date: Date.now(),
            verb: "create",

            range: range,
            className: className,
            text: text
        }, _stringUtils.createUUID({
            beginWithLetter: true
        }), callback);
    },

    /**
     * Post a new document with the 'delete' verb
     * @param documentId the id for an existing document which specifies the
     * @param callback
     * corresponding highlight we wish to mark as deleted
     */
    postDeleteDocument: function (documentId, callback) {
        _database.getDocument(documentId, function (err, doc) {
            if (err) {
                if (callback) {
                    callback(err);
                }

                return;
            }

            var match = doc.match;

            // create a new document, detailing the 'delete' verb transaction
            _database.getDatabase().put({
                match: match,
                date: Date.now(),
                verb: "delete",
                //
                correspondingDocumentId: documentId
            }, _stringUtils.createUUID({
                beginWithLetter: true
            }), function (err, result) {
                if (result) {
                    // does the creation of the delete document cause there to be no highlights in total?
                    _database.getAggregateDocumentCount(match, function (err, sum) {
                        if (err) {
                            return;
                        }

                        console.log("Document sum for match '" + match + "' is " + sum);

                        if (sum <= 0) {
                            // remove stale documents
                            _database.removeDocuments(match);
                        }
                    });
                }

                if (callback) {
                    callback(err, result);
                }
            });
        });
    },

    /**
     * Update the className for latest revision to a 'create' document
     * @param documentId id of existing 'create' document
     * @param className new class name
     * @param callback function(err, doc)
     */
    updateCreateDocument: function (documentId, className, callback) {
        _database.getDocument(documentId, function (err, doc) {
            if (err) {
                if (callback) {
                    callback(err);
                }
                return;
            }

            // can only update 'create' documents
            if (doc.verb !== 'create') {
                if (callback) {
                    callback({
                        message: 'Attempted to update document with unhandled verb: ' + doc.verb
                    });
                }

                return;
            }

            // don't update if the class name is already the same
            if (doc.className === className) {
                // no change
                if (callback) {
                    callback(null, doc);
                }

                return;
            }

            // update the property of the document
            doc.className = className;
            _database.getDatabase().put(doc, callback);
        });
    },

    /**
     * Get document (of any verb). Always latest revision
     * @param {string} documentId
     * @param {function} callback (err, doc)
     */
    getDocument: function (documentId, callback) {
        _database.getDatabase().get(documentId, callback);
    },

    /**
     * Get all documents for a match, in ascending date order.
     * @param {string} match
     * @param {function} [callback] function(err, docs)
     */
    getDocuments: function (match, callback) {
        // get all the documents (create & delete) associated with the match, then filter the deleted ones
        _database.getDatabase().query('match_date_view', {
            startkey: [match],
            endkey: [match, {}],
            descending: false,
            include_docs: true
        }, function (err, result) {
            if (!callback) {
                return;
            }

            if (err) {
                callback(err);
            } else {
                var docs = result.rows.map(function (row) {
                    return row.doc;
                });

                callback(null, docs);
            }
        });
    },

    /**
     * Delete a specific document (any verb).
     * This is usually only called after a postDeleteDocument(), when the check for stale documents finds something
     * @param id
     * @param rev
     * @param [callback]
     * @private
     */
    _removeDocument: function (id, rev, callback) {
        _database.getDatabase().remove(id, rev, callback);
    },

    /**
     * Delete all documents associated with 'match' key (any verb).
     * Usually called via popup's 'remove all' button
     * @param {string} match key (eg www.google.com/something?qq)
     * @param {function} [callback] function(err, result)
     */
    removeDocuments: function (match, callback) {
        _database.getDocuments(match, function (err, docs) {
            if (err) {
                if (callback) {
                    callback(err);
                }
                return;
            }

            // map to an array of objects which bulkDocs() can use to delete them
            docs.forEach(function (doc) {
               doc._deleted = true;
            });

            _database.getDatabase().bulkDocs(docs, callback);
        });
    },

    /**
     * Get an array of unique matches, and the count of documents (of any verb) associated with them
     * @param {function} callback function(err, rows): rows = [{key: match, value: count}]
     */
    getMatches: function(callback) {
        _database.getDatabase().query('matches_count_view', {
            group: true,
            group_level: 1,
            include_docs: false
        }, function (err, result) {
            if (err) {
                callback(err);
            } else {
                callback(null, result.rows);
            }
        });
    },

    /**
     * map-reduce on a view of all documents associated with a key of 'match'.
     * The reduce is on the sum of the value of the document, where a 'create' verb is +1 and 'delete' -1.
     * if the sum is zero we can safely remove all documents with this key.
     * if it's < 0 somethings wrong.
     * @param {string} match
     * @param {function} [callback] function(err, sum)
     */
    getAggregateDocumentCount: function (match, callback) {
        _database.getDatabase().query('sum_view', {
            key: match
        }, function (err, result) {
            if (callback) {
                if (err) {
                    callback(err);
                } else {
                    var sum = result.rows[0].value;
                    if (sum < 0) {
                        console.log("WARNING: create/delete sum < 0");
                    }

                    callback(null, sum);
                }
            }
        });
    },

    /**
     * Get all documents for a match, in ascending date order.
     * If a 'delete' document exists, it is filtered out, along with its corresponding 'create' document.
     * @param {string} match
     * @param {function} [callback] function(err, docs)
     */
    getCreateDocuments: function (match, callback) {
        // get all the documents (create & delete) associated with the match, then filter the deleted ones
        _database.getDocuments(match, function (err, docs) {
            if (!callback) {
                return;
            }

            if (err) {
                callback(err);
                return;
            }

            var filterable = {};

            // map to just the documents,
            docs = docs.filter(function (doc) {
                // filter out delete documents, and mark corresponding 'create' document for filtering later
                if (doc.verb === "delete") {
                    // remove this, and mark the corresponding doc as being ready for removal later
                    filterable[doc.correspondingDocumentId] = true;
                    return false;
                }
                else {
                    return true;
                }
            }).filter(function (doc) {
                // filter out corresponding docs collected earlier

                // return FALSE to filter it out
                return filterable[doc._id] === undefined;
            });

            callback(null, docs);

        });
    },

    /**
     * As design docs are deleted or modified, their associated index files (in CouchDB) or
     * companion databases (in local PouchDBs) continue to take up space on disk.
     * viewCleanup() removes these unnecessary index files.
     * @param {function} [callback] function(result): { ok: "true" }
     */
    viewCleanup: function (callback) {
        _database.getDatabase().viewCleanup(callback);
    },

    /**
     * Runs compaction of the database. Fires callback when compaction is done.
     * @param {function} [callback] ?
     */
    compact: function (callback) {
        _database.getDatabase().compact(callback);
    },

};

