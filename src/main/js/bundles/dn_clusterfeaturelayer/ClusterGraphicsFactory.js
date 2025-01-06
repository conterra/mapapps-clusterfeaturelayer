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
import Point from "esri/geometry/Point";
import Polyline from "esri/geometry/Polyline";
import Graphic from "esri/Graphic";
import * as jsonUtils from "esri/renderers/support/jsonUtils";
import CustomContent from "esri/popup/content/CustomContent";

export default class ClusterGraphicsFactory {
    constructor(clusterSymbolProvider, featureSymbolProvider, rendererProvider,
        mapWidgetModel, popupTemplate, popupTemplates, clusterPopupWidgetFactory, options, clusterFeatureLayerTitle, i18n) {
        this.i18n = i18n;
        this.clusterFeatureLayerTitle = clusterFeatureLayerTitle;
        this.clusterSymbolProvider = clusterSymbolProvider;
        this.featureSymbolProvider = featureSymbolProvider;
        this.rendererProvider = rendererProvider || {};
        this.mapWidgetModel = mapWidgetModel;
        this.clusterPopupWidgetFactory = clusterPopupWidgetFactory;
        this.clusterLabelOffset = options.clusterLabelOffset;
        this.symbolBaseSize = options.symbolBaseSize;
        this.showClusterSize = options.showClusterSize;
        this.showClusterGrid = options.showClusterGrid;
        this.showClusterGridCounts = options.showClusterGridCounts;
        this.showClusterGridBackground = options.showClusterGridBackground;
        this.showClusterPopup = options.showClusterPopup;
        this.useDefaultSymbolForFeatures = options.useDefaultSymbolForFeatures;
        this.spiderfyingDistanceMultiplier = options.spiderfyingDistanceMultiplier || 1;
        this.spiralLengthStart = options.spiralLengthStart || 20;
        this.spiralLengthFactor = options.spiralLengthFactor || 3;
        this.popupTemplate = popupTemplate;
        this.popupTemplates = popupTemplates;
    }

    getAreaGraphic(area) {
        return new Graphic({
            geometry: area,
            symbol: this.clusterSymbolProvider.getAreaSymbol(),
            attributes: {
                clusterArea: true
            }
        });
    }

    getClusterGraphics(cluster, clusters) {
        const point = new Point(cluster.x, cluster.y, cluster.spatialReference);
        const clusterAttributes = cluster.attributes;
        // create graphics for single feature
        if (clusterAttributes.features.length === 1) {
            const singleFeature = clusterAttributes.features[0];
            const singleFeatureSymbol = this.getSymbolForFeature(singleFeature);
            const popupTemplate = this.popupTemplates[singleFeature.layerId];

            // The symbols from the features are reused, so they might be still offset for the cluster layout.
            return [
                new Graphic({
                    geometry: point,
                    symbol: singleFeatureSymbol,
                    attributes: singleFeature.attributes,
                    popupTemplate: popupTemplate || this.popupTemplate
                })
            ];
        }
        // create graphics for cluster
        const returnGraphics = [];
        const allFeatures = cluster.attributes.features;
        // get most features
        const mostFeatures = this._getMostFeatures(allFeatures, 9);
        const differentFeatureSymbols = mostFeatures.map((obj) => obj.symbol);
        clusterAttributes.clusterInfos = mostFeatures.map((obj) => {
            return {
                layerId: obj.layerId,
                layerTitle: obj.layerTitle,
                count: obj.count,
                symbol: obj.symbol.toJSON()
            };
        });

        const clusterPopupTemplate = this._getClusterPopupTemplate();

        // simple circle clusters
        if (!this.showClusterGrid) {
            let maxSize = clusters[0].attributes.clusterCount;
            clusters.forEach((c) => {
                if (c.attributes.clusterCount > maxSize) {
                    maxSize = c.attributes.clusterCount;
                }
            });
            const clusterSymbol = this.clusterSymbolProvider.getClusterSymbolCircle(
                cluster.attributes.clusterCount, 0.2 * maxSize, 0.4 * maxSize, 0.6 * maxSize, 0.8 * maxSize, maxSize);
            returnGraphics.push(new Graphic({
                geometry: point,
                symbol: clusterSymbol,
                attributes: clusterAttributes,
                popupTemplate: this.showClusterPopup ? clusterPopupTemplate : null
            }));
            // show number of points in the cluster
            if (this.showClusterSize) {
                const label = this.clusterSymbolProvider.getClusterLabel(clusterAttributes.clusterCount.toString(), 0);
                //label.set("angle", this._getRotation());
                returnGraphics.push(new Graphic({
                    geometry: point,
                    symbol: label,
                    attributes: clusterAttributes
                }));
            }
            return returnGraphics;
        }

        // grid layout
        const baseSize = this.symbolBaseSize;
        const pointsCount = mostFeatures.length;
        // calculate grid
        // 1 feature -> gridSize = 1; 2-4 features -> gridSize = 2; >4 features -> gridSize= 3
        const gridSize = Math.ceil(Math.sqrt(pointsCount));
        const columnsCount = gridSize;
        const rowsCount = Math.ceil(pointsCount / gridSize);

        const maxClusterSize = 3 * baseSize;
        const clusterSymbolsBackground = this.clusterSymbolProvider.getClusterSymbolsBackground(
            columnsCount, rowsCount, baseSize, !this.showClusterGridBackground);
        clusterSymbolsBackground.set("size", (Math.min(maxClusterSize, gridSize * baseSize)));
        //clusterSymbolsBackground.set("angle", this._getRotation());
        returnGraphics.push(new Graphic(
            {
                geometry: point,
                symbol: clusterSymbolsBackground,
                attributes: clusterAttributes,
                popupTemplate: this.showClusterPopup ? clusterPopupTemplate : null
            }
        ));

        // add symbols
        const differentSymbolPoints = mostFeatures.map(() => point.clone());
        this._alignSymbolsInGrid(differentFeatureSymbols, gridSize, baseSize);

        differentSymbolPoints.forEach((symbolPoint, i) => {
            returnGraphics.push(new Graphic(
                {
                    geometry: symbolPoint,
                    symbol: differentFeatureSymbols[i],
                    attributes: clusterAttributes
                }
            ));
        });

        // add labels
        if (this.showClusterGridCounts) {
            const differentLabelPoints = mostFeatures.map(() => point.clone());
            const differentFeatureLabels = this._getLabelsForGrid(mostFeatures);
            this._alignSymbolsInGrid(differentFeatureLabels, gridSize, baseSize);

            differentLabelPoints.forEach((labelPoint, i) => {
                returnGraphics.push(new Graphic({
                    geometry: labelPoint,
                    symbol: differentFeatureLabels[i],
                    attributes: clusterAttributes
                }));
            });
        }

        return returnGraphics;
    }

    getSpiderfyingGraphics(cluster) {
        const point = new Point(cluster.x, cluster.y, cluster.spatialReference);
        const returnGraphics = [];
        // create graphics for cluster
        const baseSize = this.symbolBaseSize;
        const data = this._getDataForSpiderfying(cluster);
        const spiderfyingPoints = data.map(() => point.clone());
        this._alignPointsInSpiderfying(spiderfyingPoints, baseSize);

        data.forEach((d, i) => {
            const popupTemplate = this.popupTemplates[d.layerId];
            if (d.attributes) {
                // add line symbol
                const offsetPoint = spiderfyingPoints[i];
                const line = new Polyline({
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
                returnGraphics.push(new Graphic({
                    geometry: line,
                    symbol: this.clusterSymbolProvider.getSpiderfyingLineSymbol()
                }));
                // add symbol
                returnGraphics.push(new Graphic({
                    geometry: offsetPoint,
                    symbol: d.symbol,
                    attributes: d.attributes,
                    popupTemplate: popupTemplate || this.popupTemplate
                }));

                const center = new Graphic({
                    geometry: point,
                    symbol: this.clusterSymbolProvider.getSpiderfyingSymbolCircle(),
                    attributes: d.attributes,
                    popupTemplate: popupTemplate || this.popupTemplate
                });
                returnGraphics.push(center);
            }
        });
        return returnGraphics;
    }

    offsetToDistance(value) {
        const clusterResolution = this.mapWidgetModel.get("view").resolution || 1;
        return value * clusterResolution;
    }

    getSymbolForFeature(feature) {
        let featureSymbol;
        if (this.useDefaultSymbolForFeatures) {
            featureSymbol = this.featureSymbolProvider.getFeatureSymbol();
        } else {
            featureSymbol = feature.symbol;
            if (!featureSymbol) {
                const rendererJson = this.rendererProvider.getRendererForLayer(feature.layerId);
                const tmpRenderer = jsonUtils.fromJSON(rendererJson);
                featureSymbol = tmpRenderer.getSymbol(feature);
            }
            if (!featureSymbol) {
                featureSymbol = this.featureSymbolProvider.getFeatureSymbol();
            }
        }
        this._setSymbolSize(featureSymbol);
        return featureSymbol;
    }

    _setSymbolSize(symbol) {
        const baseSize = this.symbolBaseSize;
        if (symbol.height) {
            const w = baseSize / symbol.width;
            const h = baseSize / symbol.height;
            if (w > h) {
                symbol.set("width", symbol.width * w);
                symbol.set("height", symbol.height * w);
            } else {
                symbol.set("width", symbol.width * h);
                symbol.set("height", symbol.height * h);
            }
        } else if (symbol.size) {
            symbol.set("size", baseSize);
        }
    }

    _getDataForSpiderfying(cluster) {
        const allFeatures = cluster.attributes.features;
        return allFeatures.map((feature) => {
            return {
                symbol: this.getSymbolForFeature(feature).clone(),
                layerId: feature.layerId,
                attributes: feature.attributes
            };
        });
    }

    _getMostFeatures(allFeatures, maxNumberOfFeatures) {
        const countObjects = {};
        allFeatures.forEach((feature) => {
            if (!countObjects[feature.layerId]) {
                const symbol = this.getSymbolForFeature(feature).clone();
                symbol.featureAttributes = feature.attributes;
                countObjects[feature.layerId] = {
                    count: 1,
                    layerId: feature.layerId,
                    layerTitle: feature.layerTitle,
                    symbol: symbol
                };
            } else {
                countObjects[feature.layerId].count++;
            }
        });
        const sortableCountObjects = Object.entries(countObjects).map((obj) => obj[1]);
        sortableCountObjects.sort((a, b) => b.count - a.count);
        const result = [];
        sortableCountObjects.some((obj) => {
            if (result.length >= maxNumberOfFeatures) {
                return false;
            }
            result.push(obj);
        });
        return result;
    }

    _getLabelsForGrid(mostFeatures) {
        const that = this;
        return mostFeatures.map((obj) => that.clusterSymbolProvider.getClusterLabel(obj.count, that.clusterLabelOffset));
    }

    /**
     * Returns for the specified features, that might originate from different layers, one feature for each
     * of the layers.
     * @param allFeatures
     * @param mostFeatures
     * @private
     */
    _getFeaturesFromDifferentLayers(allFeatures, mostFeatures) {
        const layerIds = [];
        mostFeatures.forEach((infos) => {
            layerIds.push(infos.layerId);
        });
        const hash = {};
        allFeatures.forEach((feature) => {
            if (layerIds.indexOf(feature.layerId.toString()) !== -1)
                hash[feature.layerId] = feature;
        });
        const featuresFromDifferentLayers = [];
        layerIds.forEach((layerId) => {
            featuresFromDifferentLayers.push(hash[layerId]);
        });
        return featuresFromDifferentLayers;
    }

    /**
     *
     * @param symbols The symbols to display and align within the grid.
     * @param gridSize An integer that specifies whether it's a 1x1, 2x2, 3x3, etc. grid.
     * @param baseSize The distance between two symbols within the cluster.
     * @private
     */
    _alignSymbolsInGrid(symbols, gridSize, baseSize) {
        const size = baseSize;
        // This calculates how many columns and rows are needed to display the symbols in the cluster.
        const gridSizeX = Math.min(gridSize, symbols.length);
        const gridSizeY = Math.ceil(symbols.length / gridSize);
        const offsetOriginX = (gridSizeX - 1) * size;
        const offsetOriginY = (gridSizeY - 1) * size;
        symbols.forEach((symbol, index) => {
            // This calculates the offset of the current symbol within the cluster.
            const xOffset = -offsetOriginX / 2 + index % gridSize * size;
            const yOffset = offsetOriginY / 2 - Math.floor(index / gridSize) * size;
            symbol.xoffset = xOffset;
            symbol.yoffset = yOffset;
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
        const spiderfyingDistanceMultiplier = this.spiderfyingDistanceMultiplier;
        const spiderfyingCount = points.length;
        //if there's an even amount of flares, position the first flare to the left, minus 180 from degree to do this.
        //for an add amount position the first flare on top, -90 to do this. Looks more symmetrical this way.
        const circleStartAngle = spiderfyingCount % 2 === 0 ? -180 * (Math.PI / 180) : -90 * (Math.PI / 180);
        const circumference = spiderfyingDistanceMultiplier * baseSize * (3 + spiderfyingCount);
        const radius = circumference / (2 * Math.PI);
        //radius from circumference
        const angleStep = 2 * Math.PI / spiderfyingCount;
        let i;
        let angle;
        for (i = spiderfyingCount - 1; i >= 0; i--) {
            angle = circleStartAngle + i * angleStep;
            const xOffset = radius * Math.cos(angle);
            const yOffset = radius * Math.sin(angle);
            points[i].offset(this.offsetToDistance(xOffset), this.offsetToDistance(yOffset));
        }
    }

    _allignPointsInSpiral(points, baseSize) {
        const spiderfyingDistanceMultiplier = this.spiderfyingDistanceMultiplier;
        const spiderfyingCount = points.length;
        let radius = spiderfyingDistanceMultiplier * this.spiralLengthStart;
        const separation = /*spiderfyingDistanceMultiplier * */ baseSize;
        const lengthFactor = spiderfyingDistanceMultiplier * this.spiralLengthFactor * (2 * Math.PI);
        let angle = 0;
        let i;
        // Higher index, closer position to cluster center.
        for (i = spiderfyingCount - 1; i >= 0; i--) {
            angle += separation / radius + i * 0.0005;
            const xOffset = radius * Math.cos(angle);
            const yOffset = radius * Math.sin(angle);
            points[i].offset(this.offsetToDistance(xOffset), this.offsetToDistance(yOffset));
            radius += lengthFactor / angle;
        }
    }

    _getRotation() {
        let rotation = 0;
        const viewmode = this.mapWidgetModel.get("viewmode");
        if (viewmode === "2D") {
            rotation = this.mapWidgetModel.get("rotation") * -1;
        } else {
            const camera = this.mapWidgetModel.get("camera");
            rotation = camera && camera.get("heading");
        }
        return rotation;
    }

    _getClusterPopupTemplate() {
        const linkContent = new CustomContent({
            outFields: ["*"],
            creator: (evt) => {
                const graphic = evt.graphic ? evt.graphic : evt;
                const widget = this.clusterPopupWidgetFactory.getWidget(graphic);
                widget.startup();
                return widget.domNode;
            }
        });

        return {
            "title": this.clusterFeatureLayerTitle + ": {clusterCount} " + this.i18n.ui.features,
            "content": [linkContent]
        };
    }
}
