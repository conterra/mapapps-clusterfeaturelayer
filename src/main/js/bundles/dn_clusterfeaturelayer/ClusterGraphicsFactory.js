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
        "dojo/_base/lang",
        "dojo/_base/array",

        "esri/geometry/Point",
        "esri/geometry/Polyline",
        "esri/graphic",
        "esri/renderers/jsonUtils"
    ],
    function (declare, d_lang, d_array,
              Point, Polyline, Graphic, rendererJsonUtil) {
        return declare([], {
            clusterSymbolProvider: null,
            featureSymbolProvider: null,
            mapState: null,

            constructor: function (clusterSymbolProvider, featureSymbolProvider, rendererProvider, mapState, options) {
                this.clusterSymbolProvider = clusterSymbolProvider;
                this.featureSymbolProvider = featureSymbolProvider;
                this.rendererProvider = rendererProvider || {};
                this.mapState = mapState;
                this.clusterLabelOffset = options.clusterLabelOffset;
                this.symbolBaseSize = options.symbolBaseSize;
                this.showClusterSize = options.showClusterSize;
                this.showClusterGrid = options.showClusterGrid;
                this.showClusterGridCounts = options.showClusterGridCounts;
                this.showClusterGridBackground = options.showClusterGridBackground;
                this.useDefaultSymbolForFeatures = options.useDefaultSymbolForFeatures;
                this.spiderfyDistanceMultiplier = options.spiderfyDistanceMultiplier || 1;
                this.spiralLengthStart = options.spiralLengthStart || 20;
                this.spiralLengthFactor = options.spiralLengthFactor || 3;
            },

            getAreaGraphic: function (area) {
                var areaGraphic = new Graphic(area);
                areaGraphic.setSymbol(this.clusterSymbolProvider.getAreaSymbol());
                return areaGraphic;
            },

            getClusterGraphics: function (cluster, clusters) {
                var point = new Point(cluster.x, cluster.y, cluster.spatialReference);
                var clusterAttributes = cluster.attributes;
                var returnGraphics = [];

                // create graphics for single feature
                if (clusterAttributes.features.length === 1) {
                    var singleFeature = clusterAttributes.features[0];
                    var singleFeatureSymbol = this.getSymbolForFeature(singleFeature);

                    // The symbols from the features are reused, so they might be still offset for the cluster layout.
                    singleFeatureSymbol.setOffset(0, 0);

                    returnGraphics.push(new Graphic(point, singleFeatureSymbol, singleFeature.attributes));
                    return returnGraphics;
                }

                // create graphics for cluster
                var clusterSymbols = this._getSymbolsForCluster(cluster, clusters);
                d_array.forEach(clusterSymbols, function (symbol) {
                    returnGraphics.push(new Graphic(point, symbol, clusterAttributes));
                }, this);

                // show number of points in the cluster
                if (!this.showClusterGrid && this.showClusterSize) {
                    var label = this.clusterSymbolProvider.getClusterLabel(clusterAttributes.clusterCount.toString());
                    returnGraphics.push(new Graphic(point, label, clusterAttributes));
                }

                return returnGraphics;
            },

            getSpiderfyingGraphics: function (cluster) {
                var point = new Point(cluster.x, cluster.y, cluster.spatialReference);
                var clusterAttributes = cluster.attributes;
                var returnGraphics = [];

                // create graphics for cluster
                var clusterSymbols = this._getSymbolsForSpiderfying(cluster);
                d_array.forEach(clusterSymbols, function (symbol) {
                    if (symbol.featureAttributes) {
                        // add line symbol
                        var xOffset = this.offsetToDistance(symbol.xoffset);
                        var yOffset = this.offsetToDistance(symbol.yoffset);
                        var offsettedPoint = point.offset(xOffset, yOffset);
                        var line = new Polyline({
                            paths: [[[cluster.x, cluster.y], [offsettedPoint.x, offsettedPoint.y]]],
                            spatialReference: cluster.spatialReference
                        });
                        returnGraphics.push(new Graphic(line, this.clusterSymbolProvider.getSpiderfyingLineSymbol()));
                        // add symbol
                        returnGraphics.push(new Graphic(point, symbol, symbol.featureAttributes));
                    } else {
                        returnGraphics.push(new Graphic(point, symbol, null));
                    }
                }, this);
                return returnGraphics;
            },

            offsetToDistance: function (value) {
                var screenExtent = this.mapState.getViewPort().getScreen();
                var mapExtent = this.mapState.getExtent();
                var m = mapExtent.getWidth() / screenExtent.getWidth();
                return value * m;
            },

            getSymbolForFeature: function (feature) {
                if (this.useDefaultSymbolForFeatures) {
                    return this.featureSymbolProvider.getFeatureSymbol();
                }

                var featureSymbol = feature.symbol;
                if (!featureSymbol) {
                    var tmpRenderer = rendererJsonUtil.fromJson(this.rendererProvider.getRendererForLayer(feature.layerId));
                    featureSymbol = tmpRenderer.getSymbol(feature);
                }

                if (!featureSymbol) {
                    return this.featureSymbolProvider.getFeatureSymbol();
                }

                this._setSymbolSize(featureSymbol);

                return featureSymbol;
            },

            _setSymbolSize: function (symbol) {
                var baseSize = this.symbolBaseSize;
                if (symbol.setHeight) {
                    var w = baseSize / symbol.width;
                    var h = baseSize / symbol.height;
                    if (w > h) {
                        symbol.setWidth((symbol.width * w) - 2);
                        symbol.setHeight((symbol.height * w) - 2);
                    } else {
                        symbol.setWidth((symbol.width * h) - 2);
                        symbol.setHeight((symbol.height * h) - 2);
                    }
                } else if (symbol.setSize) {
                    symbol.setSize(this.symbolBaseSize - 2);
                }
            },

            _getSymbolsForCluster: function (cluster, clusters) {
                var allFeatures = cluster.attributes.features;
                var results = [];

                if (!this.showClusterGrid) {
                    var maxSize = clusters[0].attributes.clusterCount;
                    d_array.forEach(clusters, function (c) {
                        if (c.attributes.clusterCount > maxSize) {
                            maxSize = c.attributes.clusterCount;
                        }
                    });
                    var clusterSymbol = this.clusterSymbolProvider.getClusterSymbolCircle(cluster.attributes.clusterCount, 0.2 * maxSize, 0.4 * maxSize, 0.6 * maxSize, 0.8 * maxSize, maxSize);
                    results.push(clusterSymbol);
                    return results;
                }

                var mostFeatures = this._getMostFeatures(allFeatures, 9);
                var differentFeatureSymbols = this._getSymbolsForGrid(allFeatures, mostFeatures);
                var differentFeatureLabels;
                if (this.showClusterGridCounts) {
                    differentFeatureLabels = this._getLabelsForGrid(mostFeatures);
                } else {
                    differentFeatureLabels = [];
                }

                var baseSize = this.symbolBaseSize;
                var symbolsCount = differentFeatureSymbols.length;
                // 1 feature -> gridSize = 1; 2-4 features -> gridSize = 2; >4 features -> gridSize= 3
                var gridSize = Math.ceil(Math.sqrt(symbolsCount));

                var columnsCount = gridSize;
                var rowsCount = Math.ceil(symbolsCount / gridSize);

                this._alignSymbolsInGrid(differentFeatureSymbols, gridSize, baseSize, 0);
                if (this.showClusterGrid && this.showClusterGridCounts) {
                    this._alignSymbolsInGrid(differentFeatureLabels, gridSize, baseSize, this.clusterLabelOffset);
                }

                if (this.showClusterGrid && this.showClusterGridBackground) {
                    var maxClusterSize = 3 * baseSize;
                    var clusterSymbolsBackground = this.clusterSymbolProvider.getClusterSymbolsBackground(columnsCount, rowsCount, baseSize, false);
                    clusterSymbolsBackground.setSize(Math.min(maxClusterSize, gridSize * baseSize));
                    //transparentClusterSymbol = this.clusterSymbolProvider.getClusterSymbolsBackground(columnsCount * baseSize, rowsCount * baseSize, true);
                    //transparentClusterSymbol.setSize(Math.min(maxClusterSize, gridSize * baseSize));
                    results.push(clusterSymbolsBackground);
                }

                return results.concat(differentFeatureSymbols).concat(differentFeatureLabels);
            },

            _getSymbolsForSpiderfying: function (cluster) {
                var allFeatures = cluster.attributes.features;
                var baseSize = this.symbolBaseSize;
                var backgroundSymbols = [];
                var symbols = [];
                var symbol;
                d_array.some(allFeatures, function (feature) {
                    symbol = d_lang.clone(this.getSymbolForFeature(feature));
                    symbol.featureAttributes = feature.attributes;
                    symbols.push(symbol);
                }, this);

                this._alignSymbolsInSpiderfying(symbols, baseSize);
                this._alignSymbolsInSpiderfying(backgroundSymbols, baseSize);

                var centerSymbol = this.clusterSymbolProvider.getSpiderfyingSymbolCircle();

                return [centerSymbol].concat(backgroundSymbols).concat(symbols);
            },

            _getMostFeatures: function (allFeatures, maxNumberOfFeatures) {
                var count = {};
                d_array.forEach(allFeatures, function (feature) {
                    if (!count[feature.layerId]) {
                        count[feature.layerId] = 1;
                    } else {
                        count[feature.layerId]++;
                    }
                });

                var sortableCounts = [];
                for (var layerId in count) {
                    sortableCounts.push([layerId, count[layerId]]);
                }

                sortableCounts.sort(function (a, b) {
                    return b[1] - a[1];
                });

                var result = [];
                d_array.some(sortableCounts, function (count) {
                    if (result.length >= maxNumberOfFeatures)
                        return false;
                    result.push(count);
                });
                return result;
            },

            _getSymbolsForGrid: function (allFeatures, mostFeatures) {
                var featuresFromDifferentLayers = this._getFeaturesFromDifferentLayers(allFeatures, mostFeatures);
                return d_array.map(featuresFromDifferentLayers, function (feature) {
                    var symbol = d_lang.clone(this.getSymbolForFeature(feature));
                    symbol.featureAttributes = feature.attributes;
                    return symbol;
                }, this);
            },

            _getLabelsForGrid: function (mostFeatures) {
                var that = this;
                return d_array.map(mostFeatures, function (layerInfos) {
                    return that.clusterSymbolProvider.getClusterLabel(layerInfos[1]);
                });
            },

            /**
             * Returns for the specified features, that might originate from different layers, one feature for each
             * of the layers.
             * @param allFeatures
             * @param mostFeatures
             * @private
             */
            _getFeaturesFromDifferentLayers: function (allFeatures, mostFeatures) {
                var layerIds = [];
                d_array.forEach(mostFeatures, function (layerInfos) {
                    layerIds.push(layerInfos[0]);
                });
                var hash = {};
                d_array.forEach(allFeatures, function (feature) {
                    if (layerIds.indexOf(feature.layerId) !== -1)
                        hash[feature.layerId] = feature;
                });

                var featuresFromDifferentLayers = [];
                d_array.forEach(layerIds, function (layerId) {
                    featuresFromDifferentLayers.push(hash[layerId]);
                });
                return featuresFromDifferentLayers;
            },

            /**
             *
             * @param symbols The symbols to display and align within the grid.
             * @param gridSize An integer that specifies whether it's a 1x1, 2x2, 3x3, etc. grid.
             * @param baseSize The distance between two symbols within the cluster.
             * @param yOffsetAddition An additional yOffset.
             * @private
             */
            _alignSymbolsInGrid: function (symbols, gridSize, baseSize, yOffsetAddition) {
                // This calculates how many columns and rows are needed to display the symbols in the cluster.
                var gridSizeX = Math.min(gridSize, symbols.length);
                var gridSizeY = Math.ceil(symbols.length / gridSize);

                var offsetOriginX = (gridSizeX - 1) * baseSize;
                var offsetOriginY = (gridSizeY - 1) * baseSize;

                d_array.forEach(symbols, function (symbol, index) {
                    // This calculates the offset of the current symbol within the cluster.
                    var xOffset = -offsetOriginX / 2 + (index % gridSize) * baseSize;
                    var yOffset = offsetOriginY / 2 - Math.floor(index / gridSize) * baseSize;

                    symbol.setOffset(xOffset, yOffset + yOffsetAddition);
                });
            },

            /**
             *
             * @param symbols The symbols to display and align within the grid.
             * @private
             */
            _alignSymbolsInSpiderfying: function (symbols) {
                if (symbols.length <= 9) {
                    this._allignSymbolsInCircle(symbols);
                } else {
                    this._allignSymbolsInSpiral(symbols);
                }
            },

            _allignSymbolsInCircle: function (symbols) {
                var baseSize = this.symbolBaseSize;
                var spiderfyDistanceMultiplier = this.spiderfyDistanceMultiplier;
                var spiderfyCount = symbols.length;
                //if there's an even amount of flares, position the first flare to the left, minus 180 from degree to do this.
                //for an add amount position the first flare on top, -90 to do this. Looks more symmetrical this way.
                var circleStartAngle = (spiderfyCount % 2 === 0) ? -180 * (Math.PI / 180) : -90 * (Math.PI / 180);
                var circumference = spiderfyDistanceMultiplier * baseSize * (3 + spiderfyCount);
                var radius = circumference / (2 * Math.PI);  //radius from circumference
                var angleStep = (2 * Math.PI) / spiderfyCount;
                var i;
                var angle;

                for (i = spiderfyCount - 1; i >= 0; i--) {
                    angle = circleStartAngle + i * angleStep;
                    var xOffset = radius * Math.cos(angle);
                    var yOffset = radius * Math.sin(angle);

                    symbols[i].setOffset(xOffset, yOffset);
                }
            },

            _allignSymbolsInSpiral: function (symbols) {
                var baseSize = this.symbolBaseSize;
                var spiderfyDistanceMultiplier = this.spiderfyDistanceMultiplier;
                var spiderfyCount = symbols.length;
                var radius = spiderfyDistanceMultiplier * this.spiralLengthStart;
                var separation = /*spiderfyDistanceMultiplier * */baseSize;
                var lengthFactor = spiderfyDistanceMultiplier * this.spiralLengthFactor * (2 * Math.PI);
                var angle = 0;
                var i;

                // Higher index, closer position to cluster center.
                for (i = spiderfyCount - 1; i >= 0; i--) {
                    angle += separation / radius + i * 0.0005;
                    var xOffset = radius * Math.cos(angle);
                    var yOffset = radius * Math.sin(angle);

                    symbols[i].setOffset(xOffset, yOffset);

                    radius += lengthFactor / angle;
                }
            }
        });
    });