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
        "esri/geometry/Extent",
        "./ClusterGeometryFunctions"
    ],
    function (declare, Extent, ClusterGeometryFunctions) {
        return declare([], {
            zoomOnClick: true,

            zoom: function (event) {
                var properties = event.getProperties();
                if (this.zoomOnClick) {
                    var attributes = properties.graphic.attributes;
                    var clusterCenterPoint = properties.graphic.geometry;

                    var mapState = this.mapState;
                    var bBox = attributes.extent;
                    var clusterExtent = new Extent(bBox[0], bBox[1], bBox[2], bBox[3], mapState.getSpatialReference());

                    var features = attributes.features;
                    if (ClusterGeometryFunctions.haveSamePosition(features, clusterCenterPoint, 50)) {
                        return;
                    }

                    if (clusterExtent.getWidth()) {
                        var zoomExtent = clusterExtent;
                        while (zoomExtent.getWidth() < 300 && zoomExtent.getHeight() < 300) {
                            zoomExtent = zoomExtent.expand(1.5);
                        }
                        mapState.setExtent(zoomExtent);
                    } else {
                        mapState.centerAndZoomToScale(clusterCenterPoint, 5000);
                    }
                }
            }
        });
    });