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
        "dojo/string",
        "dojo/_base/Color",
        "esri/symbols/SimpleMarkerSymbol",
        "esri/symbols/SimpleLineSymbol",
        "esri/symbols/SimpleFillSymbol",
        "esri/symbols/Font",
        "esri/symbols/TextSymbol"
    ],
    function (declare, d_string, Color, SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, Font, TextSymbol) {
        return declare([], {
            constructor: function (options) {

                this.clusterSymbolSize = options.clusterSymbolSize || 25;

                this.clusterBackgroundSymbolColor = options.clusterBackgroundSymbolColor;
                this.clusterBackgroundBorderColor = options.clusterBackgroundBorderColor;
                this.clusterBackgroundBorderSize = options.clusterBackgroundBorderSize;

                this.clusterAreaSymbolColor = options.clusterAreaSymbolColor;
                this.clusterAreaSymbolBorderColor = options.clusterAreaSymbolBorderColor;
                this.clusterAreaSymbolBorderSize = options.clusterAreaSymbolBorderSize;

                this.clusterSingleSymbolColor = options.clusterSingleSymbolColor;
                this.clusterSingleSymbolBorderColor = options.clusterSingleSymbolBorderColor;
                this.clusterSingleSymbolBorderSize = options.clusterSingleSymbolBorderSize;

                this.spiderfyingLineSize = options.spiderfyingLineSize;
                this.spiderfyingLineColor = options.spiderfyingLineColor;
                this.spiderfyingCenterColor = options.spiderfyingCenterColor;
                this.spiderfyingCenterSize = options.spiderfyingCenterSize;

                this.labelColor = options.labelColor;
                this.labelHaloColor = options.labelHaloColor;
                this.labelFontSize = options.labelFontSize || "10pt";
                this.labelHaloSize = options.labelHaloSize || "10pt";
                this.labelFontFamily = options.labelFontFamily || "Arial";
            },

            getClusterSymbolCircle: function (clusterCount, small, medium, xl, xxl, max) {
                var size = 25;

                if (0 <= clusterCount && clusterCount < small) {
                    size = 25;
                } else if (small <= clusterCount && clusterCount < medium) {
                    size = 25;
                } else if (medium <= clusterCount && clusterCount < xl) {
                    size = 75;
                } else if (xl <= clusterCount && clusterCount < xxl) {
                    size = 100;
                } else if (xxl <= clusterCount && clusterCount <= max) {
                    size = 125;
                }

                var lineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color(this.clusterSingleSymbolBorderColor), this.clusterSingleSymbolBorderSize);
                return new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, size, lineSymbol, new Color(this.clusterSingleSymbolColor));
            },

            getSpiderfyingSymbolCircle: function () {
                return new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, this.spiderfyingCenterSize, null, new Color(this.spiderfyingCenterColor));
            },

            getAreaSymbol: function () {
                return new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color(this.clusterAreaSymbolBorderColor), this.clusterAreaSymbolBorderSize), new Color(this.clusterAreaSymbolColor));
            },

            getClusterSymbolsBackground: function (width, height, transparent) {
                var lineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color(this.clusterBackgroundBorderColor), this.clusterBackgroundBorderSize);
                var symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_PATH, this.clusterSymbolSize, lineSymbol, new Color(this.clusterBackgroundSymbolColor));
                if (transparent) {
                    lineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0, 0, 0, 0]), 0);
                    symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_PATH, this.clusterSymbolSize, lineSymbol, new Color([0, 0, 0, 0]));
                }

                var pathString = d_string.substitute("M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} z", {
                    width: width,
                    height: height
                });
                symbol.setPath(pathString);
                return symbol;
            },

            getSpiderfyingLineSymbol: function () {
                return new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color(this.spiderfyingLineColor), this.spiderfyingLineSize);
            },

            getClusterLabel: function (labelText) {
                var font = new Font(this.labelFontSize).setFamily(this.labelFontFamily);
                return new TextSymbol(labelText)
                    .setColor(new Color(this.labelColor))
                    .setHaloColor(new Color(this.labelHaloColor))
                    .setHaloSize(this.labelHaloSize)
                    .setVerticalAlignment("middle")
                    .setFont(font);
            }
        });
    });