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
import domGeometry from "dojo/dom-geometry";
import domStyle from "dojo/dom-style";

const getPositionForBoxInContainer = (containerSize, boxSize, boxRootPosition, offset) => {
    const finalPosition = {
        x: boxRootPosition.x + offset.x,
        y: boxRootPosition.y + offset.y
    };
    if (finalPosition.x + boxSize.width > containerSize.width) {
        finalPosition.x = boxRootPosition.x - boxSize.width - offset.x;
    }
    if (finalPosition.y + boxSize.height > containerSize.height) {
        finalPosition.y = boxRootPosition.y - boxSize.height - offset.y;
    }
    return finalPosition;
};

const positionNodeInContainer = (node, containerNode, nodeRootPosition, offset) => {
    const containerMarginBox = domGeometry.getMarginBox(containerNode);
    const containerSize = {
        width: containerMarginBox.w,
        height: containerMarginBox.h
    };
    const boxMarginBox = domGeometry.getMarginBox(node);
    const boxSize = {
        width: boxMarginBox.w,
        height: boxMarginBox.h
    };
    if (!offset) {
        offset = {
            x: 0,
            y: 0
        };
    }
    const position = getPositionForBoxInContainer(containerSize, boxSize, nodeRootPosition, offset);
    domStyle.set(node, "left", position.x + "px");
    domStyle.set(node, "top", position.y + "px");
};

module.exports = {positionNodeInContainer: positionNodeInContainer};
