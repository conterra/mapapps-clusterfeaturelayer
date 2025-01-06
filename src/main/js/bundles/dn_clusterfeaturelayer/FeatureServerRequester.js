/*
 * Copyright (C) 2025 con terra GmbH (info@conterra.de)
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
import Query from "esri/rest/support/Query";
import { executeForIds, executeQueryJSON } from "esri/rest/query";
import ObjectIdCache from "./ObjectIdCache";
import * as esri_lang from "esri/core/lang";

export default class FeatureServerRequester {
    constructor(sublayers, spatialReference, returnLimit, mapWidgetModel) {
        this.sublayers = sublayers;
        this.spatialReference = spatialReference;
        this._queries = {};
        this._objectIdHash = {};    // holds IDs of cached features. Is written in _onIdsReturned -> difference() call
        // holds IDs of cached features. Is written in _onIdsReturned -> difference() call
        this.objectIdCache = new ObjectIdCache();
        this.returnLimit = returnLimit;
        this.mapWidgetModel = mapWidgetModel;
    }

    getServiceMetadata() {
        const urls = this.filteredUrls = [];
        this.sublayers.forEach((layer) => {
            urls.push(layer.layerUrl);
        });
        const that = this;
        const d = new Deferred();
        if (this._serviceMetadata) {
            d.resolve(this._serviceMetadata);
        }
        const requests = urls.map((url) =>
            apprt_request(url + "/layers", {
                query: {f: "json"},
                handleAs: "json"
            })
        );
        const dl = new DeferredList(requests);
        dl.then((details) => {
            const response = {details: []};
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
        const allQueriesDeferred = new Deferred();
        const that = this;
        const queryPromises = [];

        sublayers.forEach((layer) => {
            const layerId = layer.layerId + "/" + layer.sublayerId;
            const layerTitle = layer.title || layerId;
            const singleQueryDeferred = new Deferred();
            const query = that._getQueryForLayer(layerId);
            const view = that.mapWidgetModel.get("view");
            query.objectIds = null;
            query.geometry = view && view.get("extent");
            query.spatialRelationship = Query.SPATIAL_REL_INTERSECTS;

            if (whereExpression) {
                query.where = whereExpression;
            }

            if (!query.geometry && !query.where) {
                query.where = '1=1';
            }

            // executeForIds will only return an array of object IDs for features that satisfy the input query
            const promise = executeForIds(that._getQueryUrlForLayer(layerId), query);
            promise.then((results) => {
                if (!results) {
                    results = [];
                }
                const res = {
                    objectIds: results,
                    layerId: layerId,
                    layerTitle: layerTitle
                };
                singleQueryDeferred.resolve(res);
            }, (error) => {
                console.error(error);
                singleQueryDeferred.reject();
            });

            // Add Deferred for each leaf node to 'promises' in order
            // that the application waits for all of them till execution is continued.
            queryPromises.push(singleQueryDeferred.promise);

        });
        all(queryPromises).then((result) => {
            allQueriesDeferred.resolve(result);
        });
        return allQueriesDeferred;
    }

    getFeaturesByIds(objectIds, layerId, reset) {
        const d = new Deferred();
        const cacheEntry = this.objectIdCache.get(layerId);
        const uncached = FeatureServerRequester._difference(objectIds,
            cacheEntry.length, this._getObjectIdHashEntryForLayerId(layerId));
        this.objectIdCache.set(layerId, cacheEntry.concat(uncached));
        if (reset) {
            if (objectIds.length > 0) {
                const query = this._getQueryForLayer(layerId);
                query.where = null;
                query.geometry = null;
                const queries = [];
                if (objectIds.length > this.returnLimit) {
                    while (objectIds.length) {
                        // Improve performance by just passing list of IDs
                        // create separate queries for each 'returnLimit' number of feature IDs
                        query.objectIds = objectIds.splice(0, this.returnLimit - 1);
                        queries.push(executeQueryJSON(this._getQueryUrlForLayer(layerId), esri_lang.clone(query)));
                    }
                    all(queries).then((res) => {
                        const features = res.map((r) => r.features);
                        d.resolve({features: FeatureServerRequester._merge(features)});
                    });
                } else {
                    // Improve performance by just passing list of IDs
                    query.objectIds = objectIds.splice(0, this.returnLimit - 1);
                    executeQueryJSON(this._getQueryUrlForLayer(layerId), esri_lang.clone(query)).then((results) => {
                        d.resolve(results);
                    });
                }
            } else {
                d.resolve({features: []});
            }
        } else {
            if ((uncached && uncached.length)) {
                const query = this._getQueryForLayer(layerId);
                query.where = null;
                query.geometry = null;
                const queries = [];
                if (uncached.length > this.returnLimit) {
                    while (uncached.length) {
                        // Improve performance by just passing list of IDs
                        // create separate queries for each 'returnLimit' number of feature IDs
                        query.objectIds = uncached.splice(0, this.returnLimit - 1);
                        queries.push(executeQueryJSON(this._getQueryUrlForLayer(layerId), esri_lang.clone(query)));
                    }
                    all(queries).then((res) => {
                        const features = res.map((r) => r.features);
                        d.resolve({features: FeatureServerRequester._merge(features)});
                    });
                } else {
                    // Improve performance by just passing list of IDs
                    query.objectIds = uncached.splice(0, this.returnLimit - 1);
                    executeQueryJSON(this._getQueryUrlForLayer(layerId), esri_lang.clone(query)).then((results) => {
                        d.resolve(results);
                    });
                }
            } else {
                d.resolve({features: []});
            }
        }
        return d;
    }

    _getQueryUrlForLayer(layerId) {
        const sublayer = this.sublayers.find((layer) => layerId === layer.layerId + "/" + layer.sublayerId);
        const url = sublayer.layerUrl;
        const id = sublayer.sublayerId;
        return url + "/" + id;
    }

    _getQueryForLayer(layerId) {
        if (this._queries[layerId]) {
            return this._queries[layerId];
        }
        const newQuery = new Query();
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
        let len = arr1.length;
        let diff = [];
        if (!cacheCount) {
            diff = arr1;    // if no data are cached right now, all features are new.
            // if no data are cached right now, all features are new.
            while (len--) {
                // Add the current feature form the new feature object to the hash if it is not in there already.
                const value = arr1[len];
                if (!hash[value]) {
                    hash[value] = value;
                }
            }
            return diff;
        }
        while (len--) {
            // Add the current feature from the new feature object to the hash if it is not in there already.
            const val = arr1[len];
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
        let len = arrs.length;
        let target = [];
        while (len--) {
            const o = arrs[len];
            if (o.constructor === Array) {
                target = target.concat(o);
            } else {
                target.push(o);
            }
        }
        return target;
    }
}
