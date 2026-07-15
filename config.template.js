window.__APP_CONFIG__ = {
  apiBase: "${API_BASE}",
  keycloak: {
    url: "${KEYCLOAK_URL}",
    realm: "${KEYCLOAK_REALM}",
    clientId: "${KEYCLOAK_CLIENT_ID}",
  },
};
window.__API_BASE__ = window.__APP_CONFIG__.apiBase;
