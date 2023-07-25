import config from "../config";
// import fetch from "node-fetch"
const issuerStore = {
  namespaced: true,
  state: {
    entityAccessToken: null,
    issuedCred: null,
  },
  getters: {
    getEntityHeader: (state) => {
      return {
        "Content-Type": "application/json",
        Authorization: "Bearer " + state.entityAccessToken,
      };
    },
    getIssuedCred: (state) => {
      if (state.issuedCred !== null) {
        return state.issuedCred;
      }
    },
  },
  mutations: {
    setEntityAccessToken(state, payload) {
      state.entityAccessToken = payload;
    },
    setIssuedCred(state, payload) {
      state.issuedCred = payload;
    },
  },
  actions: {
    authenticateEntity: ({ commit }) => {
      return new Promise((resolve, reject) => {
        try {
          const url = config.baseUrl + "/api/v1/app/oauth";
          fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Api-Secret-Key": config.apiSecret,
            },
          })
            .then((resp) => {
              return resp.json();
            })
            .then((json) => {
              if (json.statusCode == 400) {
                throw new Error("Bad Request" + json.message.toString());
              }
              if (json.statusCode == 401) {
                throw new Error("Invalid API Secret Key");
              }
              const { access_token } = json;
              commit("setEntityAccessToken", access_token);
              resolve(json);
            });
        } catch (error) {
          reject(error);
        }
      });
    },
    resolveDID: ({ getters }, payload) => {
      return new Promise((resolve, reject) => {
        try {
          const url = config.baseUrl + "/api/v1/did/resolve/" + payload;
          fetch(url, {
            method: "GET",
            headers: getters.getEntityHeader,
          })
            .then((resp) => {
              return resp.json();
            })
            .then((json) => {
              resolve(json);
            });
        } catch (error) {
          reject(error);
        }
      });
    },
    registerDID: ({ rootGetters, getters }, payload) => {
      return new Promise((resolve, reject) => {
        try {
          const verifcationMethodId =
            rootGetters["holderStore/getVerificationMethodId"];

          const url = config.baseUrl + "/api/v1/did/register";
          const body = {
            didDocument: rootGetters["holderStore/getDIDoc"],
            signInfos: [
              {
                verification_method_id: verifcationMethodId,
                clientSpec: { type: "eth-personalSign" },
                signature: payload.signature,
              },
            ],
          };
          fetch(url, {
            method: "POST",
            headers: getters.getEntityHeader,
            body: JSON.stringify(body),
          })
            .then((resp) => {
              return resp.json();
            })
            .then((json) => {
              if (json.statusCode == 400) {
                throw new Error("Bad Request" + json.message.toString());
              }
              resolve(json);
            });
        } catch (error) {
          reject(error);
        }
      });
    },
    issueCredential: ({ getters, rootGetters, commit }, payload) => {
      return new Promise((resolve, reject) => {
        try {
          const url = config.baseUrl + "/api/v1/credential/issue";
          const body = {
            schemaId:
              "sch:hid:testnet:zCMDMsfjziPSWmkQdgdvbts6FHuyJVHzXtobKct2kSnfA:1.0",
            subjectDid: rootGetters["holderStore/getDidDocId"],
            issuerDid:
              "did:hid:testnet:zEwEyAhzUVxcejAkc5di15uNhYKswBiLeEBzvSiX2ojBw", // issuer DID
            expirationDate: "2027-12-10T18:30:00.000Z",
            fields: {
              ...payload,
            },
            namespace: "testnet",
            verificationMethodId:
              "did:hid:testnet:zEwEyAhzUVxcejAkc5di15uNhYKswBiLeEBzvSiX2ojBw#key-1", // issuer verification method
            persist: true,
          };
          fetch(url, {
            method: "POST",
            headers: getters.getEntityHeader,
            body: JSON.stringify(body),
          })
            .then((resp) => {
              return resp.json();
            })
            .then((json) => {
              if (json.statusCode == 400) {
                throw new Error("Bad Request" + json.message.toString());
              }
              commit("setIssuedCred", json.credentialDocument);
              resolve(json);
            });
        } catch (error) {
          reject(error);
        }
      });
    },
  },
};

export default issuerStore;
