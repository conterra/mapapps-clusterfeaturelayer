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
/*
 Changed by con terra
 *
 * Class hierarchy
 *
 * esri/layers/Layer
 * |_esri/layers/GraphicsLayer
 *  |_ClusterFeatureLayer
 */
import Deferred from "dojo/_base/Deferred";
import all from "dojo/promise/all";
import geometryEngine from "esri/geometry/geometryEngine";
import Point from "esri/geometry/Point";
import Polygon from "esri/geometry/Polygon";
import Extent from "esri/geometry/Extent";
import GraphicsLayer from "esri/layers/GraphicsLayer"
import * as WatchUtils from "esri/core/watchUtils"
import * as ClusterGeometryFunctions from "./ClusterGeometryFunctions";
import FeatureServerRequester from "./FeatureServerRequester";
import ServiceMetadataProvider from "./ServiceMetadataProvider";
import ClusterGraphicsFactory from "./ClusterGraphicsFactory";

export default GraphicsLayer.createSubclass({
    declaredClass: "esri.layers.GraphicsLayer",
    properties: {},
    constructor: function (args) {
        this.sublayers = args.sublayers;

        this._clusterData = {};
        this._clusters = [];
        this._clusterCache = {};
        this._visitedExtent = null;

        this._options = args._options;
        this._layerId = args._layerId;
        this._objectIdField = args._objectIdField;
        this._clusterDistance = args._clusterDistance;
        this._spiderfyingDistance = args._spiderfyingDistance;
        this._maxClusterScale = args._maxClusterScale;
        this._showClusterArea = args._showClusterArea;
        this._serverRequester = args._serverRequester;
        this._mapWidgetModel = args._mapWidgetModel;
        this._clusterGraphicsFactory = args._clusterGraphicsFactory;
        this._clusterSymbolProvider = args._clusterSymbolProvider;
        this._featureSymbolProvider = args._featureSymbolProvider;
        this._popupTemplate = args._popupTemplate;
        this._eventService = args._eventService;
        this.i18n = args.i18n;

        this._initDataStructures(this.sublayers);

        let mapWidgetModel = this._mapWidgetModel;
        if (mapWidgetModel) {
            this._waitForWkid(mapWidgetModel);
        }
    },

    _waitForWkid: function (mapWidgetModel) {
        let that = this;
        let sr = mapWidgetModel.get("spatialReference");
        if (sr) {
            this.wkid = sr.latestWkid || sr.wkid;
            that._initListener();
        } else {
            mapWidgetModel.watch("spatialReference", (spatialReference) => {
                if (spatialReference.value) {
                    this.wkid = spatialReference.value.latestWkid || spatialReference.value.wkid;
                    that._initListener();
                }
            });
        }
    },

    _initListener: function () {
        let that = this;
        let mapWidgetModel = this._mapWidgetModel;
        let requester = that._serverRequester = new FeatureServerRequester(that.sublayers, {wkid: that.wkid});
        requester.getServiceMetadata().then((serviceDetails) => {
            if (that.events && that.events.length > 0) {
                that.events.forEach((event) => {
                    event.remove();
                });
                that.events = [];
            }

            that.events = [];
            let metadataProvider = that._getServiceMetadataProvider(serviceDetails);
            that._clusterGraphicsFactory = that._getClusterGraphicsFactory(that._clusterSymbolProvider, that._featureSymbolProvider, metadataProvider, mapWidgetModel, that._popupTemplate, that._options);
            let view = mapWidgetModel.get("view");
            let map = mapWidgetModel.get("map");
            that.events.push(map.allLayers.on("change", (event) => {
                that._reCluster({forceReinit: true});
            }));
            that.sublayers.forEach((layer) => {
                that.events.push(WatchUtils.watch(layer, "visible", () => {
                    that._reCluster({forceReinit: true});
                }));
            });
            that.events.push(view.watch("stationary", (response) => {
                if (response) {
                    that._reCluster();
                }
            }));
            that.events.push(view.on("pointer-down", (event) => {
                that._handleClick(event);
            }));
            that.events.push(view.on("pointer-move", (event) => {
                that._clusterMouseOver(event);
            }));
            that.events.push(mapWidgetModel.watch("view", () => {
                that._initListener();
            }));
            that._reCluster({forceReinit: true});
        });
    },

    _initDataStructures: function (sublayers) {
        sublayers.forEach((layer) => {
            let layerId = layer.layerId + "/" + layer.sublayerId;
            this._clusterCache[layerId] = {};
            this._clusterData[layerId] = [];
        });
    },

    setData: function (objectIds) {
        this._predefinedObjectIds = objectIds;
        this.clearClusters();
        this._initDataStructures(this.sublayers);
        this._reCluster({forceReinit: true});
    },

    setMapWidgetModel: function (mapWidgetModel) {
        this._mapWidgetModel = mapWidgetModel;
        this._waitForWkid(mapWidgetModel);
    },

    /**
     * Method to recluster.
     */
    _reCluster: function (options) {
        if (!this._mapWidgetModel) {
            return;
        }
        let view = this._mapWidgetModel.get("view");
        let mapExtent = view && view.get("extent");
        if (mapExtent) {
            let scale = this._mapWidgetModel.get("scale");
            if (scale) {
                if (scale <= this.maxClusterScale) {
                    this._clusterTolerance = 0;
                } else {
                    this._clusterTolerance = this._clusterDistance;
                }
            } else {
                this._clusterTolerance = this._clusterDistance;
            }
            let visitedExtent = this._visitedExtent;
            let beenThereBefore = visitedExtent && visitedExtent.contains(mapExtent);

            // When zooming remove the graphics before the timeout and the server request is started.
            // This avoids flickering of the cluster graphics.
            this.clearClusters();

            // reclustering is started asynchronously to prevent UI freeze and some displaying bugs
            let that = this;
            let clusterTimeout;
            clearTimeout(clusterTimeout);
            clusterTimeout = setTimeout(() => {
                if (!options) {
                    options = {};
                }
                if (!that._isInProgress) {
                    that._isInProgress = true;
                    if (!beenThereBefore || options.forceReinit === true) {
                        console.log("recluster + getfeatures");
                        that._getFeaturesFromServer().then(() => {
                            // update clustered extent
                            that._visitedExtent = visitedExtent ? visitedExtent.union(mapExtent) : mapExtent;
                            that._clusterGraphics();
                            that._isInProgress = false;
                        });
                    } else {
                        console.log("recluster");
                        that._clusterGraphics();
                        that._isInProgress = false;
                    }
                }
            }, 0);
        } else {
            this._isInProgress = false;
        }
    },

    _unsetMap: function () {
        this._extentChangeSignal.remove();
        return this.inherited(arguments);
    },

    _getFeaturesFromServer: function () {
        let that = this;
        let requester = this._serverRequester;
        let finalDeferred = new Deferred();

        if (this._predefinedObjectIds) {
            let allDeferreds = [];
            this._predefinedObjectIds.forEach((result) => {
                let d = new Deferred();
                allDeferreds.push(d);
                requester.getFeaturesByIds(result.objectIds, result.layerId, true).then((featuresResult) => {
                    that._addFeaturesToClusterCache(featuresResult, result.layerId);
                    d.resolve();
                }, (error) => {
                    console.error(error);
                });
            });
            all(allDeferreds).then(() => {
                finalDeferred.resolve();
            }, (error) => {
                console.error(error);
            });
        } else {
            requester.getObjectIds(this.sublayers).then((results) => {
                let allDeferreds = [];
                results.forEach((result) => {
                    let d = new Deferred();
                    allDeferreds.push(d);
                    requester.getFeaturesByIds(result.objectIds, result.layerId).then((featuresResult) => {
                        that._addFeaturesToClusterCache(featuresResult, result.layerId);
                        d.resolve();
                    }, (error) => {
                        console.error(error);
                    });
                });
                all(allDeferreds).then(() => {
                    finalDeferred.resolve();
                }, (error) => {
                    console.error(error);
                });
            }, (error) => {
                console.error(error);
            });
        }
        return finalDeferred;
    },

    _getCachedFeaturesInExtent: function (layerId) {
        let extent = this._getNormalizedExtentsPolygon();
        let len = this._serverRequester.objectIdCache.get(layerId).length;
        let featuresInExtent = [];    // See if cached feature is in current extent
        // See if cached feature is in current extent
        while (len--) {
            let oid = this._serverRequester.objectIdCache.get(layerId)[len];
            let cached = this._clusterCache[layerId][oid];
            if (cached && extent.contains(cached.geometry)) {
                featuresInExtent.push(cached);
            }
        }
        return featuresInExtent;
    },

    /**
     * Method to add features to cluster cache and refine cluster data to draw - clears all graphics!
     * WRITES this._clusterData and this._clusterCache
     *
     * @param result
     * @param layerId
     * @private
     */
    _addFeaturesToClusterCache: function (result, layerId) {
        // get features from cache (features that have been requested before)
        let cachedFeaturesInExtent = this._getCachedFeaturesInExtent(layerId);
        let newFeaturesInExtent;
        if (result.features && result.features.length > 0) {
            if (this.native_geometryType === "esriGeometryPolygon") {
                newFeaturesInExtent = ClusterGeometryFunctions.toPointGraphics(result.features);
            } else {
                newFeaturesInExtent = result.features;
            }
            let len = newFeaturesInExtent.length;
            // Update the cluster features for drawing
            if (len) {
                // Append actual feature to cluster cache
                newFeaturesInExtent.forEach((feat) => {
                    let featureId = feat.attributes[this._objectIdField];
                    this._clusterCache[layerId][featureId] = feat;
                    feat.layerId = layerId;
                });
                // Refine features to draw
                this._clusterData[layerId] = newFeaturesInExtent.concat(cachedFeaturesInExtent);
            }
        }
    },

    /**
     * Method to build new cluster array from features and draw graphics.
     */
    _clusterGraphics: function () {
        // test against a modified/scrubbed map extent polygon geometry
        let testExtent = this._getNormalizedExtentsPolygon();
        // first time through, loop through the points
        this.sublayers.forEach((layerObject) => {
            let layerId = layerObject.layerId + "/" + layerObject.sublayerId;
            let nodeAndParentsEnabledTemp = this.nodeAndParentsEnabled(layerId);
            let clusterData = this._clusterData;
            let currentLength = clusterData[layerId].length;
            for (let j = 0; j < currentLength; j++) {
                // see if the current feature should be added to a cluster
                let feature = clusterData[layerId][j];
                let point = feature.geometry || feature;
                // if current feature is NOT in geo-extent don't add it to clusters to draw
                if (!testExtent.contains(point)) {
                    continue;
                }
                /**
                 * CLUSTERING ALGORITHM
                 * */
                // if node is enabled add feature to clusters or create a new cluster
                if (nodeAndParentsEnabledTemp) {
                    let clustered = false;
                    // Add point to existing cluster
                    for (let i = 0; i < this._clusters.length; i++) {
                        let c = this._clusters[i];
                        let clusterResolution = this._mapWidgetModel.extent.width / this._mapWidgetModel.width;
                        if (ClusterGeometryFunctions.clusterTest(point, c, this._clusterTolerance, clusterResolution)) {
                            this._clusterAddPoint(feature, point, c);
                            clustered = true;
                            break;
                        }
                    }
                    // Or create a new cluster if feature cannot be added to an existing cluster
                    if (!clustered) {
                        this._clusterCreate(feature, point);
                    }
                }
            }
        });
        this._addGraphicsToLayer(this._clusters);
    },

    _addGraphicsToLayer: function () {
        this._clusters.forEach((cluster) => {
            // refresh cluster graphics
            this._addClusterGraphics(cluster);
            // check for spiderfying
            this._addSpiderfyingGraphics(cluster);
        });
    },

    _addClusterGraphics: function (cluster) {
        if (cluster.clusterGraphics) {
            cluster.clusterGraphics.forEach((graphic) => {
                this.remove(graphic);
            });
        }
        let clusterGraphics = cluster.clusterGraphics = this._clusterGraphicsFactory.getClusterGraphics(cluster, this._clusters);
        this.addMany(clusterGraphics);
    },

    _addSpiderfyingGraphics: function (cluster) {
        let features = cluster.attributes.features;
        let clusterCenterPoint = new Point(cluster.x, cluster.y, cluster.spatialReference);
        let clusterResolution = this._mapWidgetModel.extent.width / this._mapWidgetModel.width;
        if (!ClusterGeometryFunctions.haveSamePosition(features, clusterCenterPoint, this._spiderfyingDistance)) {
            return;
        }
        if (features.length > 1) {
            cluster.attributes.spiderfying = true;
            if (cluster.clusterGraphics) {
                cluster.clusterGraphics.forEach((clusterGraphic) => {
                    this.remove(clusterGraphic);
                });
            }
            let spiderfyingGraphics = cluster.clusterGraphics = this._clusterGraphicsFactory.getSpiderfyingGraphics(cluster);
            this.addMany(spiderfyingGraphics);
        }
    },

    /**
     * Method to add a point to an existing cluster.
     *
     * @param feature feature
     * @param p point
     * @param cluster cluster
     * @private
     */
    _clusterAddPoint: function (feature, p, cluster) {
        // points passed to clusterAddPoint should be included
        // in an existing cluster
        // that corresponds to its cluster
        // Average in the new point to the cluster geometry
        let count, x, y;
        count = cluster.attributes.clusterCount;
        x = (p.x + cluster.x * count) / (count + 1);
        y = (p.y + cluster.y * count) / (count + 1);
        cluster.x = x;
        cluster.y = y;
        let clusterExtent = cluster.attributes.extent;
        // Build an extent that includes all points in a cluster
        if (p.x < clusterExtent[0]) {
            clusterExtent[0] = p.x;
        } else if (p.x > clusterExtent[2]) {
            clusterExtent[2] = p.x;
        }
        if (p.y < clusterExtent[1]) {
            clusterExtent[1] = p.y;
        } else if (p.y > clusterExtent[3]) {
            clusterExtent[3] = p.y;
        }
        // Increment the count
        cluster.attributes.clusterCount++;
        // attributes might not exist
        if (!p.hasOwnProperty("attributes")) {
            p.attributes = {};
        }
        // add feature data to cluster
        cluster.attributes.features.push(feature);
    },

    /**
     * Method to create a new cluster if the point isn't within the clustering distance specified for the layer.
     * TODO: Random and not based on grid dispersion!
     */
    _clusterCreate: function (feature, p) {
        let clusterId = this._clusters.length + 1;
        if (!p.attributes) {
            p.attributes = {};
        }
        // create the cluster
        let cluster = {
            x: p.x,
            y: p.y,
            spatialReference: feature.geometry.spatialReference,
            attributes: {
                clusterCount: 1,
                clusterId: clusterId,
                extent: [
                    p.x,
                    p.y,
                    p.x,
                    p.y
                ],
                features: [feature]
            }
        };
        this._clusters.push(cluster);
    },

    _handleClick: function (event) {
        let that = this;
        let view = this._mapWidgetModel.get("view");
        view.hitTest(event).then((response) => {
            if (response.results.length === 0) {
                return;
            }
            let graphic = response.results[0].graphic;
            if (graphic) {
                that._eventService.postEvent("dn_clusterfeaturelayer/GRAPHIC_CLICKED", {
                    attributes: graphic.attributes,
                    geometry: graphic.geometry
                });
            }
            let attributes = graphic && graphic.attributes;
            if (!attributes) {
                return;
            }
            if (attributes.hasOwnProperty("features")) {
                if (attributes.spiderfying) {
                    let features = attributes.features;
                    let clusterCenterPoint = new Point(graphic.geometry.x, graphic.geometry.y, graphic.geometry.spatialReference);
                    if (ClusterGeometryFunctions.haveSamePosition(features, clusterCenterPoint, that._spiderfyingDistance)) {
                        that._eventService.postEvent("dn_clusterfeaturelayer/SPIDERFYING_CLICKED", {
                            attributes: graphic.attributes,
                            geometry: graphic.geometry
                        });
                    }
                } else {
                    let extent = attributes.extent;
                    let clusterExtent = new Extent(extent[0], extent[1], extent[2], extent[3], view.spatialReference).expand(1.5);
                    view.goTo({target: clusterExtent}, {
                        "animate": true,
                        "duration": 1000,
                        "easing": "ease-in-out"
                    });
                }

            }
        });
    },

    _clusterMouseOver: function (event) {
        if (this._showClusterArea) {
            let view = this._mapWidgetModel.get("view");
            view.hitTest(event).then((response) => {
                let attributes = response.results[0] && response.results[0].graphic.attributes;
                if (attributes) {
                    this._drawClusterArea(attributes);
                } else {
                    this._hideClusterArea();
                }
            });
        }
    },

    _drawClusterArea: function (attributes) {
        if (this.getCluster(attributes)) {
            let points = attributes.features.map((feature) => {
                return feature.geometry;
            });
            let clusterArea = geometryEngine.convexHull(points, true);
            //use convex hull on the points to get the boundary
            this._hideClusterArea();
            if (clusterArea[0] && !this.clusterAreaGraphic) {
                let clusterAreaGraphic = this.clusterAreaGraphic = this._clusterGraphicsFactory.getAreaGraphic(clusterArea[0]);
                this.add(clusterAreaGraphic);
                clusterAreaGraphic.set("visible", true);
            }
        }
    },

    _hideClusterArea: function (event) {
        let clusterAreaGraphic = this.clusterAreaGraphic;
        if (clusterAreaGraphic) {
            this.remove(clusterAreaGraphic);
            this.clusterAreaGraphic = null;
        }
    },

    getCluster: function (attributes) {
        let res = null;
        this._clusters.forEach((cluster) => {
            if (cluster.attributes.clusterId === attributes.clusterId && cluster.attributes.clusterCount === attributes.clusterCount) {
                res = cluster;
            }
        });
        return res;
    },

    /**
     * Method to normalize map extent and deal with up to 2 Extent geom objects,
     * convert to Polygon geom objects,
     * and combine into a master Polygon geom object to test against.
     *
     * @returns {*} masterpolygon
     * @private
     */
    _getNormalizedExtentsPolygon: function () {
        let view = this._mapWidgetModel.get("view");
        let spatialReference = this._mapWidgetModel.get("spatialReference");
        let normalizedExtents = view.get("extent").normalize();
        let normalizedExtentPolygons = normalizedExtents.map((extent) => {
            return Polygon.fromExtent(extent);
        });
        let masterPolygon = new Polygon(spatialReference);
        normalizedExtentPolygons.forEach((polygon) => {
            masterPolygon.addRing(polygon.rings[0]);
        });
        return masterPolygon;
    },

    clearClusters: function () {
        this.removeAll();
        // clear array with calculated clusters
        this._clusters = [];
    },

    nodeAndParentsEnabled: function (layerId) {
        let that = this;
        let layer = that.sublayers.find((layer) => {
            return layer.layerId + "/" + layer.sublayerId === layerId;
        });
        return that.visible && layer.visible;
    },


    _getClusterGraphicsFactory: function (clusterSymbolProvider, featureSymbolProvider, metadataProvider, mapWidgetModel, popupTemplate, options) {
        return new ClusterGraphicsFactory(clusterSymbolProvider, featureSymbolProvider, metadataProvider, mapWidgetModel, popupTemplate, options);
    },

    _getServiceMetadataProvider: function (serviceDetails) {
        return new ServiceMetadataProvider(serviceDetails);
    }
});
