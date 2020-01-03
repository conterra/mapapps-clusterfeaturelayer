/*
 * Copyright (C) 2019 con terra GmbH (info@conterra.de)
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
import ct_lang from "ct/_lang";
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
    constructor(args) {
        this.sublayers = args.sublayers;

        this._clusterData = {};
        this._clusters = [];
        this._clusterCache = {};
        this._visitedExtent = null;

        this._options = args._options;
        this._objectIdField = args._objectIdField;
        this._clusterDistance = args._clusterDistance;
        this._spiderfyingDistance = args._spiderfyingDistance;
        this._maxClusterScale = args._maxClusterScale;
        this._showClusterArea = args._showClusterArea;
        this._returnLimit = args._returnLimit;
        this._serverRequester = args._serverRequester;
        this._mapWidgetModel = args._mapWidgetModel;
        this._clusterGraphicsFactory = args._clusterGraphicsFactory;
        this._clusterSymbolProvider = args._clusterSymbolProvider;
        this._featureSymbolProvider = args._featureSymbolProvider;
        this._popupTemplate = args._popupTemplate;
        this._eventService = args._eventService;
        this.i18n = args.i18n;

        const mapWidgetModel = this._mapWidgetModel;
        if (mapWidgetModel) {
            this._waitForWkid(mapWidgetModel);
        }
    },

    _waitForWkid(mapWidgetModel) {
        const that = this;
        const sr = mapWidgetModel.get("spatialReference");
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

    _initListener() {
        const mapWidgetModel = this._mapWidgetModel;
        const requester = this._serverRequester = new FeatureServerRequester(this.sublayers, {wkid: this.wkid}, this._returnLimit, mapWidgetModel);
        requester.getServiceMetadata().then((serviceDetails) => {
            if (this.events && this.events.length > 0) {
                this.events.forEach((event) => {
                    event.remove();
                });
                this.events = [];
            }

            this.events = [];
            const metadataProvider = this._getServiceMetadataProvider(serviceDetails);
            this._clusterGraphicsFactory = this._getClusterGraphicsFactory(this._clusterSymbolProvider, this._featureSymbolProvider, metadataProvider, mapWidgetModel, this._popupTemplate, this._options);
            const view = mapWidgetModel.get("view");
            const map = mapWidgetModel.get("map");
            this.events.push(map.allLayers.on("change", () => {
                this._reCluster({forceReinit: true});
            }));
            this.sublayers.forEach((layer) => {
                this.events.push(WatchUtils.watch(layer, "visible", () => {
                    this._reCluster({forceReinit: true});
                }));
            });
            this.events.push(view.watch("stationary", (response) => {
                if (response) {
                    this._reCluster();
                }
            }));
            this.events.push(view.on("pointer-down", (event) => {
                this._handleClick(event);
            }));
            this.events.push(view.on("pointer-move", (event) => {
                this._clusterMouseOver(event);
            }));
            this.events.push(mapWidgetModel.watch("view", () => {
                this._initListener();
            }));
            this._reCluster({forceReinit: true});
        });
    },

    initDataStructures(sublayers) {
        sublayers = sublayers || this.sublayers;
        sublayers.forEach((layer) => {
            const layerId = layer.layerId + "/" + layer.sublayerId;
            this._clusterCache[layerId] = {};
            this._clusterData[layerId] = [];
        });
    },

    setData(objectIds) {
        this._predefinedObjectIds = objectIds;
        // clear array with calculated clusters
        this._clusters = [];
        this.initDataStructures(this.sublayers);
        this._reCluster({forceReinit: true});
    },

    setMapWidgetModel(mapWidgetModel) {
        this._mapWidgetModel = mapWidgetModel;
        this._waitForWkid(mapWidgetModel);
    },

    /**
     * Method to recluster.
     */
    _reCluster(options) {
        if (!this._mapWidgetModel) {
            return;
        }
        const view = this._mapWidgetModel.get("view");
        const mapExtent = view && view.get("extent");
        if (mapExtent) {
            const scale = this._mapWidgetModel.get("scale");
            if (scale) {
                if (scale <= this._maxClusterScale) {
                    this._clusterTolerance = 0;
                } else {
                    this._clusterTolerance = this._clusterDistance;
                }
            } else {
                this._clusterTolerance = this._clusterDistance;
            }
            const visitedExtent = this._visitedExtent;
            const beenThereBefore = visitedExtent && visitedExtent.contains(mapExtent);

            // reclustering is started asynchronously to prevent UI freeze and some displaying bugs
            const that = this;
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

    _unsetMap() {
        this._extentChangeSignal.remove();
        return this.inherited(arguments);
    },

    _getFeaturesFromServer() {
        const that = this;
        const requester = this._serverRequester;
        const finalDeferred = new Deferred();

        if (this._predefinedObjectIds) {
            const allDeferreds = [];
            this._predefinedObjectIds.forEach((result) => {
                const d = new Deferred();
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
                const allDeferreds = [];
                results.forEach((result) => {
                    const d = new Deferred();
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

    _getCachedFeaturesInExtent(layerId) {
        const extent = this._getNormalizedExtentsPolygon();
        let len = this._serverRequester.objectIdCache.get(layerId).length;
        const featuresInExtent = [];    // See if cached feature is in current extent
        // See if cached feature is in current extent
        while (len--) {
            const oid = this._serverRequester.objectIdCache.get(layerId)[len];
            const cached = this._clusterCache[layerId][oid];
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
    _addFeaturesToClusterCache(result, layerId) {
        // get features from cache (features that have been requested before)
        const cachedFeaturesInExtent = this._getCachedFeaturesInExtent(layerId);
        let newFeaturesInExtent;
        if (result.features && result.features.length > 0) {
            newFeaturesInExtent = result.features;
            const len = newFeaturesInExtent.length;
            // Update the cluster features for drawing
            if (len) {
                // Append actual feature to cluster cache
                newFeaturesInExtent.forEach((feat) => {
                    const featureId = feat.attributes[this._objectIdField];
                    this._clusterCache[layerId][featureId] = feat;
                    feat.layerId = layerId;
                });
                // Refine features to draw
                this._clusterData[layerId] = newFeaturesInExtent.concat(cachedFeaturesInExtent);
            }
        }
        this._setLayerExtent();
    },

    /**
     * Method to build new cluster array from features and draw graphics.
     */
    _clusterGraphics() {
        // clear array with calculated clusters
        this._clusters = [];
        // test against a modified/scrubbed map extent polygon geometry
        const testExtent = this._getNormalizedExtentsPolygon();
        // first time through, loop through the points
        this.sublayers.forEach((layerObject) => {
            const layerId = layerObject.layerId + "/" + layerObject.sublayerId;
            const nodeAndParentsEnabledTemp = this.nodeAndParentsEnabled(layerId);
            const clusterData = this._clusterData;
            const currentLength = clusterData[layerId].length;
            for (let j = 0; j < currentLength; j++) {
                // see if the current feature should be added to a cluster
                const feature = clusterData[layerId][j];
                const point = feature.geometry || feature;
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
                        const c = this._clusters[i];
                        const clusterResolution = this._mapWidgetModel.extent.width / this._mapWidgetModel.width;
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

    _setLayerExtent() {
        const clusterData = this._clusterData;
        let extent = null;
        ct_lang.forEachOwnProp(clusterData, (v) => {
            if (v.length) {
                v.forEach((feature) => {
                    const e = feature.geometry.extent;
                    if (!extent) {
                        extent = e;
                    } else {
                        extent.union(e);
                    }
                });
            }
        });
        this.set("fullExtent", extent);
    },

    _addGraphicsToLayer() {
        // When zooming remove the graphics before the timeout and the server request is started.
        // This avoids flickering of the cluster graphics.
        this.removeAll();
        this._clusters.forEach((cluster) => {
            const features = cluster.attributes.features;
            const clusterCenterPoint = new Point(cluster.x, cluster.y, cluster.spatialReference);
            if (ClusterGeometryFunctions.haveSamePosition(features, clusterCenterPoint, this._spiderfyingDistance) && features.length > 1) {
                // check for spiderfying
                this._addSpiderfyingGraphics(cluster);
            } else {
                // refresh cluster graphics
                this._addClusterGraphics(cluster);
            }
        });
    },

    _addClusterGraphics(cluster) {
        const clusterGraphics = this._clusterGraphicsFactory.getClusterGraphics(cluster, this._clusters);
        this.addMany(clusterGraphics);
    },

    _addSpiderfyingGraphics(cluster) {
        cluster.attributes.spiderfying = true;
        const spiderfyingGraphics = this._clusterGraphicsFactory.getSpiderfyingGraphics(cluster);
        this.addMany(spiderfyingGraphics);
    },

    /**
     * Method to add a point to an existing cluster.
     *
     * @param feature feature
     * @param p point
     * @param cluster cluster
     * @private
     */
    _clusterAddPoint(feature, p, cluster) {
        // points passed to clusterAddPoint should be included
        // in an existing cluster
        // that corresponds to its cluster
        // Average in the new point to the cluster geometry
        const count = cluster.attributes.clusterCount;
        const x = (p.x + cluster.x * count) / (count + 1);
        const y = (p.y + cluster.y * count) / (count + 1);
        cluster.x = x;
        cluster.y = y;
        const clusterExtent = cluster.attributes.extent;
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
    _clusterCreate(feature, p) {
        const clusterId = this._clusters.length + 1;
        if (!p.attributes) {
            p.attributes = {};
        }
        // create the cluster
        const cluster = {
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

    _handleClick(event) {
        const that = this;
        const view = this._mapWidgetModel.get("view");
        view.hitTest(event).then((response) => {
            if (response.results.length === 0) {
                return;
            }
            const graphic = response.results[0].graphic;
            if (graphic) {
                that._eventService.postEvent("dn_clusterfeaturelayer/GRAPHIC_CLICKED", {
                    attributes: graphic.attributes,
                    geometry: graphic.geometry
                });
            }
            const attributes = graphic && graphic.attributes;
            if (!attributes) {
                return;
            }
            if (attributes.hasOwnProperty("features")) {
                if (attributes.spiderfying) {
                    const features = attributes.features;
                    const clusterCenterPoint = new Point(graphic.geometry.x, graphic.geometry.y, graphic.geometry.spatialReference);
                    if (ClusterGeometryFunctions.haveSamePosition(features, clusterCenterPoint, that._spiderfyingDistance)) {
                        that._eventService.postEvent("dn_clusterfeaturelayer/SPIDERFYING_CLICKED", {
                            attributes: graphic.attributes,
                            geometry: graphic.geometry
                        });
                    }
                } else {
                    const extent = attributes.extent;
                    const clusterExtent = new Extent(extent[0], extent[1], extent[2], extent[3], view.spatialReference).expand(1.5);
                    view.goTo({target: clusterExtent}, {
                        "animate": true,
                        "duration": 1000,
                        "easing": "ease-in-out"
                    });
                }
            }
        });
    },

    _clusterMouseOver(event) {
        if (this._showClusterArea) {
            const view = this._mapWidgetModel.get("view");
            view.hitTest(event).then((response) => {
                const attributes = response.results[0] && response.results[0].graphic.attributes;
                if (attributes) {
                    this._drawClusterArea(attributes);
                } else {
                    this._hideClusterArea();
                }
            });
        }
    },

    _drawClusterArea(attributes) {
        if (this.getCluster(attributes)) {
            const points = attributes.features.map((feature) => feature.geometry);
            const clusterArea = geometryEngine.convexHull(points, true);
            //use convex hull on the points to get the boundary
            this._hideClusterArea();
            if (clusterArea[0] && !this.clusterAreaGraphic) {
                const clusterAreaGraphic = this.clusterAreaGraphic = this._clusterGraphicsFactory.getAreaGraphic(clusterArea[0]);
                this.add(clusterAreaGraphic);
                clusterAreaGraphic.set("visible", true);
            }
        }
    },

    _hideClusterArea(event) {
        const clusterAreaGraphic = this.clusterAreaGraphic;
        if (clusterAreaGraphic) {
            this.remove(clusterAreaGraphic);
            this.clusterAreaGraphic = null;
        }
    },

    getCluster(attributes) {
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
    _getNormalizedExtentsPolygon() {
        const view = this._mapWidgetModel.get("view");
        const spatialReference = this._mapWidgetModel.get("spatialReference");
        const normalizedExtents = view.get("extent").normalize();
        const normalizedExtentPolygons = normalizedExtents.map((extent) => Polygon.fromExtent(extent));
        const masterPolygon = new Polygon(spatialReference);
        normalizedExtentPolygons.forEach((polygon) => {
            masterPolygon.addRing(polygon.rings[0]);
        });
        return masterPolygon;
    },

    nodeAndParentsEnabled(layerId) {
        const that = this;
        const layer = that.sublayers.find((layer) => layer.layerId + "/" + layer.sublayerId === layerId);
        return that.visible && layer.visible;
    },


    _getClusterGraphicsFactory(clusterSymbolProvider, featureSymbolProvider, metadataProvider, mapWidgetModel, popupTemplate, options) {
        return new ClusterGraphicsFactory(clusterSymbolProvider, featureSymbolProvider, metadataProvider, mapWidgetModel, popupTemplate, options);
    },

    _getServiceMetadataProvider(serviceDetails) {
        return new ServiceMetadataProvider(serviceDetails);
    }
});
