/*
 * Copyright (C) 2018 con terra GmbH (info@conterra.de)
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
import Deferred from "dojo/_base/Deferred";
import all from "dojo/promise/all";
import DeferredList from "dojo/DeferredList";
import apprt_request from "apprt-request";
import ct_array from "ct/array";
import Query from "esri/tasks/support/Query";
import QueryTask from "esri/tasks/QueryTask";
import ObjectIdCache from "./ObjectIdCache";

class FeatureServerRequester {
    constructor(sublayers, spatialReference, returnLimit) {
        this.sublayers = sublayers;
        this.spatialReference = spatialReference;
        this._queryTasks = {};
        this._queries = {};
        this._objectIdHash = {};    // holds IDs of cached features. Is written in _onIdsReturned -> difference() call
        // holds IDs of cached features. Is written in _onIdsReturned -> difference() call
        this.objectIdCache = new ObjectIdCache();
        this.returnLimit = returnLimit || 1000;
    }

    getServiceMetadata() {
        let urls = this.filteredUrls = [];
        this.sublayers.forEach((layer) => {
            ct_array.arrayAdd(urls, layer.layerUrl);
        }, this);
        let that = this;
        let d = new Deferred();
        if (this._serviceMetadata) {
            d.resolve(this._serviceMetadata);
        }
        let requests = urls.map((url) => {
            // Use MapServer interface because FeatureServer does not deliver the details for each layer.
            // [URL]/MapServer/layers?f=json
            let newUrl = url.replace("/FeatureServer", "/MapServer");
            return apprt_request(newUrl + "/layers", {
                query: {f: "json"},
                handleAs: "json"
            });
        }, this);
        let dl = new DeferredList(requests);
        dl.then((details) => {
            let response = {details: []};
            details.forEach((detail, i) => {
                detail[1].url = that.filteredUrls[i];
                response.details.push(detail[1]);
            });
            response.sublayers = that.sublayers;
            that._serviceMetadata = response;
            d.resolve(response);
        });
        return d;
    }

    getObjectIds(sublayers, whereExpression) {
        let allQueriesDeferred = new Deferred();
        let that = this;
        let queryPromises = [];

        sublayers.forEach((layer) => {
            let layerId = layer.id;
            let singleQueryDeferred = new Deferred();
            let query = that._getQueryForLayer(layerId);
            query.objectIds = null;

            if (whereExpression) {
                query.where = whereExpression;
            }

            if (!query.geometry && !query.where) {
                query.where = '1=1';
            }

            // executeForIds will only return an array of object IDs for features that satisfy the input query
            let promise = that._getQueryTaskForLayer(layerId).executeForIds(query);
            promise.then((results) => {
                if (!results) {
                    results = [];
                }
                let res = {
                    objectIds: results,
                    layerId: layerId
                };
                singleQueryDeferred.resolve(res);
            }, (error) => {
                console.error(error);
                singleQueryDeferred.reject();
            });

            // Add Deferred for each leaf node to 'promises' in order that the application waits for all of them till execution is continued.
            queryPromises.push(singleQueryDeferred.promise);

        }, this);
        all(queryPromises).then((result) => {
            allQueriesDeferred.resolve(result);
        });
        return allQueriesDeferred;
    }

    getFeaturesByIds(objectIds, layerId, reset) {
        let d = new Deferred();
        let cacheEntry = this.objectIdCache.get(layerId);
        let uncached = FeatureServerRequester._difference(objectIds, cacheEntry.length, this._getObjectIdHashEntryForLayerId(layerId));
        this.objectIdCache.set(layerId, cacheEntry.concat(uncached));
        if (reset) {
            if (objectIds.length > 0) {
                let query = this._getQueryForLayer(layerId);
                query.where = null;
                query.geometry = null;
                let queries = [];
                if (objectIds.length > this.returnLimit) {
                    while (objectIds.length) {
                        // Improve performance by just passing list of IDs
                        // create separate queries for each 'returnLimit' number of feature IDs
                        query.objectIds = objectIds.splice(0, this.returnLimit - 1);
                        queries.push(this._getQueryTaskForLayer(layerId).execute(query));
                    }
                    all(queries).then((res) => {
                        let features = res.map((r) => {
                            return r.features;
                        });
                        d.resolve({features: FeatureServerRequester._merge(features)});
                    });
                } else {
                    // Improve performance by just passing list of IDs
                    query.objectIds = objectIds.splice(0, this.returnLimit - 1);
                    this._getQueryTaskForLayer(layerId).execute(query).then((results) => {
                        d.resolve(results);
                    });
                }
            } else {
                d.resolve({features: []});
            }
        } else {
            if ((uncached && uncached.length)) {
                let query = this._getQueryForLayer(layerId);
                query.where = null;
                query.geometry = null;
                let queries = [];
                if (uncached.length > this.returnLimit) {
                    while (uncached.length) {
                        // Improve performance by just passing list of IDs
                        // create separate queries for each 'returnLimit' number of feature IDs
                        query.objectIds = uncached.splice(0, this.returnLimit - 1);
                        queries.push(this._getQueryTaskForLayer(layerId).execute(query));
                    }
                    all(queries).then((res) => {
                        let features = res.map((r) => {
                            return r.features;
                        });
                        d.resolve({features: FeatureServerRequester._merge(features)});
                    });
                } else {
                    // Improve performance by just passing list of IDs
                    query.objectIds = uncached.splice(0, this.returnLimit - 1);
                    this._getQueryTaskForLayer(layerId).execute(query).then((results) => {
                        d.resolve(results);
                    });
                }
            } else {
                d.resolve({features: []});
            }
        }
        return d;
    }

    _getQueryTaskForLayer(layerId) {
        if (this._queryTasks[layerId]) {
            return this._queryTasks[layerId];
        }
        let url = this.sublayers.find((layer) => {
            return layerId === layer.id;
        }).layerUrl;
        let queryUrl = url + "/" + layerId.split("/")[layerId.split("/").length - 1];
        let newQueryTask = new QueryTask(queryUrl);
        this._queryTasks[layerId] = newQueryTask;
        return newQueryTask;
    }

    _getQueryForLayer(layerId) {
        if (this._queries[layerId]) {
            return this._queries[layerId];
        }
        let newQuery = new Query();
        newQuery.outSpatialReference = this.spatialReference;
        newQuery.returnGeometry = true;
        newQuery.outFields = ["*"];
        this._queries[layerId] = newQuery;
        return newQuery;
    }

    _getObjectIdHashEntryForLayerId(layerId) {
        if (!this._objectIdHash[layerId]) {
            this._objectIdHash[layerId] = {};
        }
        return this._objectIdHash[layerId];
    }

    /**
     * Is called whenever new features are received from the esrvice (_getObjectIds -> _onIdsReturned)
     * Adds new features to the hash and returns an array of only the new features.
     * @param {type} arr1
     * @param {type} cacheCount
     * @param {type} hash
     * @returns {Array}
     */
    static _difference(arr1, cacheCount, hash)
    /*objecid hash*/ {
        //let start = new Date().valueOf();
        //console.debug('difference start');
        let len = arr1.length, diff = [];
        if (!cacheCount) {
            diff = arr1;    // if no data are cached right now, all features are new.
            // if no data are cached right now, all features are new.
            while (len--) {
                // Add the current feature form the new feature object to the hash if it is not in there already.
                let value = arr1[len];
                if (!hash[value]) {
                    hash[value] = value;
                }
            }
            return diff;
        }
        while (len--) {
            // Add the current feature from the new feature object to the hash if it is not in there already.
            let val = arr1[len];
            if (!hash[val]) {
                hash[val] = val;
                diff.push(val);    // Only add new features to return array.
            }
        }
        return diff;
    }

    /**
     make a single array from multiple arrays from parameter
     */
    static _merge(arrs) {
        let len = arrs.length, target = [];
        while (len--) {
            let o = arrs[len];
            if (o.constructor === Array) {
                target = target.concat(o);
            } else {
                target.push(o);
            }
        }
        return target;
    }
}

module.exports = FeatureServerRequester;