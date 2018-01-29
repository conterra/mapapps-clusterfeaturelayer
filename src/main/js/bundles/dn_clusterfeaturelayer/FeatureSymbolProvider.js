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
                this.symbolColor = options.symbolColor;
                this.borderColor = options.borderColor;
                this.symbolSize = options.symbolSize;
                this.borderSize = options.borderSize;
            },

            getFeatureSymbol: function () {
                var singleSymbolColor = this.symbolColor;
                var singleBorderColor = this.borderColor;
                var singleSymbolSize = this.symbolSize;
                var singleBorderSize = this.borderSize;

                var lineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color(singleBorderColor), singleBorderSize);
                return new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, singleSymbolSize, lineSymbol, new Color(singleSymbolColor));
            }
        });
    });