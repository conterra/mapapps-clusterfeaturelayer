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
define(["dojo/_base/array"],
    function (d_array) {
        return {
            toPointGraphics: function (features) {
                var len = features.length;
                var graphics = [];
                while (len--) {
                    var feature = features[len];
                    graphics.push(
                        new Graphic(
                            feature.geometry.getCentroid(),
                            feature.symbol, feature.attributes,
                            feature.infoTemplate
                        ));
                }
                return graphics;
            },

            clusterTest: function (p, cluster, maxDistance, clusterResolution) {
                var distance = this.getDistance(cluster, p) / clusterResolution;
                return (distance <= maxDistance);
            },

            haveSamePosition: function (features, clusterCenterPoint, maxDistance, clusterResolution) {
                return d_array.every(features, function (feature) {
                    var distance = clusterResolution ? this.getDistance(feature.geometry, clusterCenterPoint) / clusterResolution : this.getDistance(feature.geometry, clusterCenterPoint);
                    if (distance <= maxDistance) {
                        return true;
                    }
                }, this);
            },

            getDistance: function (p1, p2) {
                return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
            }
        };
    });