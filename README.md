# ClusterFeatureLayer Bundle

The ClusterFeatureLayer Bundle allows you to cluster features for any point feature service.

###Important
Based on the Esri Cluster Layer JS provides here: https://github.com/Esri/cluster-layer-js

### Sample App ###
http://www.mapapps.de/mapapps/resources/apps/???/index.html

### Define the mapapps remote base
Before you can run the project you have to define the mapapps.remote.base property in the pom.xml-file:
`<mapapps.remote.base>http://%YOURSERVER%/ct-mapapps-webapp-%VERSION%</mapapps.remote.base>`

##### Other methods to to define the mapapps.remote.base property.
1. Goal parameters
`mvn install -Dmapapps.remote.base=http://%YOURSERVER%/ct-mapapps-webapp-%VERSION%`

2. Build properties
Change the mapapps.remote.base in the build.properties file and run:
`mvn install -Denv=dev -Dlocal.configfile=%ABSOLUTEPATHTOPROJECTROOT%/build.properties`

Installation Guide
------------------
1. First, you need to add the bundle "dn_clusterfeaturelayer" to your app.
2. After that, you can change the type of any service to "CLUSTER_FEATURE_LAYER".

##### Example:
```
"MappingResourceRegistryFactory": {
  "_knownServices": {
    "services": [
      {
        "id": "service_54146",
        "url": "http://services.conterra.de/arcgis/rest/services/training/stoerungen/FeatureServer",
        "type": "CLUSTER_FEATURE_LAYER",
        "title": "St\u00F6rungen",
        "description": "Karte mit fiktiven St\u00F6rungsmeldungen f\u00FCr map.apps Trainings.",
        "layers": [
          {
            "id": "0",
            "title": "St\u00F6rungen"
          }
        ],
        "options": {}
      }
    ]
  }
}
```

You can configure the ClusterFeatureLayer by changing the ClusterFeatureLayerProperties

##### Example:
```
"ClusterFeatureLayerProperties": {
  "distance": 75,
  "labelColor": "#fff",
  "labelOffset": "-5",
  "useDefaultSymbol": false,
  "zoomOnClick": true,
  "showSingles": true,
  "maxSingles": 1000,
  "returnLimit": 1000,
  "outFields": [
    "*"
  ]
}
```
