#!/bin/sh
set -eu

: "${API_BASE:=/api}"
: "${KEYCLOAK_URL:=https://auth.bombeiros.pa.gov.br}"
: "${KEYCLOAK_REALM:=cbmpa}"
: "${KEYCLOAK_CLIENT_ID:=frontend-test}"

export API_BASE KEYCLOAK_URL KEYCLOAK_REALM KEYCLOAK_CLIENT_ID

envsubst '${API_BASE} ${KEYCLOAK_URL} ${KEYCLOAK_REALM} ${KEYCLOAK_CLIENT_ID}' \
  < /usr/share/nginx/html/config.template.js \
  > /usr/share/nginx/html/config.js
