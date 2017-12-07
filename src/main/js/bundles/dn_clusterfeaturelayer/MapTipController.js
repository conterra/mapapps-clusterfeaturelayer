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
        "dojo/_base/declare"
    ],
    function (declare) {
        return declare([], {
            fireOnGraphicMouseOut: function (event) {
                var properties = event.getProperties();
                properties.mapModelNodeId = properties.graphic._layer.id;
                this._mapState._fire(properties, "onGraphicMouseOut");
            },

            fireOnGraphicMouseOver: function (event) {
                var properties = event.getProperties();
                properties.graphic.geometry = this.convertScreenPointToMapPoint(properties.screenPoint);
                properties.mapModelNodeId = properties.graphic._layer.id;
                this._mapState._fire(properties, "onGraphicMouseOver");
            },

            convertScreenPointToMapPoint: function (screenPoint) {
                var screenExtent = this._mapState.getViewPort().getScreen();
                var screenUtils = require("esri/geometry/screenUtils");
                return screenUtils.toMapGeometry(this._mapState.getExtent(), screenExtent.getWidth(), screenExtent.getHeight(), screenPoint);
            }
        });
    });