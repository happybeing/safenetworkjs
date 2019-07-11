// Copyright 2018 MaidSafe.net limited.
//
// This SAFE Network Software is licensed to you under
// the MIT license <LICENSE-MIT or http://opensource.org/licenses/MIT> or
// the Modified BSD license <LICENSE-BSD or https://opensource.org/licenses/BSD-3-Clause>,
// at your option.
//
// This file may not be copied, modified, or distributed except according to those terms.
//
// Please review the Licences for the specific language governing permissions and limitations
// relating to use of the SAFE Network Software.

///////////////////////////////////////////////////////////////////////////
// SafenetworkJS WebID support
//
// Modifications Copyright 2019 theWebalyst
//
//

const { parse: parseUrl } = require('url');
const CONSTANTS = require('./constants')

/**
 * RDF based API for SAFE WebID (experimental API)
 */
class WebIdProfile {
    constructor(safeApp, uri) {
        this.safeApp = safeApp
        this.uri = uri
        let parsedUrl = parseUrl(uri);
        if (!parsedUrl.protocol) parsedUrl = parseUrl('safe://' + webId.uri)
        const hostParts = parsedUrl.hostname.split('.')
        this.publicName = hostParts.pop()     // last one is 'publicName'
        this.subName = hostParts.join('.')    // all others are 'subNames'
        this.graphId = `safe://${this.subName}.${this.publicName}`;
      }

    /**
     * Read WebID Profile from network
     * @return {Promise} Mutable Data RDF emulation
     */
    async read () {
      console.log('WebIdProfile.read()')
      if (this.rdf) return this.rdf

      const container = await getContainerFromPublicId(this.safeApp, this.publicName, this.subName)
      if (container.type !== DATA_TYPE_RDF) {
        throw Error('WebIdProfile ERROR: service container is not RDF')
      }

      this.serviceMd = container.serviceMd
      this.rdf = await this.serviceMd.emulateAs('RDF')
      await this.rdf.nowOrWhenFetched()
      this.vocabs = {
          LDP: this.rdf.namespace('http://www.w3.org/ns/ldp#'),
          RDF: this.rdf.namespace('http://www.w3.org/2000/01/rdf-schema#'),
          RDFS: this.rdf.namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#'),
          FOAF: this.rdf.namespace('http://xmlns.com/foaf/0.1/'),
          OWL: this.rdf.namespace('http://www.w3.org/2002/07/owl#'),
          DCTERMS: this.rdf.namespace('http://purl.org/dc/terms/'),
          SAFETERMS: this.rdf.namespace('http://safenetwork.org/safevocab/'),
          PIM: this.rdf.namespace('http://www.w3.org/ns/pim/')
      }
      return this.rdf
    }

    /**
     * Save RDF WebID profile to network
     * @return {Promise}.<NameAndTag> of the WebID profile Mutable Data
     */
    async write () {
      console.log('WebIdProfile.write()')
      if (!this.rdf) throw Error('Error: profile must be initialised before write')
      return this.rdf.commit()
    }

/*

Commented out as the code to add this to the account is not implemented here
and is not needed yet, because all we are doing is editing an existing
WebID profile.

    async new () {
      const md = await this.safeApp.mutableData.newRandomPublic(CONSTANTS.TYPE_TAG.WEBID)
      await md.quickSetup({})
      this.rdf = await emulateAs('RDF')
      return this.rdf
    }
*/

    // TODO move this to the caller - just here for testing
    setStorageLocation(storageUri) {
      console.log('WebIdProfile.setStorageLocation(' + storageUri + ')')
      const rdf = this.rdf
      const hasMeAlready = this.uri.includes('#me');
      const webIdSym = hasMeAlready ? rdf.sym(this.uri) : rdf.sym(`${this.uri}#me`);

      rdf.removeMany(webIdSym, this.vocabs.PIM('space#storage'), null);
      rdf.add(webIdSym, this.vocabs.PIM('space#storage'), rdf.literal(storageUri));
    }

    getStorageLocation() {
      console.log('WebIdProfile.getStorageLocation()')
      const rdf = this.rdf
      const hasMeAlready = this.uri.includes('#me');
      const webIdSym = hasMeAlready ? rdf.sym(this.uri) : rdf.sym(`${this.uri}#me`);

      const match = rdf.statementsMatching(webIdSym, this.vocabs.PIM('space#storage'), undefined)
      const storageUri = match[0].object.value.split(',')
      console.log('returning: ', storageUri)
      return storageUri
    }
}

// From maidsafe/safe_app_nodejs/src/web_fetch.js
const errConst = require('./error_const');

const DATA_TYPE_NFS = 'NFS';
const DATA_TYPE_RDF = 'RDF';

// Helper function to fetch the Container
// from a public ID and service name provided
async function getContainerFromPublicId(safeApp, pubName, subName) {
  console.log('getContainerFromPublicId(' + pubName + ', ' + subName + ')')
  let serviceInfo;
  let subNamesContainer;
  try {
    const address = await safeApp.crypto.sha3Hash(pubName);
    subNamesContainer = await safeApp.mutableData.newPublic(address, CONSTANTS.TYPE_TAG.DNS);
    serviceInfo = await subNamesContainer.get(subName || 'www'); // default it to www
  } catch (err) {
    switch (err.code) {
      case errConst.ERR_NO_SUCH_DATA.code:
        // there is no container stored at the location
        throw makeError(errConst.ERR_CONTENT_NOT_FOUND.code, errConst.ERR_CONTENT_NOT_FOUND.msg);
      case errConst.ERR_NO_SUCH_ENTRY.code:
        // Let's then try to read it as an RDF container
        return readPublicIdAsRdf(safeApp, subNamesContainer, pubName, subName);
      default:
        throw err;
    }
  }

  if (serviceInfo.buf.length === 0) {
    // the matching service name was soft-deleted
    throw makeError(errConst.ERR_SERVICE_NOT_FOUND.code, errConst.ERR_SERVICE_NOT_FOUND.msg);
  }

  let serviceMd;
  try {
    console.log('reading serviceInfo: ', serviceInfo)
    serviceMd = await this.mutableData.fromSerial(serviceInfo.buf);
  } catch (e) {
    console.log('creating serviceInfo: ', serviceInfo)
    serviceMd = await this.mutableData.newPublic(serviceInfo.buf, CONSTANTS.TYPE_TAG.WWW);
  }

  return { serviceMd, type: DATA_TYPE_NFS };
}

// Helper function to fetch the Container
// treating the public ID container as an RDF
async function readPublicIdAsRdf(safeApp, subNamesContainer, pubName, subName) {
  console.log('readPublicIdAsRdf(' + subNamesContainer + ', ' + pubName + ', ' + subName + ')')
  let serviceMd;
  try {
    const graphId = `safe://${subName}.${pubName}`;
    const rdfEmulation = await subNamesContainer.emulateAs('RDF');
    await rdfEmulation.nowOrWhenFetched([graphId]);
    const SAFETERMS = rdfEmulation.namespace('http://safenetwork.org/safevocab/');
    let match = rdfEmulation.statementsMatching(rdfEmulation.sym(graphId), SAFETERMS('xorName'), undefined);
    const xorName = match[0].object.value.split(',');
    match = rdfEmulation.statementsMatching(rdfEmulation.sym(graphId), SAFETERMS('typeTag'), undefined);
    const typeTag = match[0].object.value;
    serviceMd = await safeApp.mutableData.newPublic(xorName, parseInt(typeTag, 10));
  } catch (err) {
    // there is no matching subName name
    throw makeError(errConst.ERR_SERVICE_NOT_FOUND.code, errConst.ERR_SERVICE_NOT_FOUND.msg);
  }

  return { serviceMd, type: DATA_TYPE_RDF };
}

module.exports = module.exports.WebIdProfile = WebIdProfile
