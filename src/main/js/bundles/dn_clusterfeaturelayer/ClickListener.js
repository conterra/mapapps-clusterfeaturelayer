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
    "dojo/aspect"
], function (declare, d_aspect) {
    return declare([], {
        activate: function () {
            /*//var showGraphicContent = this._showGraphicContent;

            d_aspect.before(showGraphicContent, "showContent", function (evt) {
                var attributes = evt.graphic.attributes;
                if (attributes.clusterId && !attributes.clusterCount) {
                    this._enabled = true;
                } else if (attributes.clusterId && attributes.clusterCount) {
                    this._enabled = false;
                }
                return [evt];
            });

            d_aspect.after(showGraphicContent, "showContent", function (evt) {
                this._enabled = true;
            });*/
        }
    });
});