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
import ClusterFeatureLayer from "./ClusterFeatureLayer";
import Collection from "esri/core/Collection";
import Sublayer from "esri/layers/support/Sublayer";

export default class ClusterFeatureLayerTypeFactory {

    constructor() {
        this._clusterLayers = [];
    }

    create(layerArguments) {
        const opt = layerArguments.options;
        let showSpiderfying = true;
        if (opt.showSpiderfying !== undefined) {
            showSpiderfying = opt.showSpiderfying;
        }
        const clusterFeatureLayer = new ClusterFeatureLayer({
            i18n: this._i18n.get(),
            id: layerArguments.id,
            title: layerArguments.title,
            visible: layerArguments.visible,
            minScale: layerArguments.minScale,
            maxScale: layerArguments.maxScale,
            listMode: layerArguments.listMode,
            opacity: layerArguments.opacity,
            elevationInfo: layerArguments.elevationInfo,
            popupTemplate: layerArguments.popupTemplate,
            maptipTemplate: layerArguments.maptipTemplate,
            maptipEnabled: layerArguments.maptipEnabled,
            initiallyExpandedInToc: layerArguments.initiallyExpandedInToc,
            legendEnabled: false,
            popupEnabled: false,
            _objectIdField: opt.objectIdField || "objectid",
            _clusterDistance: opt.clusterDistance || 100,
            _spiderfyingDistance: opt.spiderfyingDistance || 1,
            _maxClusterScale: opt.maxClusterScale || 0,
            _showClusterArea: opt.showClusterArea || false,
            _showSpiderfying: showSpiderfying,
            _zoomOnClusterClick: opt.zoomOnClusterClick,
            _returnLimit: opt.returnLimit || 1000,
            _options: opt,
            _serverRequester: this._serverRequester,
            _mapWidgetModel: this.mapWidgetModel,
            _clusterSymbolProvider: this.clusterSymbolProvider,
            _featureSymbolProvider: this.featureSymbolProvider,
            _clusterPopupWidgetFactory: this._clusterPopupWidgetFactory,
            _eventService: this.eventService
        });

        this.layers = [];
        if (layerArguments.layers) {
            layerArguments.layers.forEach((layer) => {
                layer.sublayers.forEach((children) => {
                    const childrenVisible = children.visible === undefined ? true : children.visible;
                    const sublayer = new Sublayer({
                        layerId: layer.id,
                        sublayerId: children.id,
                        layer: clusterFeatureLayer,
                        parent: clusterFeatureLayer,
                        layerUrl: layer.url,
                        title: children.title || children.id,
                        visible: childrenVisible,
                        popupTemplate: children.popupTemplate
                    });
                    this.layers.push(sublayer);
                });
            });
        }
        const sublayers = new Collection(this.layers).reverse();
        clusterFeatureLayer.sublayers = sublayers;
        clusterFeatureLayer.allSublayers = sublayers;
        clusterFeatureLayer.activateLayer();

        this._clusterLayers.push(clusterFeatureLayer);
        return {instance: clusterFeatureLayer};
    }

    setMapWidgetModel(mapWidgetModel) {
        this.mapWidgetModel = mapWidgetModel;
        this._clusterLayers.forEach((clusterLayer) => {
            clusterLayer.setMapWidgetModel(mapWidgetModel);
            clusterLayer.activateLayer();
        })
    }
}
