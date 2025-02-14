/*
 * Copyright (C) 2025 con terra GmbH (info@conterra.de)
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
export default class ServiceMetadataProvider {
    constructor(serviceMetadata) {
        this._serviceMetadata = serviceMetadata;
    }

    getRendererForLayer(layerId) {
        const metadata = this._serviceMetadata;
        const sublayer = metadata.sublayers.find((layer) => layerId === layer.layerId + "/" + layer.sublayerId);
        const url = sublayer.layerUrl;
        const details = metadata.details.find((detail) => url === detail.url);
        const id = sublayer.sublayerId;
        const detail = details.layers.find((layer) => layer.id.toString() === id);
        return detail && detail.drawingInfo && detail.drawingInfo.renderer;
    }
}
