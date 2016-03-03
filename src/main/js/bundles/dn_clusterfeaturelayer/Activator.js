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
    "./ClickListener",
    "ct/mapping/map/EsriLayerFactory",
    "ct/mapping/map/EsriService",
    "ct/mapping/mapcontent/ServiceTypes",
    "ct/_Connect"
], function (declare, d_array, InfoTemplate, ClusterFeatureLayer, ClickListener, EsriLayerFactory, EsriService, ServiceTypes, _Connect) {

    return declare([_Connect], {
        start: function (bundleContext) {
            var clusterFeatureLayerPropertiesComponentReference = bundleContext.getServiceReferences("dn_clusterfeaturelayer.ClusterFeatureLayerProperties")[0];
            var clusterFeatureLayerPropertiesComponent = bundleContext.getService(clusterFeatureLayerPropertiesComponentReference);
            var properties = clusterFeatureLayerPropertiesComponent._properties;

            var type = ServiceTypes.CLUSTER_FEATURE_LAYER = "CLUSTER_FEATURE_LAYER";
            EsriLayerFactory.globalServiceFactories[type] = {
                create: function (node, url, mapModel, mapState) {
                    return new EsriService({
                        mapModelNode: node,
                        createEsriLayer: function () {
                            var layerId = node.children[0].layer.layerId;
                            var url = node.get("url") + "/" + layerId;
                            var infoTemplate = node.get("infoTemplate");
                            var id = "cluster_" + new Date().getTime();

                            // create ClusterFeatureLayer from Url with layerDefinition
                            var layer = this.layer = new ClusterFeatureLayer({
                                "url": url,
                                "id": id,
                                "disablePopup": true,
                                "MODE_SNAPSHOT": true,
                                "singleTemplate": infoTemplate,
                                "objectIdField": properties.objectIdField,
                                "distance": properties.distance,
                                "labelColor": properties.labelColor,
                                "labelOffset": properties.labelOffset,
                                "useDefaultSymbol": properties.useDefaultSymbol,
                                "zoomOnClick": properties.zoomOnClick,
                                //"maxSingles": properties.maxSingles,
                                "showSingles": properties.showSingles,
                                "returnLimit": properties.returnLimit,
                                "outFields": properties.outFields
                            });

                            this.connect(layer, "onClick", function (e) {
                                var contentViewerReference = bundleContext.getServiceReferences("ct.contentviewer.ContentViewer")[0];
                                var contentViewerComponent = bundleContext.getService(contentViewerReference);

                                if (e.graphic.attributes.clusterCount > 1) {

                                } else {
                                    var singles = this.layer._getClusterSingles(e.graphic.attributes.clusterId);
                                    var attributes = singles[0].attributes;
                                    var geometry = singles[0].geometry;
                                    var content = attributes;
                                    content["geometry"] = geometry;
                                    contentViewerComponent.showContentInfo(content);
                                }
                            }, this)
                            return layer;
                        }
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