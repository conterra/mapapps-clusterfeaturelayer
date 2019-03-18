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
export const toPointGraphics = (features) => {
    let len = features.length;
    let graphics = [];
    while (len--) {
        let feature = features[len];
        graphics.push(new Graphic(feature.geometry.getCentroid(), feature.symbol, feature.attributes, feature.infoTemplate));
    }
    return graphics;
};

export const clusterTest = (p, cluster, maxDistance, clusterResolution) => {
    let distance = getDistance(cluster, p) / clusterResolution;
    return distance <= maxDistance;
};

export const haveSamePosition = (features, clusterCenterPoint, maxDistance, clusterResolution) => {
    return features.every((feature) => {
        let distance = clusterResolution ? getDistance(feature.geometry, clusterCenterPoint) / clusterResolution : getDistance(feature.geometry, clusterCenterPoint);
        if (distance <= maxDistance) {
            return true;
        }
    }, this);
};

export const getDistance = (p1, p2) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};