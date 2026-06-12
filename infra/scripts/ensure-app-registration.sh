#!/usr/bin/env bash
# Idempotently creates the Entra app registration that represents the API
# for Container Apps Easy Auth, and stores its client id in the azd env.
# Runs as an azd preprovision hook; requires `az login` with permission to
# create app registrations in the tenant.
set -euo pipefail

APP_NAME="acme-carrier-api-${AZURE_ENV_NAME:?AZURE_ENV_NAME not set}"

if ! az account show >/dev/null 2>&1; then
  echo "ensure-app-registration: 'az' CLI is not logged in (run: az login)" >&2
  exit 1
fi

appId=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)
if [ -z "$appId" ]; then
  echo "ensure-app-registration: creating app registration '$APP_NAME'"
  appId=$(az ad app create --display-name "$APP_NAME" \
    --sign-in-audience AzureADMyOrg --query appId -o tsv)
else
  echo "ensure-app-registration: found existing app registration '$APP_NAME'"
fi

# Identifier URI so tokens can carry the api://<appId> audience.
az ad app update --id "$appId" --identifier-uris "api://$appId"

# A service principal must exist in the tenant before Entra issues tokens
# for this resource.
az ad sp show --id "$appId" >/dev/null 2>&1 || az ad sp create --id "$appId" >/dev/null

azd env set API_APP_CLIENT_ID "$appId"
echo "ensure-app-registration: API_APP_CLIENT_ID=$appId"
