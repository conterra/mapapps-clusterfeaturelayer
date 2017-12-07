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
        "ct/array"
    ],
    function (declare, ct_array) {
        return declare([], {
            _serviceMetadata: null,

            constructor: function (serviceMetadata) {
                this._serviceMetadata = serviceMetadata;
            },

            getRendererForLayer: function (layerId) {
                var metadata = this._serviceMetadata;
                var url = ct_array.arraySearchFirst(metadata.urls, function (url) {
                    return layerId === url.id;
                }).url;
                var details = ct_array.arraySearchFirst(metadata.details, function (detail) {
                    return url === detail.url;
                });
                var id = layerId.split("/")[layerId.split("/").length - 1];
                return details.layers[id] && details.layers[id].drawingInfo.renderer;
            }
        });
    });