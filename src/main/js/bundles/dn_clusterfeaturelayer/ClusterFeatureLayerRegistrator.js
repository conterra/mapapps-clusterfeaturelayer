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

        "ct/mapping/map/EsriLayerFactory",
        "ct/mapping/map/EsriService",
        "ct/mapping/mapcontent/ServiceTypes"
    ],
    function (declare,
              EsriLayerFactory, EsriService, ServiceTypes) {
        return declare([], {
            start: function (bundleContext) {
                this._bundleContext = bundleContext;
                var factory = this._getComponentInstance("dn_clusterfeaturelayer.ClusterFeatureLayerFactory");

                this.register(factory);
            },

            stop: function () {
                this.unregister();
            },

            register: function (layerFactory) {
                var type = ServiceTypes.CLUSTER_FEATURE_LAYER = "CLUSTER_FEATURE_LAYER";
                EsriLayerFactory.globalServiceFactories[type] = {
                    create: function (node, url, mapModel, mapState) {
                        return new EsriService({
                            mapModelNode: node,

                            createEsriLayer: function () {
                                return layerFactory.createEsriLayer(node, mapModel, mapState);
                            }
                        });
                    }
                };
            },

            unregister: function () {
                EsriLayerFactory.globalServiceFactories[ServiceTypes.CLUSTER_FEATURE_LAYER] = null;
                ServiceTypes.CLUSTER_FEATURE_LAYER = null;
            },

            _getComponentInstance: function (serviceInterfaceName) {
                var bundleContext = this._bundleContext;
                var propertiesComponentReference = bundleContext.getServiceReferences(serviceInterfaceName)[0];
                return bundleContext.getService(propertiesComponentReference);
            }
        });
    });