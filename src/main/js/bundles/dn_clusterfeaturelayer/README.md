# dn_clusterfeaturelayer
The ClusterFeatureLayer bundle allows you to cluster features for any point feature service.

## Important
Based on the Esri Cluster Layer JS provides here: https://github.com/Esri/cluster-layer-js

## Usage
1. First, you need to add the bundle "dn_clusterfeaturelayer" to your app.
2. After that, you can change the type of any Map- or FeatureService to "CLUSTER_FEATURE_LAYER".

### Layer-Config-Sample:
```json
"map-init": {
    "Config": {
        "map": {
            "layers": [
                {
                    "id": "clusterlayer",
                    "title": "Köln",
                    "type": "CLUSTER_FEATURE_LAYER",
                    "elevationInfo": {
                        "mode": "on-the-ground"
                    },
                    "layers": [
                        {
                            "id": "koeln",
                            "url": "https://services.conterra.de/arcgis/rest/services/common/koeln/MapServer",
                            "sublayers": [
                                {
                                    "id": "1",
                                    "title": "Veranstaltungsorte"
                                },
                                {
                                    "id": "2",
                                    "title": "Spiel- und Sportplätze"
                                },
                                {
                                    "id": "3",
                                    "title": "Sehenswürdigkeiten"
                                },
                                {
                                    "id": "5",
                                    "title": "Schulen"
                                },
                                {
                                    "id": "6",
                                    "title": "Museen"
                                },
                                {
                                    "id": "7",
                                    "title": "Bibliotheken"
                                }
                            ]
                        }
                    ],
                    "visible": true,
                    "popupEnabled": true,
                    "popupTemplate": {
                        "title": "{SUBJECT}",
                        "content": "<p>{ADDITIONAL1}</p><div>{STREET} {HOUSENUMBER}, {ZIPCODE} {CITY}</div><div>{INTERNET}</div><div>{PHONE1_NUMBER}</div>"
                    },
                    "outFields": [
                        "*"
                    ],
                    "options": {
                        "objectIdField": "objectid",
                        "clusterDistance": 100,
                        "spiderfyingDistance": 1,
                        "returnLimit": 1000,
                        "maxClusterScale": 0,
                        "symbolBaseSize": 25,
                        "showClusterGrid": true,
                        "showClusterGridCounts": true,
                        "showClusterGridBackground": false,
                        "showClusterArea": false,
                        "showClusterSize": true,
                        "showSpiderfying": true,
                        "useDefaultSymbolForFeatures": false,
                        "clusterLabelOffset": -4
                    }
                }
            ],
            ...
        },
        ...
    }
}
```

| Property                       | Type    | Possible Values               | Default        | Description                                                                              |
|--------------------------------|---------|-------------------------------|----------------|------------------------------------------------------------------------------------------|
| objectIdField                  | String  |                               | ```objectid``` | Object id field                                                                          |
| clusterDistance                | number  |                               | ```100```      | Cluster distance in pixels                                                               |
| spiderfyingDistance            | number  |                               | ```1```        | Spiderfying distance in pixels                                                           |
| returnLimit                    | number  |                               | ```1000```     | Service return limit                                                                     |
| maxClusterScale                | number  |                               | ```0```        | Max cluster scale                                                                        |
| symbolBaseSize                 | number  |                               | ```30```       | Symbol base size                                                                         |
| showClusterGrid                | boolean | ```true``` &#124; ```false``` | ```true```     | Use the cluster grid style                                                               |
| showClusterGridCounts          | boolean | ```true``` &#124; ```false``` | ```true```     | Show cluster grid counts (This property is currently not supported in 3D SceneViews)     |
| showClusterGridBackground      | boolean | ```true``` &#124; ```false``` | ```false```    | Show cluster grid background (This property is currently not supported in 3D SceneViews) |
| showClusterArea                | boolean | ```true``` &#124; ```false``` | ```true```     | Show the area of a cluster                                                               |
| showClusterSize                | boolean | ```true``` &#124; ```false``` | ```false```    | Show the size of a cluster                                                               |
| showSpiderfying                | boolean | ```true``` &#124; ```false``` | ```true```     | Show the spiderfying                                                                     |
| useDefaultSymbolForFeatures    | boolean | ```true``` &#124; ```false``` | ```false```    | Use default symbols for features                                                         |
| clusterLabelOffset             | number  |                               | ```-10```      | Size of the label offset                                                                 |

## Configurable Components of dn_clusterfeaturelayer:

### ClusterSymbolProvider:
```
"ClusterSymbolProvider": {
    "clusterBackgroundSymbolColor": [
        200,
        200,
        200,
        0.5
    ],
    "clusterBackgroundBorderColor": [
        0,
        0,
        0,
        1
    ],
    "clusterBackgroundBorderSize": 0.5,
    "clusterAreaSymbolColor": [
        255,
        255,
        0,
        0.25
    ],
    "clusterAreaSymbolBorderColor": [
        0,
        0,
        0,
        1
    ],
    "clusterAreaSymbolBorderSize": 0.5,
    "clusterSingleSymbolColor": [
        140,
        177,
        210,
        0.75
    ],
    "clusterSingleSymbolBorderColor": [
        140,
        177,
        210,
        0.35
    ],
    "clusterSingleSymbolBorderSize": 20,
    "spiderfyingLineColor": [
        0,
        0,
        0,
        1
    ],
    "spiderfyingLineSize": 0.5,
    "spiderfyingCenterColor": [
        0,
        0,
        0,
        1
    ],
    "spiderfyingCenterSize": 5,
    "labelColor": [
        0,
        0,
        0,
        1
    ],
    "labelHaloColor": [
        255,
        255,
        255,
        1
    ],
    "labelHaloSize": "1",
    "labelFontSize": "10pt",
    "labelFontFamily": "Arial"
}
```

| Property                       | Type    | Possible Values                 | Default    | Description                          |
|--------------------------------|---------|---------------------------------|------------|--------------------------------------|
| clusterBackgroundSymbolColor   | Array   |                                 |            | Cluster grid background color        |
| clusterBackgroundBorderColor   | Array   |                                 |            | Cluster grid background border color |
| clusterBackgroundBorderSize    | number  |                                 | ```0.5```  | Cluster grid background border size  |
| clusterAreaSymbolColor         | Array   |                                 |            | Cluster area symbol color            |
| clusterAreaSymbolBorderColor   | Array   |                                 |            | Cluster area symbol border color     |
| clusterAreaSymbolBorderSize    | number  |                                 | ```0.5```  | Cluster area symbol border size      |
| clusterSingleSymbolColor       | Array   |                                 |            | Single cluster symbol color          |
| clusterSingleSymbolBorderColor | Array   |                                 |            | Single cluster border color          |
| clusterSingleSymbolBorderSize  | number  |                                 | ```20```   | Single cluster border size           |
| spiderfyingLineColor           | Array   |                                 |            | Spiderfying line color               |
| spiderfyingLineSize            | number  |                                 | ```0.5```  | Spiderfying line size                |
| spiderfyingCenterColor         | Array   |                                 |            | Spiderfying center color             |
| spiderfyingCenterSize          | number  |                                 | ```5```    | Spiderfying center size              |
| labelColor                     | Array   |                                 |            | Label color                          |
| labelHaloColor                 | Array   |                                 |            | Label halo color                     |
| labelHaloSize                  | number  |                                 | ```1```    | Label halo size                      |
| labelFontSize                  | String  |                                 | ```10pt``` | label font size                      |
| labelFontFamily                | String  |                                 | ```Arial```| Label font family                    |
