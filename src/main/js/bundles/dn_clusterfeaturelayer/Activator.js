/*
 * Copyright (C) 2015 con terra GmbH (info@conterra.de)
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
    "dojo/_base/array",
    "esri/InfoTemplate",
    "./ClusterFeatureLayer",
    "ct/mapping/map/EsriLayerFactory",
    "ct/mapping/map/EsriService",
    "ct/mapping/mapcontent/ServiceTypes",
    "ct/_Connect"
], function (declare, d_array, InfoTemplate, ClusterFeatureLayer, EsriLayerFactory, EsriService, ServiceTypes, _Connect) {

    return declare([_Connect], {
        start: function (bundleContext) {
            var type = ServiceTypes.CLUSTER_FEATURE_LAYER = "CLUSTER_FEATURE_LAYER";
            EsriLayerFactory.globalServiceFactories[type] = {
                create: function (node, url, mapModel, mapState) {
                    return new EsriService({
                        mapModelNode: node,
                        createEsriLayer: function () {

                            var layerId = node.children[0].layer.layerId;
                            var url = node.get("url") + "/" + layerId;
                            var infoTemplate = node.get("infoTemplate");

                            // create ClusterFeatureLayer from Url with layerDefinition
                            var layer = this.layer = new ClusterFeatureLayer({
                                "url": url,
                                "distance": 75,
                                "id": "clusters",
                                "labelColor": "#fff",
                                //"resolution": esriMap.extent.getWidth() / esriMap.width,
                                //"singleTemplate": infoTemplate,
                                "useDefaultSymbol": true,
                                "zoomOnClick": true,
                                "showSingles": true,
                                "disablePopup": true,
                                "MODE_SNAPSHOT": false
                            });

                            /*this.connect(layer, "onClick", function (e) {
                                if (e.graphic.attributes.clusterCount === 1) {
                                    var singles = [];
                                    var layer = this.layer;
                                    for (var i = 0, il = layer._clusterData.length; i < il; i++) {
                                        if (e.graphic.attributes.clusterId === layer._clusterData[i].attributes.clusterId) {
                                            singles.push(layer._clusterData[i]);
                                        }
                                    }
                                }
                            });*/

                            return layer;
                        },
                    });
                }
            };
        },
        stop: function () {
            this.disconnect();
            EsriLayerFactory.globalServiceFactories[ServiceTypes.CLUSTER_FEATURE_LAYER] = null;
            ServiceTypes.CLUSTER_FEATURE_LAYER = null;
        }
    });
});