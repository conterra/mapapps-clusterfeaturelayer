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
import Vue from "apprt-vue/Vue";
import VueDijit from "apprt-vue/VueDijit";
import ClusterPopupWidget from "./ClusterPopupWidget.vue";

export default class ClusterPopupWidgetFactory {

    getWidget(graphic) {
        const attributes = graphic.attributes;
        const vm = this.vm = new Vue(ClusterPopupWidget);
        vm.clusterInfos = attributes.clusterInfos;
        const i18n = vm.i18n = this._i18n.get().ui;
        vm.i18n = i18n;

        return VueDijit(vm, {class: "clusterPopupWidget"});
    }
}
