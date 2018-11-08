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
import d_array from "dojo/_base/array";
import Point from "esri/geometry/Point";
import Polyline from "esri/geometry/Polyline";
import Graphic from "esri/Graphic";
import * as jsonUtils from "esri/renderers/support/jsonUtils";

export default class ClusterGraphicsFactory {
    constructor(clusterSymbolProvider, featureSymbolProvider, rendererProvider, mapWidgetModel, popupTemplate, options) {
        this.clusterSymbolProvider = clusterSymbolProvider;
        this.featureSymbolProvider = featureSymbolProvider;
        this.rendererProvider = rendererProvider || {};
        this.mapWidgetModel = mapWidgetModel;
        this.clusterLabelOffset = options.clusterLabelOffset;
        this.symbolBaseSize = options.symbolBaseSize;
        this.showClusterSize = options.showClusterSize;
        this.showClusterGrid = options.showClusterGrid;
        this.showClusterGridCounts = options.showClusterGridCounts;
        this.showClusterGridBackground = options.showClusterGridBackground;
        this.useDefaultSymbolForFeatures = options.useDefaultSymbolForFeatures;
        this.spiderfyingDistanceMultiplier = options.spiderfyingDistanceMultiplier || 1;
        this.spiralLengthStart = options.spiralLengthStart || 20;
        this.spiralLengthFactor = options.spiralLengthFactor || 3;
        this.popupTemplate = popupTemplate;
    }

    getAreaGraphic(area) {
        return new Graphic(area, this.clusterSymbolProvider.getAreaSymbol(), {clusterArea: true});
    }

    getClusterGraphics(cluster, clusters) {
        let point = new Point(cluster.x, cluster.y, cluster.spatialReference);
        let clusterAttributes = cluster.attributes;
        // create graphics for single feature
        if (clusterAttributes.features.length === 1) {
            let singleFeature = clusterAttributes.features[0];
            let singleFeatureSymbol = this.getSymbolForFeature(singleFeature);

            // The symbols from the features are reused, so they might be still offset for the cluster layout.
            return [new Graphic(point, singleFeatureSymbol, singleFeature.attributes, this.popupTemplate)];
        }
        // create graphics for cluster
        let returnGraphics = [];
        let allFeatures = cluster.attributes.features;

        // simple circle clusters
        if (!this.showClusterGrid) {
            let maxSize = clusters[0].attributes.clusterCount;
            clusters.forEach((c) => {
                if (c.attributes.clusterCount > maxSize) {
                    maxSize = c.attributes.clusterCount;
                }
            });
            let clusterSymbol = this.clusterSymbolProvider.getClusterSymbolCircle(cluster.attributes.clusterCount, 0.2 * maxSize, 0.4 * maxSize, 0.6 * maxSize, 0.8 * maxSize, maxSize);
            returnGraphics.push(new Graphic(point, clusterSymbol, clusterAttributes));
            // show number of points in the cluster
            if (this.showClusterSize) {
                let label = this.clusterSymbolProvider.getClusterLabel(clusterAttributes.clusterCount.toString(), 0);
                label.set("angle", this._getRotation());
                returnGraphics.push(new Graphic(point, label, clusterAttributes));
            }
            return returnGraphics;
        }

        // grid layout
        let mostFeatures = this._getMostFeatures(allFeatures, 9);
        let baseSize = this.symbolBaseSize;
        let pointsCount = mostFeatures.length;
        // calculate grid
        // 1 feature -> gridSize = 1; 2-4 features -> gridSize = 2; >4 features -> gridSize= 3
        let gridSize = Math.ceil(Math.sqrt(pointsCount));
        let columnsCount = gridSize;
        let rowsCount = Math.ceil(pointsCount / gridSize);

        if (this.showClusterGridBackground) {
            let maxClusterSize = 3 * baseSize;
            let backGroundSize = baseSize / 1.1;
            let clusterSymbolsBackground = this.clusterSymbolProvider.getClusterSymbolsBackground(columnsCount, rowsCount, baseSize, false);
            clusterSymbolsBackground.set("size", (Math.min(maxClusterSize, gridSize * backGroundSize)));
            clusterSymbolsBackground.set("angle", this._getRotation());
            returnGraphics.push(new Graphic(point, clusterSymbolsBackground, clusterAttributes));
        }

        // add symbols
        let differentSymbolPoints = mostFeatures.map(() => {
            return point.clone();
        });
        this._alignPointsInGrid(differentSymbolPoints, gridSize, baseSize);
        let differentFeatureSymbols = this._getSymbolsForGrid(allFeatures, mostFeatures);

        differentSymbolPoints.forEach((symbolPoint, i) => {
            returnGraphics.push(new Graphic(symbolPoint, differentFeatureSymbols[i], clusterAttributes));
        });

        // add labels
        if (this.showClusterGridCounts) {
            let differentLabelPoints = mostFeatures.map(() => {
                return point.clone();
            });
            this._alignPointsInGrid(differentLabelPoints, gridSize, baseSize);
            let differentFeatureLabels = this._getLabelsForGrid(mostFeatures);

            differentLabelPoints.forEach((labelPoint, i) => {
                returnGraphics.push(new Graphic(labelPoint, differentFeatureLabels[i], clusterAttributes));
            });
        }

        return returnGraphics;
    }

    getSpiderfyingGraphics(cluster) {
        let point = new Point(cluster.x, cluster.y, cluster.spatialReference);
        let returnGraphics = [];
        // create graphics for cluster
        let baseSize = this.symbolBaseSize;
        let spiderfyingSymbols = this._getSymbolsForSpiderfying(cluster);
        let spiderfyingPoints = spiderfyingSymbols.map(() => {
            return point.clone();
        });
        this._alignPointsInSpiderfying(spiderfyingPoints, baseSize);
        spiderfyingSymbols.forEach((symbol, i) => {
            if (symbol.featureAttributes) {
                // add line symbol
                let offsetPoint = spiderfyingPoints[i];
                let line = new Polyline({
                    paths: [[
                        [
                            point.x,
                            point.y
                        ],
                        [
                            offsetPoint.x,
                            offsetPoint.y
                        ]
                    ]],
                    hasZ: false,
                    hasM: true,
                    spatialReference: cluster.spatialReference
                });
                returnGraphics.push(new Graphic(line, this.clusterSymbolProvider.getSpiderfyingLineSymbol()));
                // add symbol
                returnGraphics.push(new Graphic(offsetPoint, symbol, symbol.featureAttributes, this.popupTemplate));

                let center = new Graphic(point, this.clusterSymbolProvider.getSpiderfyingSymbolCircle(), symbol.featureAttributes, this.popupTemplate);
                returnGraphics.push(center);
            }
        }, this);
        return returnGraphics;
    }

    offsetToDistance(value) {
        let clusterResolution = this.mapWidgetModel.get("view").extent.width / this.mapWidgetModel.width;
        return value * clusterResolution;
    }

    getSymbolForFeature(feature) {
        let featureSymbol;
        if (this.useDefaultSymbolForFeatures) {
            featureSymbol = this.featureSymbolProvider.getFeatureSymbol();
        } else {
            featureSymbol = feature.symbol;
            if (!featureSymbol) {
                let rendererJson = this.rendererProvider.getRendererForLayer(feature.layerId);
                let tmpRenderer = jsonUtils.fromJSON(rendererJson);
                featureSymbol = tmpRenderer.getSymbol(feature);
            }
            if (!featureSymbol) {
                featureSymbol = this.featureSymbolProvider.getFeatureSymbol();
            }
        }
        this._setSymbolSize(featureSymbol);
        featureSymbol.set("angle", this._getRotation());
        return featureSymbol;
    }

    _setSymbolSize(symbol) {
        let baseSize = this.symbolBaseSize;
        if (symbol.height) {
            let w = baseSize / symbol.width;
            let h = baseSize / symbol.height;
            if (w > h) {
                symbol.set("width", (symbol.width * w) - 2);
                symbol.set("height", (symbol.height * w) - 2);
            } else {
                symbol.set("width", (symbol.width * h) - 2);
                symbol.set("height", (symbol.height * h) - 2);
            }
        } else if (symbol.size) {
            symbol.set("size", this.symbolBaseSize - 2);
        }
    }

    _getSymbolsForSpiderfying(cluster) {
        let allFeatures = cluster.attributes.features;
        let symbols = [];
        let symbol;
        d_array.some(allFeatures, (feature) => {
            symbol = this.getSymbolForFeature(feature).clone();
            symbol.featureAttributes = feature.attributes;
            symbols.push(symbol);
        }, this);
        return symbols;
    }

    _getMostFeatures(allFeatures, maxNumberOfFeatures) {
        let count = {};
        allFeatures.forEach((feature) => {
            if (!count[feature.layerId]) {
                count[feature.layerId] = 1;
            } else {
                count[feature.layerId]++;
            }
        });
        let sortableCounts = [];
        for (let layerId in count) {
            sortableCounts.push([
                layerId,
                count[layerId]
            ]);
        }
        sortableCounts.sort((a, b) => {
            return b[1] - a[1];
        });
        let result = [];
        d_array.some(sortableCounts, (count) => {
            if (result.length >= maxNumberOfFeatures)
                return false;
            result.push(count);
        });
        return result;
    }

    _getSymbolsForGrid(allFeatures, mostFeatures) {
        let featuresFromDifferentLayers = this._getFeaturesFromDifferentLayers(allFeatures, mostFeatures);
        return featuresFromDifferentLayers.map((feature) => {
            let symbol = this.getSymbolForFeature(feature).clone();
            symbol.featureAttributes = feature.attributes;
            return symbol;
        }, this);
    }

    _getLabelsForGrid(mostFeatures) {
        let that = this;
        let rotation = this._getRotation();
        return mostFeatures.map((layerInfos) => {
            let label = that.clusterSymbolProvider.getClusterLabel(layerInfos[1], that.clusterLabelOffset);
            label.angle = rotation;
            return label;
        });
    }

    /**
     * Returns for the specified features, that might originate from different layers, one feature for each
     * of the layers.
     * @param allFeatures
     * @param mostFeatures
     * @private
     */
    _getFeaturesFromDifferentLayers(allFeatures, mostFeatures) {
        let layerIds = [];
        mostFeatures.forEach((layerInfos) => {
            layerIds.push(layerInfos[0]);
        });
        let hash = {};
        allFeatures.forEach((feature) => {
            if (layerIds.indexOf(feature.layerId.toString()) !== -1)
                hash[feature.layerId] = feature;
        });
        let featuresFromDifferentLayers = [];
        layerIds.forEach((layerId) => {
            featuresFromDifferentLayers.push(hash[layerId]);
        });
        return featuresFromDifferentLayers;
    }

    /**
     *
     * @param points The points to display and align within the grid.
     * @param gridSize An integer that specifies whether it's a 1x1, 2x2, 3x3, etc. grid.
     * @param baseSize The distance between two symbols within the cluster.
     * @private
     */
    _alignPointsInGrid(points, gridSize, baseSize) {
        let size = baseSize * 1.1;
        // This calculates how many columns and rows are needed to display the symbols in the cluster.
        let gridSizeX = Math.min(gridSize, points.length);
        let gridSizeY = Math.ceil(points.length / gridSize);
        let offsetOriginX = (gridSizeX - 1) * size;
        let offsetOriginY = (gridSizeY - 1) * size;
        points.forEach((point, index) => {
            let rotation = this._getRotation();
            // This calculates the offset of the current symbol within the cluster.
            let rho = (180 / Math.PI);
            let xOffset = -offsetOriginX / 2 + index % gridSize * size;
            let yOffset = offsetOriginY / 2 - Math.floor(index / gridSize) * size;
            let xOffsetRotated = xOffset * Math.cos(rotation / rho) + yOffset * Math.sin(rotation / rho);
            let yOffsetRotated = -xOffset * Math.sin(rotation / rho) + yOffset * Math.cos(rotation / rho);
            point.offset(this.offsetToDistance(xOffsetRotated), this.offsetToDistance(yOffsetRotated));
        });
    }

    /**
     *
     * @param points The points to display and align within the grid.
     * @param baseSize The distance between two symbols within the cluster.
     * @private
     */
    _alignPointsInSpiderfying(points, baseSize) {
        if (points.length <= 9) {
            this._allignPointsInCircle(points, baseSize);
        } else {
            this._allignPointsInSpiral(points, baseSize);
        }
    }

    _allignPointsInCircle(points, baseSize) {
        let spiderfyingDistanceMultiplier = this.spiderfyingDistanceMultiplier;
        let spiderfyingCount = points.length;
        //if there's an even amount of flares, position the first flare to the left, minus 180 from degree to do this.
        //for an add amount position the first flare on top, -90 to do this. Looks more symmetrical this way.
        let circleStartAngle = spiderfyingCount % 2 === 0 ? -180 * (Math.PI / 180) : -90 * (Math.PI / 180);
        let circumference = spiderfyingDistanceMultiplier * baseSize * (3 + spiderfyingCount);
        let radius = circumference / (2 * Math.PI);
        //radius from circumference
        let angleStep = 2 * Math.PI / spiderfyingCount;
        let i;
        let angle;
        for (i = spiderfyingCount - 1; i >= 0; i--) {
            angle = circleStartAngle + i * angleStep;
            let xOffset = radius * Math.cos(angle);
            let yOffset = radius * Math.sin(angle);
            points[i].offset(this.offsetToDistance(xOffset), this.offsetToDistance(yOffset));
        }
    }

    _allignPointsInSpiral(points, baseSize) {
        let spiderfyingDistanceMultiplier = this.spiderfyingDistanceMultiplier;
        let spiderfyingCount = points.length;
        let radius = spiderfyingDistanceMultiplier * this.spiralLengthStart;
        let separation = /*spiderfyingDistanceMultiplier * */ baseSize;
        let lengthFactor = spiderfyingDistanceMultiplier * this.spiralLengthFactor * (2 * Math.PI);
        let angle = 0;
        let i;
        // Higher index, closer position to cluster center.
        for (i = spiderfyingCount - 1; i >= 0; i--) {
            angle += separation / radius + i * 0.0005;
            let xOffset = radius * Math.cos(angle);
            let yOffset = radius * Math.sin(angle);
            points[i].offset(this.offsetToDistance(xOffset), this.offsetToDistance(yOffset));
            radius += lengthFactor / angle;
        }
    }

    _getRotation() {
        let rotation = 0;
        let viewmode = this.mapWidgetModel.get("viewmode");
        if (viewmode === "2D") {
            rotation = this.mapWidgetModel.get("rotation") * -1;
        } else {
            let camera = this.mapWidgetModel.get("camera");
            rotation = camera && camera.get("heading");
        }
        return rotation;
    }
}
