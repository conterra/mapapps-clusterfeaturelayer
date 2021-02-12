<!--

    Copyright (C) 2020 con terra GmbH (info@conterra.de)

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

            http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

-->
<template>
    <v-container pa-0>
        <v-list>
            <v-list-tile
                v-for="info in clusterInfos"
                :key="info.layerId"
                avatar
            >
                <v-list-tile-avatar>
                    <img :src="getBase64Image(info.symbol.imageData)">
                </v-list-tile-avatar>
                <v-list-tile-content>
                    {{ info.layerTitle }}: {{ info.count }}
                </v-list-tile-content>
            </v-list-tile>
        </v-list>
    </v-container>
</template>
<script>
    export default {
        props: {
            i18n: {
                type: Object,
                default: function () {
                    return {};
                }
            },
            clusterInfos: {
                type: Object,
                default: function () {
                    return {};
                }
            }
        },
        methods: {
            getBase64Image(imageData) {
                return "data:image/png;base64, " + imageData;
            }
        }
    };
</script>
