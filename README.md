# ClusterFeatureLayer Bundle
The ClusterFeatureLayer bundle allows you to cluster features for any point feature service.

## Build Status
[![devnet-bundle-snapshot](https://github.com/conterra/mapapps-clusterfeaturelayer/actions/workflows/devnet-bundle-snapshot.yml/badge.svg)](https://github.com/conterra/mapapps-clusterfeaturelayer/actions/workflows/devnet-bundle-snapshot.yml)

![Screenshot ClusterFeature Sample App](https://github.com/conterra/mapapps-clusterfeaturelayer/blob/master/screenshot.JPG)

[dn_clusterfeaturelayer Documentation](https://github.com/conterra/mapapps-clusterfeaturelayer/tree/master/src/main/js/bundles/dn_clusterfeaturelayer)

## Important
:warning: **Requirement: map.apps 4.12.0**

Based on the Esri Cluster Layer JS provides here: https://github.com/Esri/cluster-layer-js

## Sample Apps
https://demos.conterra.de/mapapps/resources/apps/downloads_clusterfeaturelayer4/index.html
https://demos.conterra.de/mapapps/resources/apps/downloads_clusterfeaturelayer4_2/index.html

## Quick start

Clone this project and ensure that you have all required dependencies installed correctly (see [Documentation](https://docs.conterra.de/en/mapapps/latest/developersguide/getting-started/set-up-development-environment.html)).

Then run the following commands from the project root directory to start a local development server:

```bash
# install all required node modules
$ mvn initialize

# start dev server
$ mvn compile -Denv=dev -Pinclude-mapapps-deps

# run unit tests
$ mvn test -P run-js-tests,include-mapapps-deps
```
