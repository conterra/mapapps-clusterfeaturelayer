/*
 * Copyright (C) 2019 con terra GmbH (info@conterra.de)
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
import ClusterFeatureLayer from "./ClusterFeatureLayer";
import Collection from "esri/core/Collection";
import Sublayer from "esri/layers/support/Sublayer";

export default class ClusterFeatureLayerTypeFactory {

    constructor() {
        this._clusterLayers = [];
    }

    create(options) {
        let opt = options.options;
        let popupTemplate = options.popupTemplate;
        if (options.layers) {
            this.layers = [];
            options.layers.forEach((layer) => {
                layer.sublayers.forEach((children) => {
                    let sublayer = new Sublayer({
                        layerId: layer.id,
                        sublayerId: children.id,
                        layerUrl: layer.url,
                        title: children.title || children.id,
                        visible: children.visible || true
                    });
                    this.layers.push(sublayer);
                });
            });
        }
        let layer = this.layer = new ClusterFeatureLayer({
            id: options.id,
            title: options.title,
            visible: options.visible,
            minScale: options.minScale,
            maxScale: options.maxScale,
            listMode: options.listMode,
            opacity: options.opacity,
            elevationInfo: options.elevationInfo,
            sublayers: new Collection(this.layers),
            legendEnabled: false,
            popupEnabled: false,
            _objectIdField: opt.objectIdField || "objectid",
            _clusterDistance: opt.clusterDistance || 50,
            _spiderfyingDistance: opt.spiderfyingDistance || 5,
            _maxClusterScale: opt.maxClusterScale || 1,
            _showClusterArea: opt.showClusterArea || false,
            _returnLimit: opt.returnLimit || 1000,
            _options: opt,
            _serverRequester: this._serverRequester,
            _mapWidgetModel: this.mapWidgetModel,
            _popupTemplate: popupTemplate,
            _clusterSymbolProvider: this.clusterSymbolProvider,
            _featureSymbolProvider: this.featureSymbolProvider,
            _eventService: this.eventService
        });
        this._clusterLayers.push(layer);
        return {instance: layer};
    }

    setMapWidgetModel(mapWidgetModel, properties) {
        this.mapWidgetModel = mapWidgetModel;
        this._clusterLayers.forEach((clusterLayer) => {
            clusterLayer.setMapWidgetModel(mapWidgetModel);
        })
    }
}
