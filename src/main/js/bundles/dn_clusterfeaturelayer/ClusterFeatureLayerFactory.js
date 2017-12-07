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
        "dojo/_base/array",

        "ct/_Connect",

        "./ClusterFeatureLayer",
        "./FeatureServerRequester",
        "./ClusterGraphicsFactory",
        "./ServiceMetadataProvider"
    ],
    function (declare, d_array,
              _Connect,
              ClusterFeatureLayer, FeatureServerRequester, ClusterGraphicsFactory, ServiceMetadataProvider) {
        return declare([], {
            constructor: function () {
                this._connect = new _Connect();
            },

            createEsriLayer: function (node, mapModel, mapState) {
                this.node = node;
                var that = this;

                var leafNodesArray = node.filterNodes(function (node) {
                    return !node.isContainer();
                });

                var layerObjects = d_array.map(leafNodesArray, function (child) {
                    return {
                        id: child.id,
                        url: child.parent.service && child.parent.service.serviceUrl || child.parent.layer.url
                    }
                });

                var requester = new FeatureServerRequester(layerObjects, mapState.getSpatialReference());

                var layer = this.layer = new ClusterFeatureLayer({
                    id: "clusterlayer",
                    mapState: mapState,
                    mapModel: mapModel,
                    serverRequester: requester,
                    layerObjects: layerObjects,
                    leafNodes: leafNodesArray,
                    objectIdField: node.options.objectIdField || "objectid",
                    clusterDistance: node.options.clusterDistance || 50,
                    spiderfyingDistance: node.options.spiderfyingDistance || 5,
                    maxClusterScale: node.options.maxClusterScale || 1,
                    showClusterArea: node.options.showClusterArea || false
                });

                requester.getServiceMetadata().then(function (serviceDetails) {
                    var metadataProvider = that._getServiceMetadataProvider(serviceDetails);
                    var renderer = that._getClusterGraphicsFactory(that.clusterSymbolProvider, that.featureSymbolProvider, metadataProvider, mapState, node.options);
                    layer.setClusterGraphicsFactory(renderer);
                });

                this._connect.connect(layer, "onClick", this, function (event) {
                    event.node = this.node;
                    this._handleClick(event);
                }, this);
                this._connect.connect(layer, "onMouseOver", this, function (event) {
                    event.node = this.node;
                    this._handleMouseOver(event);
                }, this);
                this._connect.connect(layer, "onMouseOut", this, function (event) {
                    event.node = this.node;
                    this._handleMouseOut(event);
                }, this);
                return layer;
            },

            _getClusterGraphicsFactory: function (clusterSymbolProvider, featureSymbolProvider, metadataProvider, mapState, options) {
                return new ClusterGraphicsFactory(clusterSymbolProvider, featureSymbolProvider, metadataProvider, mapState, options);
            },

            _getServiceMetadataProvider: function (serviceDetails) {
                return new ServiceMetadataProvider(serviceDetails);
            },

            _handleClick: function (event) {
                var attributes = event.graphic.attributes;
                if (!attributes) {
                    return;
                }
                if (!attributes.hasOwnProperty("clusterCount")) {
                    this._eventService.postEvent("ct/dn_clusterfeaturelayer/single-feature-click", event);
                    return;
                }
                if (attributes.hasOwnProperty("features")) {
                    this._eventService.postEvent("ct/dn_clusterfeaturelayer/cluster-click", event);
                }
            },

            _handleMouseOver: function (event) {
                var attributes = event.graphic.attributes;
                if (!attributes) {
                    this._eventService.postEvent("ct/dn_clusterfeaturelayer/no-feature-mouseover", event);
                    return;
                }
                if (!attributes.hasOwnProperty("clusterCount")) {
                    this._eventService.postEvent("ct/dn_clusterfeaturelayer/single-feature-mouseover", event);
                    return;
                }
                if (attributes.hasOwnProperty("clusterCount")) {
                    this._eventService.postEvent("ct/dn_clusterfeaturelayer/cluster-mouseover", event);
                    this.layer.clusterMouseOver(event);
                }
            },

            _handleMouseOut: function (event) {
                var attributes = event.graphic.attributes;
                if (!attributes) {
                    return;
                }
                if (!attributes.hasOwnProperty("clusterCount")) {
                    this._eventService.postEvent("ct/dn_clusterfeaturelayer/single-feature-mouseout", event);
                    return;
                }
                if (attributes.hasOwnProperty("clusterCount")) {
                    this._eventService.postEvent("ct/dn_clusterfeaturelayer/cluster-mouseout", event);
                    this.layer.clusterMouseOut(event);
                }
            }
        });
    });