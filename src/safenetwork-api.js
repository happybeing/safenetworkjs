/*
 * SafenetworkJS - Application API for SAFE Network (base level)
 *
 * This provides essential and utility features to build a NodeJS app.
 *
 * Use this in combination with related safenetwork modules, proposed:
 * - FS API - filesystem features (safenetwork-fs.js)
 * - Web API - RESTful Standard Web (safenetwork-web.js + safenetwork-webservices.js)

Architecture
The plan is to create a base class (SafenetworkApi) and extend this first
to class SafenetworkFs.

SafenetworkWeb extends SafenetworkFS, but is a separate module
because it is built for use in the browser.

I considered trying to make it possible to just pull in the base plus
whichever feature(s) you wanted with the other modules sitting on top,
but think it is simpler to understand and implement as a base with
extended classes.

Using the base SafenetworkApi is flexible in that you can either use
the features it provides for application initialisation and connection,
or you can pass it a safeApp object obtained from the native SAFE API.

By extending this to create the other classes, you can just pick the one
with the features you want and keep the flexibility of the base SafenetworkApi.

Features generic JSON i/f for:
- SAFE NFS (raw fs type features, similar to my createFile() etc)
- high level SAFE API for public names, services, account profile etc
- later, maybe also MData/IData and so on

TODO theWebalyst:
[ ] migrate features from safenetwork-webapi to:
  [ ] SAFE Application API (safenetwork-api.js this file!)
  [ ] SAFE FS API (safenetwork-fs.js)
    [ ] change to generic JSON interface
  [ ] SAFE Web API (safenetwork-web/ safenetwork-webapi.js + safenetwork-webservices.js)
    [ ] change to generic JSON interface
[ ] re-organise APIs: App/FS and Web/WebServices (as two npm modules)

 */
