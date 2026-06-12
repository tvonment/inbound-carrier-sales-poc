targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the azd environment, used to generate unique resource names')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@secure()
@description('PostgreSQL admin password (generated and stored by azd)')
param databasePassword string

@secure()
@description('Backend X-API-Key value (generated and stored by azd)')
param apiKey string

@description('FMCSA QCMobile webkey; leave empty to run with MOCK_FMCSA=true')
param fmcsaWebkey string = ''

@description('Client id of the Entra app registration representing the API (set by the preprovision hook); empty disables Easy Auth')
param apiAppClientId string = ''

@description('Publisher email required by API Management')
param publisherEmail string = 'thvome@gmail.com'

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: { 'azd-env-name': environmentName }
}

module resources 'resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    environmentName: environmentName
    location: location
    databasePassword: databasePassword
    apiKey: apiKey
    fmcsaWebkey: fmcsaWebkey
    publisherEmail: publisherEmail
    apiAppClientId: apiAppClientId
  }
}

output AZURE_CONTAINER_REGISTRY_ENDPOINT string = resources.outputs.containerRegistryEndpoint
output API_BASE_URL string = resources.outputs.apiUrl
output DASHBOARD_URL string = resources.outputs.dashboardUrl
output APIM_GATEWAY_URL string = resources.outputs.apimGatewayUrl
