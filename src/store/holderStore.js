import { HypersignEdvClientEcdsaSecp256k1 } from "@hypersign-protocol/hypersign-vault-client";
import { HypersignVerifiablePresentation } from "hs-ssi-sdk";
import { HypersignDID } from "hs-ssi-sdk";
import {
  HIDNODE_NAMESPACE,
  HIDNODE_REST,
  HIDNODE_RPC,
} from "../utils/hsConstants";

// NOTE: Since Metamask signs the symmetric primitive data types like string,interger and array of symmetric premitive type,
// we need to convert didDoc(jsonld) to json stringified

function ldToJsonConvertor(ld) {
  const json = {};
  for (const key in ld) {
    if (key === "@context") {
      json["context"] = ld[key];
      // } else if (ld[key] === "" || (Array.isArray(ld[key]) && ld[key].length === 0)) {
      //     json[key] = undefined;
    } else {
      json[key] = ld[key];
    }
  }
  return json;
}
const holderStore = {
  namespaced: true,
  state: {
    encryptedDocs:[],
    hypersignVp: null,
    address: "",
    didDoc: null,
    edvClient: null,
    edvConfig: null,
    isLoggedIn: false,
    encryptedVc: null,
    decryptedVc: null,
    signedVp: null,
  },
  getters: {
    getDidDocId(state) {
      if (state.didDoc !== null) {
        return state.didDoc.id;
      }
    },
    getVerificationMethodId(state) {
      if (state.didDoc !== null) {
        return state.didDoc.verificationMethod[0].id;
      }
    },
    getDIDoc(state) {
      if (state.didDoc !== null) {
        return state.didDoc;
      }
    },
    getDIDDocJSONString: (state) => {
      return JSON.stringify(ldToJsonConvertor(state.didDoc), (key, value) => {
        if (value === "" || (Array.isArray(value) && value.length === 0)) {
          return undefined;
        }
        return value;
      });
    },
  },
  mutations: {
    updateStore(state, payload) {
      state.address = payload;
    },
    setDIDDoc(state, payload) {
      state.didDoc = payload;
    },
    setLogginStatus(state, payload) {
      if (!payload) {
        (state.didDoc = null),
          (state.edvClient = null),
          (state.edvConfig = null);
      }
      state.isLoggedIn = payload;
    },
    setEdvClient(state, payload) {
      state.edvClient = payload;
    },
    setEdvConfig(state, payload) {
      state.edvConfig = payload;
    },
    setEncryptedVc(state, payload) {
      state.encryptedVc = payload;
    },
    setDecryptedVc(state, payload) {
      state.decryptedVc = payload;
    },
    initVpClass(state, payload) {
      console.log(payload);
      state.hypersignVp = payload;
    },
    setSignedVp(state, payload) {
      console.log(payload);
      state.signedVp = payload;
    },
  },
  actions: {
    initVpClass({ commit }) {
      const vp = new HypersignVerifiablePresentation({
        nodeRestEndpoint: HIDNODE_REST,
        nodeRpcEndpoint: HIDNODE_RPC,
        namespace: HIDNODE_NAMESPACE,
      });
      console.log(vp);
      commit("initVpClass", vp);
    },
    generateDIDDoc: ({ commit }, payload) => {
      return new Promise((resolve, reject) => {
        try {
          const hypersignDid = new HypersignDID({
            namespace: HIDNODE_NAMESPACE,
          });
          const params = {
            methodSpecificId: payload,
            chainId: "0x1",
            clientSpec: "eth-personalSign",
            address: payload,
          };
          hypersignDid.createByClientSpec(params).then((resp) => {
            console.log(resp);
            commit("setDIDDoc", resp);
            resolve(resp);
          });
        } catch (error) {
          reject(error);
        }
      });
    },
    initEdv: ({ state, commit }, payload) => {
      return new Promise((resolve, reject) => {
        try {
          const edvClient = new HypersignEdvClientEcdsaSecp256k1({
            url: payload.url,
            keyAgreement: payload.keyAgreement,
            verificationMethod: payload.verificationMethod,
          });
          const config = {
            edvId: `hs:edv:${state.didDoc.id}`,
            verificationMethod: payload.verificationMethod,
            keyAgreement: payload.keyAgreement,
          };
          edvClient.registerEdv(config).then((data) => {
            console.log(data);
            state.edvConfig = data;
            commit("setLogginStatus", true);
            commit("setEdvClient", edvClient);
            commit("setEdvConfig", data);
            resolve(data);
          });
        } catch (error) {
          reject(error);
        }
      });
    },
    fetchAllDocs:({state}) => {
      return new Promise((resolve,reject) => {
        try {
          state.edvClient.fetchAllDocs({
            edvId: `hs:edv:${state.didDoc.id}`,
          }).then(data=>{
            state.encryptedDocs = data
            resolve(data)
          })
        } catch (error) {
          reject(error)
        }
      })
    },
    queryCredFromEdv: ({ state, commit }) => {
      return new Promise((resolve, reject) => {
        try {
          state.edvClient
            .Query({
              edvId: `hs:edv:${state.didDoc.id}`,
              equals: [
                {
                  "content.credentialSchema.id":
                    "sch:hid:testnet:zD83yGx4Nk64BzvQQjor3hBDNfyDoKmBcckwE9cSssvA3:1.0",
                },
              ],
            })
            .then((data) => {
              console.log(data);
              commit("setEncryptedVc", data);
              resolve(data);
            });
        } catch (error) {
          reject(error);
        }
      });
    },
    decryptVc: ({ state, commit }, payload) => {
      return new Promise((resolve, reject) => {
        try {
          state.edvClient
            .decryptDocument({
              encryptedDocument: state.encryptedVc[0].encryptedData,
              recipient: {
                id: payload,
                type: "X25519KeyAgreementKeyEIP5630",
              },
            })
            .then((data) => {
              console.log(data);
              commit("setDecryptedVc", data.content);
              resolve(data);
            });
        } catch (error) {
          reject(error);
        }
      });
    },
    insertCredToEdv: ({ rootGetters, state }, payload) => {
      console.log(
        state.didDoc.id.split("#")[0] + "#" + payload.publicKeyMultibase
      );
      console.log(payload);
      return new Promise((resolve, reject) => {
        try {
          const dataToAddEdv = {
            content: rootGetters["issuerStore/getIssuedCred"],
          };
          const publicKeyMultibase = payload.id;
          console.log(publicKeyMultibase);
          const did = state.didDoc.id;
          state.edvClient
            .insertDoc({
              document: dataToAddEdv,
              edvId: `hs:edv:${did}`,
              recipients: [
                {
                  id:
                    state.didDoc.id.split("#")[0] +
                    "#" +
                    payload.publicKeyMultibase,
                  type: "X25519KeyAgreementKeyEIP5630",
                },
              ],
              indexs: [
                {
                  index: "content.credentialSchema.id",
                  unique: false,
                },
              ],
            })
            .then((data) => {
              console.log(data);
              resolve(data);
            });
        } catch (error) {
          reject(error);
        }
      });
    },
    preparePresentation: ({ state, getters, commit }) => {
      return new Promise((resolve, reject) => {
        try {
          state.hypersignVp
            .generate({
              verifiableCredentials: [state.decryptedVc],
              holderDid: getters.getDidDocId,
            })
            .then((data) => {
              console.log(data);
              console.log(getters.getDidDocId);
              console.log(getters.getVerificationMethodId);
              state.hypersignVp
                .signByClientSpec({
                  presentation: data,
                  holderDid: getters.getDidDocId,
                  verificationMethodId: getters.getVerificationMethodId,
                  web3Obj: window.web3,
                  challenge: "1223121",
                  domain: "www.hypersign.id",
                })
                .then((res) => {
                  console.log(res);
                  commit("setSignedVp", res);
                  resolve(res);
                })
                .catch((error) => {
                  console.log(error);
                  reject(error);
                });
            });
        } catch (error) {
          reject(error);
        }
      });
    },
  },
};

export default holderStore;
