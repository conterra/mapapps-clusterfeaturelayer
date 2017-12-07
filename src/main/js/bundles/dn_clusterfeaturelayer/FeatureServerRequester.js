/*
 * Copyright (C) 2017 con terra GmbH (info@conterra.de)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
define([
        "dojo/_base/declare",
        "dojo/_base/array",
        "dojo/_base/Deferred",
        "dojo/promise/all",
        "dojo/DeferredList",

        "apprt-request",
        "ct/array",

        "esri/tasks/query",
        "esri/tasks/QueryTask",

        "./ObjectIdCache"
    ],
    function (declare, d_array, Deferred, all, DeferredList,
              apprt_request, ct_array,
              Query, QueryTask,
              ObjectIdCache) {
        return declare([], {
            url: null,

            constructor: function (urls, spatialReference, returnLimit) {
                this.urls = urls;
                this.spatialReference = spatialReference;

                this._queryTasks = {};
                this._queries = {};
                this._objectIdHash = {}; // holds IDs of cached features. Is written in _onIdsReturned -> difference() call

                this.objectIdCache = new ObjectIdCache();

                this.returnLimit = returnLimit || 1000;
            },

            getServiceMetadata: function () {
                var urls = this.filteredUrls = [];
                d_array.forEach(this.urls, function (url) {
                    ct_array.arrayAdd(urls, url.url);
                }, this);

                var that = this;
                var d = new Deferred();
                if (this._serviceMetadata) {
                    d.resolve(this._serviceMetadata);
                }

                var requests = d_array.map(urls, function (url) {
                    // Use MapServer interface because FeatureServer does not deliver the details for each layer.
                    // [URL]/MapServer/layers?f=json
                    var newUrl = url.replace("/FeatureServer", "/MapServer");
                    return apprt_request(newUrl + "/layers", {
                        query: {
                            f: 'json'
                        },
                        handleAs: 'json'
                    });
                }, this);

                var dl = new DeferredList(requests);
                dl.then(function (details) {
                    var response = {details: []};
                    d_array.forEach(details, function (detail, i) {
                        detail[1].url = that.filteredUrls[i];
                        response.details.push(detail[1]);
                    });
                    response.urls = that.urls;
                    that._serviceMetadata = response;
                    d.resolve(response);
                });

                return d;
            },

            getObjectIds: function (layerObjects, whereExpression) {
                var allQueriesDeferred = new Deferred();
                var that = this;
                var queryPromises = [];

                d_array.forEach(layerObjects, function (layer) {
                    var layerId = layer.id;
                    var singleQueryDeferred = new Deferred();
                    var query = that._getQueryForLayer(layerId);
                    query.objectIds = null;

                    if (whereExpression) {
                        query.where = whereExpression;
                    }

                    if (!query.geometry && !query.where) {
                        query.where = '1=1';
                    }

                    // executeForIds will only return an array of object IDs for features that satisfy the input query
                    var promise = that._getQueryTaskForLayer(layerId).executeForIds(query);
                    promise.then(function (results) {
                        if (!results) {
                            results = [];
                        }
                        results.layerId = layerId;
                        singleQueryDeferred.resolve(results);
                    }, function (error) {
                        console.error(error);
                        singleQueryDeferred.reject();
                    });

                    // Add Deferred for each leaf node to 'promises' in order that the application waits for all of them till execution is continued.
                    queryPromises.push(singleQueryDeferred.promise);

                }, this);
                all(queryPromises).then(function (result) {
                    allQueriesDeferred.resolve(result);
                });
                return allQueriesDeferred;
            },

            getFeaturesByIds: function (objectIds, layerId) {
                var d = new Deferred();
                var cacheEntry = this.objectIdCache.get(layerId);
                var uncached = this._difference(objectIds, cacheEntry.length, this._getObjectIdHashEntryForLayerId(layerId));
                this.objectIdCache.set(layerId, cacheEntry.concat(uncached));
                if (uncached && uncached.length) {
                    var query = this._getQueryForLayer(layerId);
                    query.where = null;
                    query.geometry = null;
                    var queries = [];
                    if (uncached.length > this.returnLimit) {
                        while (uncached.length) {
                            // Improve performance by just passing list of IDs
                            // create separate queries for each 'returnLimit' number of feature IDs
                            query.objectIds = uncached.splice(0, this.returnLimit - 1);
                            queries.push(this._getQueryTaskForLayer(layerId).execute(query));
                        }
                        var that = this;
                        all(queries).then(function (res) {
                            var features = d_array.map(res, function (r) {
                                return r.features;
                            });
                            d.resolve({features: that._merge(features)});
                        });
                    } else {
                        // Improve performance by just passing list of IDs
                        query.objectIds = uncached.splice(0, this.returnLimit - 1);
                        this._getQueryTaskForLayer(layerId).execute(query).then(function (results) {
                            d.resolve(results);
                        });
                    }
                } else {
                    d.resolve({features: []});
                }
                return d;
            },

            _getQueryTaskForLayer: function (layerId) {
                if (this._queryTasks[layerId]) {
                    return this._queryTasks[layerId];
                }
                var url = ct_array.arraySearchFirst(this.urls, function (url) {
                    return layerId === url.id;
                }).url;
                var queryUrl = url + "/" + layerId.split("/")[layerId.split("/").length - 1];
                var newQueryTask = new QueryTask(queryUrl);
                this._queryTasks[layerId] = newQueryTask;
                return newQueryTask;
            },

            _getQueryForLayer: function (layerId) {
                if (this._queries[layerId]) {
                    return this._queries[layerId];
                }

                var newQuery = new Query();
                newQuery.outSpatialReference = this.spatialReference;
                newQuery.returnGeometry = true;
                newQuery.outFields = ["*"];

                this._queries[layerId] = newQuery;
                return newQuery;
            },
            _getObjectIdHashEntryForLayerId: function (layerId) {
                if (!this._objectIdHash[layerId]) {
                    this._objectIdHash[layerId] = {};
                }
                return this._objectIdHash[layerId];
            },

            /**
             * Is called whenever new features are received from the esrvice (_getObjectIds -> _onIdsReturned)
             * Adds new features to the hash and returns an array of only the new features.
             * @param {type} arr1
             * @param {type} cacheCount
             * @param {type} hash
             * @returns {Array}
             */
            _difference: function (arr1/*new objectIds*/, cacheCount/*objectId cache length*/, hash/*objecid hash*/) {
                //var start = new Date().valueOf();
                //console.debug('difference start');

                var len = arr1.length, diff = [];

                if (!cacheCount) {
                    diff = arr1; // if no data are cached right now, all features are new.
                    while (len--) {
                        // Add the current feature form the new feature object to the hash if it is not in there already.
                        var value = arr1[len];
                        if (!hash[value]) {
                            hash[value] = value;
                        }
                    }
                    return diff;
                }
                while (len--) {
                    // Add the current feature from the new feature object to the hash if it is not in there already.
                    var val = arr1[len];
                    if (!hash[val]) {
                        hash[val] = val;
                        diff.push(val); // Only add new features to return array.
                    }
                }

                return diff;
            },

            /**
             make a single array from multiple arrays from parameter
             */
            _merge: function (arrs) {
                var len = arrs.length, target = [];
                while (len--) {
                    var o = arrs[len];
                    if (o.constructor === Array) {
                        target = target.concat(o);
                    } else {
                        target.push(o);
                    }
                }
                return target;
            }
        });
    });