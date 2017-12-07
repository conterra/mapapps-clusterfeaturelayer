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
        "dojo/_base/Color",

        "esri/symbols/SimpleMarkerSymbol",
        "esri/symbols/SimpleLineSymbol"
    ],
    function (declare, Color,
              SimpleMarkerSymbol, SimpleLineSymbol) {
        return declare([], {
            constructor: function (options) {
                this.symbolColor = options.symbolColor || [255, 170, 0, 0.8];
                this.borderColor = options.borderColor || [255, 170, 0, 0.4];
                this.symbolSize = options.symbolSize || 25;
                this.borderSize = options.borderSize || 10;
            },

            getFeatureSymbol: function () {
                var singleSymbolColor = this.symbolColor || [255, 255, 255];
                var singleBorderColor = this.borderColor || [255, 255, 255];
                var singleSymbolSize = this.symbolSize || 6;
                var singleBorderSize = this.borderSize || 1;

                var lineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color(singleBorderColor), singleBorderSize);
                return new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, singleSymbolSize, lineSymbol, new Color(singleSymbolColor));
            }
        });
    });