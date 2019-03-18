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
/*
 Changed by con terra
 *
 * Class hierarchy
 *
 * esri/layers/Layer
 * |_esri/layers/GraphicsLayer
 *  |_ClusterFeatureLayer
 */
define([
        "dojo/_base/declare",
        "dojo/_base/Deferred",
        "dojo/_base/lang",
        "dojo/_base/array",
        "dojo/on",
        "dojo/promise/all",
        "dojo/fx",
        "dojox/gfx",
        "dojox/gfx/fx",
        "dojox/gesture/tap",

        "ct/_Connect",

        "esri/geometry/geometryEngine",
        "esri/geometry/Point",
        "esri/geometry/Polygon",
        "esri/geometry/screenUtils",
        "esri/graphic",
        "esri/layers/GraphicsLayer",

        "./ClusterGeometryFunctions"
    ], function (declare, Deferred, d_lang, d_array, on, all, coreFx, gfx, fx, tap,
                 _Connect,
                 geometryEngine, Point, Polygon, screenUtils, Graphic, GraphicsLayer,
                 ClusterGeometryFunctions) {

        return declare([GraphicsLayer], {
            /**
             * Constructor.
             *
             * @param options cluster layer options
             */
            constructor: function (options) {
                this._mapState = options.mapState;
                this._mapModel = options.mapModel;
                this._serverRequester = options.serverRequester;
                this._objectIdField = options.objectIdField;
                this._leafNodes = options.leafNodes;
                this._layerObjects = options.layerObjects;

                // private data structures
                this._clusterData = {};
                this._clusters = [];
                this._clusterCache = {}; // Important cache; holds all cached features

                // cluster settings
                this._clusterDistance = options.clusterDistance; // can be zero (just features with same position will be clustered)
                this._spiderfyingDistance = options.spiderfyingDistance;

                this._maxClusterScale = options.maxClusterScale;
                this._showClusterArea = options.showClusterArea;

                this._visitedExtent = null;

                this._initDataStructures(this._layerObjects);

                this._connect = new _Connect();
            },

            clusterMouseOver: function (event) {
                if (this._showClusterArea) {
                    this._drawClusterArea(event);
                }
            },

            clusterMouseOut: function (event) {
                if (this._showClusterArea) {
                    this._hideClusterArea(event);
                }
            },

            _initDataStructures: function (layerObjects) {
                d_array.forEach(layerObjects, function (layer) {
                    var layerId = layer.id;
                    this._clusterCache[layerId] = {};
                    this._clusterData[layerId] = [];
                }, this);
            },

            /**
             * Method to recluster when extent changes.
             *
             * @param {type} options = {
             *  forceReinit: full request of features from service and recalculation of clusters
             * }
             * @returns {ClusterFeatureLayer_L68.Deferred}
             */
            _reCluster: function (options) {
                if (!this._mapState) {
                    return;
                }
                var mapExtent = this._mapState.getExtent();
                var that = this;

                var lod = this._mapState.getLOD();
                if (lod) {
                    var mapScale = lod.scale;
                    if (mapScale <= this._maxClusterScale) {
                        this._clusterTolerance = 0;
                    } else {
                        this._clusterTolerance = this._clusterDistance;
                    }
                } else {
                    this._clusterTolerance = this._clusterDistance;
                }


                var visitedExtent = that._visitedExtent;
                var beenThereBefore = visitedExtent && visitedExtent.contains(mapExtent);

                // When zooming remove the graphics before the timeout and the server request is started.
                // This avoids flickering of the cluster graphics.
                if (!beenThereBefore || (options && options.zoomLevelChange) || (options && options.forceReinit === true)) {
                    that.clearClusters();
                }

                // reclustering is started asynchronously to prevent UI freeze and some displaying bugs
                var clusterTimeout;
                clearTimeout(clusterTimeout);
                clusterTimeout = setTimeout(function () {
                    if (!options) {
                        options = {};
                    }
                    if (!that._isInProgress) {
                        that._isInProgress = true;

                        if (!beenThereBefore || options.forceReinit === true) {
                            that._getFeaturesFromServer().then(function () {
                                // update clustered extent
                                that._isInProgress = false;
                                that._visitedExtent = visitedExtent ? visitedExtent.union(mapExtent) : mapExtent;
                                that._clusterGraphics();
                            });
                        } else {
                            that._isInProgress = false;
                            that.clearClusters();
                            that._clusterGraphics();
                        }
                    }
                }, 0);
            },

            /**
             * Overrides method of super class
             */
            _setMap: function (map, surface) {
                this.map = map;
                this.surface = surface;
                var that = this;

                this._extentChangeSignal = on(map, 'extent-change', function (event) {
                    var delta = event.delta;
                    var zoomLevelChange = event.levelChange;
                    if (delta && (delta.x !== 0 || delta.y !== 0) || zoomLevelChange) {
                        that._reCluster({zoomLevelChange: zoomLevelChange});
                    }
                });

                // Triggers the initial clustering
                var layerAddedSignal = on(map, 'layer-add', function (e) {
                    if (e.layer === that) {
                        layerAddedSignal.remove();
                        that._reCluster({forceReinit: true});

                        that._connect.connect(that._mapModel, "onModelNodeStateChanged", that, function () {
                            that._reCluster();
                        });
                    }
                });

                return this.inherited(arguments);
            },

            _unsetMap: function () {
                this._extentChangeSignal.remove();
                return this.inherited(arguments);
            },

            _getFeaturesFromServer: function () {
                var that = this;
                var requester = this._serverRequester;
                var finalDeferred = new Deferred();

                requester.getObjectIds(this._layerObjects).then(function (results) {
                    var allDeferreds = [];
                    d_array.forEach(results, function (result) {
                        var d = new Deferred();
                        allDeferreds.push(d);
                        requester.getFeaturesByIds(result, result.layerId).then(function (featuresResult) {
                            that._addFeaturesToClusterCache(featuresResult, result.layerId);
                            d.resolve();
                        }, function (error) {
                            console.error(error);
                        });
                    });
                    all(allDeferreds).then(function () {
                        finalDeferred.resolve();
                    }, function (error) {
                        console.error(error);
                    });
                }, function (error) {
                    console.error(error);
                });
                return finalDeferred;
            },

            _getCachedFeaturesInExtent: function (layerId) {
                var extent = this._getNormalizedExtentsPolygon();
                var len = this._serverRequester.objectIdCache.get(layerId).length;
                var featuresInExtent = [];

                // See if cached feature is in current extent
                while (len--) {
                    var oid = this._serverRequester.objectIdCache.get(layerId)[len];
                    var cached = this._clusterCache[layerId][oid];
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
             * @param results
             * @param layerId
             * @private
             */
            _addFeaturesToClusterCache: function (results, layerId) {
                // get features from cache (features that have been requested before)
                var cachedFeaturesInExtent = this._getCachedFeaturesInExtent(layerId);
                var newFeaturesInExtent;

                if (this.native_geometryType === 'esriGeometryPolygon') {
                    newFeaturesInExtent = ClusterGeometryFunctions.toPointGraphics(results.features);
                } else {
                    newFeaturesInExtent = results.features;
                }
                var len = newFeaturesInExtent.length;

                // Update the cluster features for drawing
                if (len) {
                    // Append actual feature to cluster cache
                    d_array.forEach(newFeaturesInExtent, function (feat) {
                        var featureId = feat.attributes[this._objectIdField];
                        this._clusterCache[layerId][featureId] = feat;
                        feat.layerId = layerId;
                    }, this);

                    // Refine features to draw
                    var featuresInLayer = newFeaturesInExtent.concat(cachedFeaturesInExtent);
                    this._clusterData[layerId] = featuresInLayer;
                }
            },

            /**
             * Method to build new cluster array from features and draw graphics.
             */
            _clusterGraphics: function () {
                // test against a modified/scrubbed map extent polygon geometry
                var testExtent = this._getNormalizedExtentsPolygon();

                // first time through, loop through the points
                d_array.forEach(this._leafNodes, function (mapModelNode) {
                    var layerId = mapModelNode.id;
                    //var layerId = mapModelNode.layer.layerId;
                    var nodeAndParentsEnabledTemp = this.nodeAndParentsEnabled(mapModelNode);
                    var clusterData = this._clusterData;
                    var currentLength = clusterData[layerId].length;

                    for (var j = 0; j < currentLength; j++) {
                        // see if the current feature should be added to a cluster
                        var feature = clusterData[layerId][j];
                        var point = feature.geometry || feature;

                        // if current feature is NOT in geo-extent don't add it to clusters to draw
                        if (!testExtent.contains(point)) {
                            continue;
                        }

                        /**
                         * CLUSTERING ALGORITHM
                         * */
                        // if node is enabled in map model add feature to clusters or create a new cluster
                        if (nodeAndParentsEnabledTemp) {
                            var clustered = false;
                            // Add point to existing cluster
                            for (var i = 0; i < this._clusters.length; i++) {
                                var c = this._clusters[i];
                                var clusterResolution = this._mapState.getExtent().getWidth() / this._map.width;
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
                }, this);

                this._addGraphicsToLayer(this._clusters);
            },

            _addGraphicsToLayer: function () {
                d_array.forEach(this._clusters, function (cluster) {
                    // refresh cluster graphics
                    this._addClusterGraphics(cluster);

                    // check for spiderfying
                    this._addSpiderfyingGraphics(cluster);
                }, this);
            },

            _addClusterGraphics: function (cluster) {
                if (cluster.clusterGraphics) {
                    d_array.forEach(cluster.clusterGraphics, function (graphic) {
                        this.remove(graphic);
                    }, this);
                }
                var clusterGraphics = cluster.clusterGraphics = this._clusterGraphicsFactory.getClusterGraphics(cluster, this._clusters);
                d_array.forEach(clusterGraphics, function (clusterGraphic) {
                    this.add(clusterGraphic);
                }, this);
            },

            _addSpiderfyingGraphics: function (cluster) {
                var features = cluster.attributes.features;
                var clusterCenterPoint = new Point(cluster.x, cluster.y, cluster.spatialReference);
                var clusterResolution = this._mapState.getExtent().getWidth() / this._map.width;

                if (!ClusterGeometryFunctions.haveSamePosition(features, clusterCenterPoint, this._spiderfyingDistance)) {
                    return;
                }
                if (features.length > 1) {
                    cluster.attributes.spiderfying = true;
                    var clusterGraphics = cluster.clusterGraphics;
                    d_array.forEach(clusterGraphics, function (clusterGraphic) {
                        this.remove(clusterGraphic);
                    }, this);
                    var spiderfyingGraphics = cluster.clusterGraphics = this._clusterGraphicsFactory.getSpiderfyingGraphics(cluster);
                    d_array.forEach(spiderfyingGraphics, function (spiderfyingGraphic) {
                        this.add(spiderfyingGraphic);
                    }, this);
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
                var count, x, y;
                count = cluster.attributes.clusterCount;
                x = (p.x + (cluster.x * count)) / (count + 1);
                y = (p.y + (cluster.y * count)) / (count + 1);

                cluster.x = x;
                cluster.y = y;

                var clusterExtent = cluster.attributes.extent;
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
                if (!p.hasOwnProperty('attributes')) {
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
                var clusterId = this._clusters.length + 1;

                if (!p.attributes) {
                    p.attributes = {};
                }
                // create the cluster
                var cluster = {
                    x: p.x,
                    y: p.y,
                    spatialReference: feature.geometry.spatialReference,
                    attributes: {
                        clusterCount: 1,
                        clusterId: clusterId,
                        extent: [p.x, p.y, p.x, p.y],
                        features: [feature]
                    }
                };
                this._clusters.push(cluster);
            },

            _drawClusterArea: function (event) {
                if (this.getCluster(event.graphic.attributes)) {
                    var points = d_array.map(event.graphic.attributes.features, function (feature) {
                        return feature.geometry;
                    });
                    var clusterArea = geometryEngine.convexHull(points, true); //use convex hull on the points to get the boundary

                    if (clusterArea[0]) {
                        var clusterAreaGraphic = this.clusterAreaGraphic = this._clusterGraphicsFactory.getAreaGraphic(clusterArea[0]);
                        this.add(clusterAreaGraphic);
                        var clusterAreaShape = clusterAreaGraphic.getShape();
                        clusterAreaShape.rawNode.setAttribute("pointer-events", "none");
                        clusterAreaShape.moveToFront();
                    }
                }
            },

            _hideClusterArea: function (event) {
                var clusterAreaGraphic = this.clusterAreaGraphic;
                this.remove(clusterAreaGraphic);
            },

            getCluster: function (attributes) {
                var res = null;
                d_array.forEach(this._clusters, function (cluster) {
                    if (cluster.attributes.clusterId === attributes.clusterId && cluster.attributes.clusterCount === attributes.clusterCount) {
                        res = cluster;
                    }
                });
                return res;
            },

            setClusterGraphicsFactory: function (graphicsFactory) {
                // TODO ClusterGraphicsFactory might be available delayed, since the renderer needs the renderer definitions from the service metadata.
                this._clusterGraphicsFactory = graphicsFactory;
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
                var normalizedExtents = this._mapState.getExtent().normalize();
                var normalizedExtentPolygons = d_array.map(normalizedExtents, function (extent) {
                    return Polygon.fromExtent(extent);
                });
                var masterPolygon = new Polygon(this._mapState.getSpatialReference());
                d_array.forEach(normalizedExtentPolygons, function (polygon) {
                    masterPolygon.addRing(polygon.rings[0]);
                });
                return masterPolygon;
            },

            clearClusters: function () {
                // calls super method clear() from ESRI graphicslayer
                this.clear();
                // clear array with calculated clusters
                this._clusters = [];
            },

            onClick: function (event) {
                var that = this;
                var mapState = this._mapState;
                if (!event.graphic.attributes) {
                    event.stopPropagation();
                    return;
                }
                event.features = event.graphic.attributes.features;

                d_array.forEach(event.features, function (feature) {
                    feature.symbol = that._clusterGraphicsFactory.getSymbolForFeature(feature);
                    feature.graphic = new Graphic(feature.geometry, feature.symbol);
                });

                event.clusterCenterPoint = event.graphic.geometry;

                var convertMapPointToScreenPoint = function (mapPoint) {
                    var screenExtent = mapState.getViewPort().getScreen();
                    return screenUtils.toScreenGeometry(mapState.getExtent(), screenExtent.getWidth(), screenExtent.getHeight(), mapPoint);
                };

                event.clusterCenterScreenPoint = convertMapPointToScreenPoint(event.graphic.geometry);

                // stops propagation default on graphics layer
                event.stopPropagation();
            },

            nodeAndParentsEnabled: function (node) {
                if (!node.get("enabled")) {
                    return false;
                }
                var currentNode = node;
                while (currentNode.parent) {
                    if (!currentNode.parent.get("enabled")) {
                        return false;
                    } else {
                        currentNode = currentNode.parent;
                    }
                }
                return true;
            }
        });
    }
);
