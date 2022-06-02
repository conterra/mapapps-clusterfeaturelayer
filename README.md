# mapapps-remote-project-blueprint

**This project is not intended for use by non-con terra users.** It is designed for the creation of bundles and their releases in GitHub and can access con terra internal infrastructures for this purpose. To develop your own map.apps bundles, use the [mapapps-4-developers project](https://github.com/conterra/mapapps-4-developers).

## Build

![example workflow](https://github.com/conterra/mapapps-remote-project-blueprint/actions/workflows/devnet-bundle-snapshot.yml/badge.svg)

## Requirements

-   map.apps 4.13.1
-   All resources from `map.apps-VERSION/sdk/m2-repository` need to be copied manually to your local Maven repository (e.g. `%UserProfile%/.m2/repository` for Windows, `~/.m2/repository` for MacOS).

## More Information

The project is always based on the latest version of the [mapapps-4-developers Project](https://github.com/conterra/mapapps-4-developers).
