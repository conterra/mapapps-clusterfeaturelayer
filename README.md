# ClusterFeatureLayer Bundle
The ClusterFeatureLayer bundle allows you to cluster features for any point feature service.

## Important
Based on the Esri Cluster Layer JS provides here: https://github.com/Esri/cluster-layer-js

## Sample Apps
https://demos.conterra.de/mapapps/resources/apps/downloads_clusterfeaturelayer4/index.html
https://demos.conterra.de/mapapps/resources/apps/downloads_clusterfeaturelayer4_2/index.html

![Screenshot ClusterFeature Sample App](https://github.com/conterra/mapapps-clusterfeaturelayer/blob/master/screenshot.JPG)

## Installation Guide
1. First, you need to add the bundle "dn_clusterfeaturelayer" to your app.
2. After that, you can change the type of any Map- or FeatureService to "CLUSTER_FEATURE_LAYER".

### Configuration of dn_clusterfeaturelayer:

#### Layer-Config-Sample:
```
"map-init": {
    "Config": {
        "map": {
            "layers": [
                {
                    "id": "clusterlayer",
                    "title": "Clusterlayer",
                    "type": "CLUSTER_FEATURE_LAYER",
                    "elevationInfo": {
                        "mode": "on-the-ground"
                    },
                    "layers": [
                        {
                            "id": "koeln",
                            "title": "Köln",
                            "url": "https://services.conterra.de/arcgis/rest/services/common/koeln/MapServer",
                            "sublayers": [
                                {
                                    "id": "1"
                                },
                                {
                                    "id": "2"
                                },
                                {
                                    "id": "3"
                                },
                                {
                                    "id": "5"
                                },
                                {
                                    "id": "6"
                                },
                                {
                                    "id": "7"
                                },
                                {
                                    "id": "9"
                                },
                                {
                                    "id": "10"
                                },
                                {
                                    "id": "11"
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
                        "maxClusterScale": 500,
                        "symbolBaseSize": 25,
                        "showClusterGrid": true,
                        "showClusterGridCounts": true,
                        "showClusterGridBackground": false,
                        "showClusterArea": false,
                        "showClusterSize": true,
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

##### Properties
| Property                       | Type    | Possible Values               | Default        | Description                          |
|--------------------------------|---------|-------------------------------|----------------|--------------------------------------|
| objectIdField                  | String  |                               | ```objectid``` | Object id field                      |
| clusterDistance                | number  |                               | ```100```      | Cluster distance in pixels           |
| spiderfyingDistance            | number  |                               | ```1```        | Spiderfying distance in pixels       |
| returnLimit                    | number  |                               | ```1000```     | Service return limit                 |
| maxClusterScale                | number  |                               | ```0```        | Max cluster scale                    |
| symbolBaseSize                 | number  |                               | ```30```       | Symbol base size                     |
| showClusterGrid                | boolean | ```true``` &#124; ```false``` | ```true```     | Use the cluster grid style           |
| showClusterGridCounts          | boolean | ```true``` &#124; ```false``` | ```true```     | Show cluster grid counts             |
| showClusterGridBackground      | boolean | ```true``` &#124; ```false``` | ```false```    | Show cluster grid background         |
| showClusterArea                | boolean | ```true``` &#124; ```false``` | ```true```     | Show the area of a cluster           |
| showClusterSize                | boolean | ```true``` &#124; ```false``` | ```false```    | Show the size of a cluster           |
| useDefaultSymbolForFeatures    | boolean | ```true``` &#124; ```false``` | ```false```    | Use default symbols for features     |
| clusterLabelOffset             | number  |                               | ```-10```      | Size of the label offset             |

#### Configurable Components of dn_clusterfeaturelayer:

##### ClusterSymbolProvider:
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

###### Properties
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

Development Guide
------------------
### Define the mapapps remote base
Before you can run the project you have to define the mapapps.remote.base property in the pom.xml-file:
`<mapapps.remote.base>http://%YOURSERVER%/ct-mapapps-webapp-%VERSION%</mapapps.remote.base>`

##### Other methods to to define the mapapps.remote.base property.
1. Goal parameters
`mvn install -Dmapapps.remote.base=http://%YOURSERVER%/ct-mapapps-webapp-%VERSION%`

2. Build properties
Change the mapapps.remote.base in the build.properties file and run:
`mvn install -Denv=dev -Dlocal.configfile=%ABSOLUTEPATHTOPROJECTROOT%/build.properties`

