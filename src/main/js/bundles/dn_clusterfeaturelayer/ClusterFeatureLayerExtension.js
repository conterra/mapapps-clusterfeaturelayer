/*
 * Copyright (C) 2015 con terra GmbH (info@conterra.de)
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
 */
define([
        "dojo/_base/declare",
        "dojo/_base/array",
        "dojo/_base/lang",
        "dojo/_base/Color",
        "dojo/_base/connect",
        "dojo/on",
        "dojo/promise/all",

        "esri/graphic",

        "esri/symbols/SimpleMarkerSymbol",
        "esri/symbols/SimpleLineSymbol",

        "esri/renderers/ClassBreaksRenderer",

        "./ClusterFeatureLayer"
    ], function (declare, arrayUtils, lang, Color, connect, on, all,
                 Graphic,
                 SimpleMarkerSymbol, SimpleLineSymbol,
                 ClassBreaksRenderer,
                 ClusterFeatureLayer) {

        function concat(a1, a2) {
            return a1.concat(a2);
        }

        function toPoints(features) {
            var len = features.length;
            var points = [];
            while (len--) {
                var g = features[len];
                points.push(
                    new Graphic(
                        g.geometry.getCentroid(),
                        g.symbol, g.attributes,
                        g.infoTemplate
                    ));
            }
            return points;
        }

        /*
         added by con terra *start*
         */
        function toPoints2(features) {
            var len = features.length;
            var points = [];
            while (len--) {
                var g = features[len];
                points.push(
                    new Graphic(
                        g.geometry.getPoint(0),
                        g.symbol, g.attributes,
                        g.infoTemplate
                    ));
            }
            return points;
        }
        /*
         added by con terra *end*
         */

        return declare([], {
            activate: function () {
                this.inherited(arguments);
                var clusterFeatureLayer = ClusterFeatureLayer;
                clusterFeatureLayer.prototype._setMap = this._setMap;
                clusterFeatureLayer.prototype._onFeaturesReturned = this._onFeaturesReturned;
            },
            // override esri/layers/GraphicsLayer methods
            _setMap: function (map) {
                this._query.outSpatialReference = map.spatialReference;
                this._query.returnGeometry = true;
                this._query.outFields = this._outFields;
                // listen to extent-change so data is re-clustered when zoom level changes
                this._extentChange = on.pausable(map, 'extent-change', lang.hitch(this, '_reCluster'));
                // listen for popup hide/show - hide clusters when pins are shown

                /*
                 changed by con terra *start*
                 */
                //map.infoWindow.on('hide', lang.hitch(this, '_popupVisibilityChange'));
                //map.infoWindow.on('show', lang.hitch(this, '_popupVisibilityChange'));
                /*
                 changed by con terra *end*
                 */

                var layerAdded = on(map, 'layer-add', lang.hitch(this, function (e) {
                    if (e.layer === this) {
                        layerAdded.remove();
                        if (!this.detailsLoaded) {
                            //on.once(this, 'details-loaded', lang.hitch(this, function () {
                            if (!this.renderer) {

                                this._singleSym = this._singleSym || new SimpleMarkerSymbol('circle', 16,
                                        new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([85, 125, 140, 1]), 3),
                                        new Color([255, 255, 255, .5]));

                                var renderer = new ClassBreaksRenderer(this._singleSym, 'clusterCount');

                                // Blue clusters
                                small = new SimpleMarkerSymbol('circle', 25,
                                    new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([140, 177, 210, 0.35]), 15),
                                    new Color([140, 177, 210, 0.75]));
                                medium = new SimpleMarkerSymbol('circle', 50,
                                    new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([97, 147, 179, 0.35]), 15),
                                    new Color([97, 147, 179, 0.75]));
                                large = new SimpleMarkerSymbol('circle', 80,
                                    new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([59, 110, 128, 0.35]), 15),
                                    new Color([59, 110, 128, 0.75]));
                                xlarge = new SimpleMarkerSymbol('circle', 110,
                                    new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([20, 72, 77, 0.35]), 15),
                                    new Color([20, 72, 77, 0.75]));

                                renderer.addBreak(2, 10, small);
                                renderer.addBreak(10, 25, medium);
                                renderer.addBreak(25, 100, large);
                                renderer.addBreak(100, Infinity, xlarge);
                                this.setRenderer(renderer);
                            }
                            this._reCluster();
                            //}));
                        }
                    }
                }));

                // GraphicsLayer will add its own listener here
                var div = this.inherited(arguments);
                return div;
            },
            // Add features to cluster cache and refine cluster data to draw - clears all graphics!
            _onFeaturesReturned: function (results) {
                // debug
                // var end = new Date().valueOf();
                // console.debug('#_onFeaturesReturned end', (end - this._startGetOids)/1000);

                var inExtent = this._inExtent();
                var features;

                /*
                 changed by con terra *start*
                 */
                if (results.features.length > 0)
                    var geometryType = results.features && results.features[0].geometry.type;
                if (this.native_geometryType === 'esriGeometryPolygon') {
                    features = toPoints(results.features);
                } else if (geometryType === "multipoint") {
                    features = toPoints2(results.features);
                } else {
                    features = results.features;
                }
                /*
                 changed by con terra *end*
                 */

                var len = features.length;
                //this._clusterData.length = 0;
                //this.clear();
                // Update the cluster features for drawing
                if (len) {
                    //this._clusterData.lenght = 0;  // Bug
                    this._clusterData.length = 0;
                    // Delete all graphics in layer (not local features)
                    this.clear();
                    // Append actual feature to oid cache
                    arrayUtils.forEach(features, function (feat) {
                        this._clusterCache[feat.attributes[this._objectIdField]] = feat;
                    }, this);
                    // Refine features to draw
                    this._clusterData = concat(features, inExtent);
                }
                //this._clusterData = concat(features, inExtent);

                // debug
                // var end = new Date().valueOf();
                // console.debug('#_onFeaturesReturned end', (end - start)/1000);

                // Cluster the features
                this._clusterGraphics();
            }
        });
    }
);