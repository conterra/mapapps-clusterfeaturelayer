/*
 * Copyright (C) 2022 con terra GmbH (info@conterra.de)
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
import ct_lang from "ct/_lang";
import {convexHull} from "esri/geometry/geometryEngine";
import Point from "esri/geometry/Point";
import Polygon from "esri/geometry/Polygon";
import Extent from "esri/geometry/Extent";
import GraphicsLayer from "esri/layers/GraphicsLayer"
import * as WatchUtils from "esri/core/watchUtils"
import * as ClusterGeometryFunctions from "./ClusterGeometryFunctions";
import FeatureServerRequester from "./FeatureServerRequester";
import ServiceMetadataProvider from "./ServiceMetadataProvider";
import ClusterGraphicsFactory from "./ClusterGraphicsFactory";
import async from "apprt-core/async";

export default GraphicsLayer.createSubclass({
    declaredClass: "esri.layers.GraphicsLayer",
    properties: {},
    constructor(args) {
        this._clusterData = {};
        this._popupTemplates = {};
        this._clusters = [];
        this._clusterCache = {};
        this._visitedExtent = null;

        this._options = args._options;
        this._objectIdField = args._objectIdField;
        this._clusterDistance = args._clusterDistance;
        this._spiderfyingDistance = args._spiderfyingDistance;
        this._maxClusterScale = args._maxClusterScale;
        this._showClusterArea = args._showClusterArea;
        this._showSpiderfying = args._showSpiderfying;
        this._zoomOnClusterClick = args._zoomOnClusterClick;
        this._returnLimit = args._returnLimit;
        this._serverRequester = args._serverRequester;
        this._mapWidgetModel = args._mapWidgetModel;
        this._clusterGraphicsFactory = args._clusterGraphicsFactory;
        this._clusterSymbolProvider = args._clusterSymbolProvider;
        this._featureSymbolProvider = args._featureSymbolProvider;
        this._eventService = args._eventService;
        this._i18n = args.i18n;
    },

    activateLayer() {
        const mapWidgetModel = this._mapWidgetModel;
        if (!mapWidgetModel) {
            return;
        }
        this._getView().then(() => {
            const spatialReference = mapWidgetModel.spatialReference;
            this.wkid = spatialReference.latestWkid || spatialReference.wkid;
            this._initListener();
        });
    },

    fetchSublayerInfo() {
        // do nothing
    },

    _getView() {
        const mapWidgetModel = this._mapWidgetModel;
        return new Promise((resolve) => {
            if (mapWidgetModel.view) {
                resolve(mapWidgetModel.view);
            } else {
                mapWidgetModel.watch("view", ({value: view}) => {
                    resolve(view);
                });
            }
        });
    },

    _initListener() {
        this.initDataStructures(this.sublayers);
        const mapWidgetModel = this._mapWidgetModel;
        const requester = this._serverRequester = new FeatureServerRequester(
            this.sublayers, {wkid: this.wkid}, this._returnLimit, mapWidgetModel);
        requester.getServiceMetadata().then((serviceDetails) => {
            if (this.events && this.events.length > 0) {
                this.events.forEach((event) => {
                    event.remove();
                });
                this.events = [];
            }

            this.events = [];
            const metadataProvider = this._getServiceMetadataProvider(serviceDetails);
            this._clusterGraphicsFactory = this._getClusterGraphicsFactory(this._clusterSymbolProvider, this._featureSymbolProvider,
                metadataProvider, mapWidgetModel, this.popupTemplate, this._clusterPopupWidgetFactory, this._options, this._popupTemplates);
            const view = mapWidgetModel.get("view");
            const map = mapWidgetModel.get("map");
            this.events.push(map.allLayers.on("change", () => {
                this._reCluster({forceReinit: true});
            }));
            this.sublayers.forEach((layer) => {
                this.events.push(WatchUtils.watch(layer, "visible", () => {
                    this._reCluster();
                }));
            });
            this.events.push(this.watch("visible", (response) => {
                if (response) {
                    this._reCluster();
                }
            }));
            this.events.push(view.watch("stationary", (response) => {
                if (response) {
                    this._reCluster();
                }
            }));
            this.events.push(view.on("click", (event) => {
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
            this._popupTemplates[layerId] = layer.popupTemplate;
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

            if (!options) {
                options = {};
            }
            if (!this._isInProgress) {
                this._isInProgress = true;
                if (!beenThereBefore || options.forceReinit === true) {
                    console.log("recluster + getfeatures");
                    async(() => {
                        this._getFeaturesFromServer().then(() => {
                            // update clustered extent
                            this._visitedExtent = visitedExtent ? visitedExtent.union(mapExtent) : mapExtent;
                            this._clusterGraphics();
                            this._isInProgress = false;
                        });
                    });
                } else {
                    console.log("recluster");
                    async(() => {
                        this._clusterGraphics();
                        this._isInProgress = false;
                    });
                }
            }
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
        const promises = [];
        return new Promise((resolve, reject) => {
            if (this._predefinedObjectIds) {
                this._predefinedObjectIds.forEach((result) => {
                    const p = new Promise((resolve, reject) => {
                        requester.getFeaturesByIds(result.objectIds, result.layerId, true).then((featuresResult) => {
                            that._addFeaturesToClusterCache(featuresResult, result.layerId).then(() => {
                                resolve();
                            });
                        }, (error) => {
                            console.error(error);
                        });
                    });
                    promises.push(p);
                });
                Promise.all(promises).then(() => {
                    resolve();
                }, (error) => {
                    console.error(error);
                });
            } else {
                requester.getObjectIds(this.sublayers).then((results) => {
                    results.forEach((result) => {
                        const p = new Promise((resolve, reject) => {
                            requester.getFeaturesByIds(result.objectIds, result.layerId).then((featuresResult) => {
                                that._addFeaturesToClusterCache(featuresResult,
                                    result.layerId, result.layerTitle).then(() => {
                                    resolve();
                                });
                            }, (error) => {
                                console.error(error);
                            });
                        })
                        promises.push(p);
                    });
                    Promise.all(promises).then(() => {
                        resolve();
                    }, (error) => {
                        console.error(error);
                    })
                }, (error) => {
                    console.error(error);
                });
            }
        });
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
     * @param layerTitle
     * @private
     */
    _addFeaturesToClusterCache(result, layerId, layerTitle) {
        console.log("add to cluster cache");
        return new Promise((resolve) => {
            async(() => {
                // get features from cache (features that have been requested before)
                const cachedFeaturesInExtent = this._getCachedFeaturesInExtent(layerId);
                let newFeaturesInExtent;
                if (result.features && result.features.length > 0) {
                    newFeaturesInExtent = result.features;
                    const len = newFeaturesInExtent.length;
                    // Update the cluster features for drawing
                    if (len) {
                        // Append actual feature to cluster cache
                        for (let i = 0; i < newFeaturesInExtent.length; i++) {
                            const feat = newFeaturesInExtent[i];
                            const featureId = feat.attributes[this._objectIdField];
                            this._clusterCache[layerId][featureId] = feat;
                            feat.layerId = layerId;
                            feat.layerTitle = layerTitle;
                        }
                        // Refine features to draw
                        this._clusterData[layerId] = newFeaturesInExtent.concat(cachedFeaturesInExtent);
                    }
                }
                this._setLayerExtent();
                resolve();
            });
        })
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
        let graphics = [];
        this._clusters.forEach((cluster) => {
            const features = cluster.attributes.features;
            const clusterCenterPoint = new Point(cluster.x, cluster.y, cluster.spatialReference);
            if (ClusterGeometryFunctions.haveSamePosition(features, clusterCenterPoint,
                this._spiderfyingDistance) && features.length > 1 && this._showSpiderfying) {
                // check for spiderfying
                graphics = graphics.concat(this._getSpiderfyingGraphics(cluster));
            } else {
                // refresh cluster graphics
                graphics = graphics.concat(this._getClusterGraphics(cluster));
            }
        });
        this.addMany(graphics);
    },

    _getClusterGraphics(cluster) {
        return this._clusterGraphicsFactory.getClusterGraphics(cluster, this._clusters);
    },

    _getSpiderfyingGraphics(cluster) {
        cluster.attributes.spiderfying = true;
        return this._clusterGraphicsFactory.getSpiderfyingGraphics(cluster);
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
            // find first clusterfeaturelayer graphic
            const graphic = that._findFirstClusterGraphicInView(response.results, that);
            if (!graphic) {
                return;
            }
            that._eventService.postEvent("dn_clusterfeaturelayer/GRAPHIC_CLICKED", {
                attributes: graphic.attributes,
                geometry: graphic.geometry
            });
            const attributes = graphic && graphic.attributes;
            if (!attributes) {
                return;
            }
            if (attributes.hasOwnProperty("features")) {
                if (attributes.spiderfying) {
                    const features = attributes.features;
                    const clusterCenterPoint = new Point(graphic.geometry.x,
                        graphic.geometry.y, graphic.geometry.spatialReference);
                    if (ClusterGeometryFunctions.haveSamePosition(features,
                        clusterCenterPoint, that._spiderfyingDistance)) {
                        that._eventService.postEvent("dn_clusterfeaturelayer/SPIDERFYING_CLICKED", {
                            attributes: graphic.attributes,
                            geometry: graphic.geometry
                        });
                    }
                } else if (this._zoomOnClusterClick) {
                    const extent = attributes.extent;
                    const clusterExtent = new Extent(extent[0], extent[1], extent[2], extent[3],
                        view.spatialReference).expand(1.5);
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
        const that = this;
        if (this._showClusterArea) {
            const view = this._mapWidgetModel.get("view");
            view.hitTest(event).then((response) => {
                const graphic = that._findFirstClusterGraphicInView(response.results, that);
                if (!graphic) {
                    return;
                }
                const attributes = graphic.attributes;
                if (attributes) {
                    this._drawClusterArea(attributes);
                } else {
                    this._hideClusterArea();
                }
            });
        }
    },

    _findFirstClusterGraphicInView(results, layer) {
        // find first clusterfeaturelayer graphic
        const result = results.filter(function (result) {
            const g = result.graphic;
            const l = g && g.layer;
            if (l) {
                return l === layer;
            } else {
                return false;
            }
        })[0];
        if (result && result.graphic) {
            return result.graphic;
        } else {
            return null;
        }
    },

    _drawClusterArea(attributes) {
        if (this.getCluster(attributes)) {
            const points = attributes.features.map((feature) => feature.geometry);
            const clusterArea = convexHull(points, true);
            //use convex hull on the points to get the boundary
            this._hideClusterArea();
            if (clusterArea[0] && !this.clusterAreaGraphic) {
                const clusterAreaGraphic = this.clusterAreaGraphic =
                    this._clusterGraphicsFactory.getAreaGraphic(clusterArea[0]);
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
            if (cluster.attributes.clusterId === attributes.clusterId &&
                cluster.attributes.clusterCount === attributes.clusterCount) {
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


    _getClusterGraphicsFactory(clusterSymbolProvider, featureSymbolProvider, metadataProvider,
                               mapWidgetModel, popupTemplate, clusterPopupWidgetFactory, options, popupTemplates) {
        return new ClusterGraphicsFactory(clusterSymbolProvider, featureSymbolProvider,
            metadataProvider, mapWidgetModel, popupTemplate, popupTemplates, clusterPopupWidgetFactory,
            options, this.title, this._i18n);
    },

    _getServiceMetadataProvider(serviceDetails) {
        return new ServiceMetadataProvider(serviceDetails);
    }
});
