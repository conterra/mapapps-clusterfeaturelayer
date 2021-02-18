/*
 * Copyright (C) 2021 con terra GmbH (info@conterra.de)
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
import Color from "dojo/_base/Color";
import SimpleMarkerSymbol from "esri/symbols/SimpleMarkerSymbol";
import SimpleLineSymbol from "esri/symbols/SimpleLineSymbol";

export default class FeatureSymbolProvider {
    constructor(options) {
        this.symbolColor = options.symbolColor;
        this.borderColor = options.borderColor;
        this.symbolSize = options.symbolSize;
        this.borderSize = options.borderSize;
    }

    getFeatureSymbol() {
        const singleSymbolColor = this.symbolColor;
        const singleBorderColor = this.borderColor;
        const singleSymbolSize = this.symbolSize;
        const singleBorderSize = this.borderSize;
        const lineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color(singleBorderColor), singleBorderSize);
        return new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, singleSymbolSize, lineSymbol, new Color(singleSymbolColor));
    }
}
