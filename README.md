# ClusterFeatureLayer Bundle
The ClusterFeatureLayer bundle allows you to cluster features for any point feature service.

![Screenshot ClusterFeature Sample App](https://github.com/conterra/mapapps-clusterfeaturelayer/blob/master/screenshot.JPG)

## Important
Based on the Esri Cluster Layer JS provides here: https://github.com/Esri/cluster-layer-js

## Sample Apps
https://demos.conterra.de/mapapps/resources/apps/downloads_clusterfeaturelayer4/index.html
https://demos.conterra.de/mapapps/resources/apps/downloads_clusterfeaturelayer4_2/index.html

## Development Guide
### Define the mapapps remote base
Before you can run the project you have to define the mapapps.remote.base property in the pom.xml-file:
`<mapapps.remote.base>http://%YOURSERVER%/ct-mapapps-webapp-%VERSION%</mapapps.remote.base>`

### Other methods to to define the mapapps.remote.base property.
1. Goal parameters
`mvn install -Dmapapps.remote.base=http://%YOURSERVER%/ct-mapapps-webapp-%VERSION%`

2. Build properties
Change the mapapps.remote.base in the build.properties file and run:
`mvn install -Denv=dev -Dlocal.configfile=%ABSOLUTEPATHTOPROJECTROOT%/build.properties`
