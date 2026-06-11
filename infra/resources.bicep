param environmentName string
param location string

@secure()
param databasePassword string

@secure()
param apiKey string

param fmcsaWebkey string
param publisherEmail string

var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }

var dbAdminUser = 'acmeadmin'
var dbName = 'acme'

// Placeholder image; `azd deploy` replaces it with the real build from ACR.
var bootstrapImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

// --- Observability ---

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'log-${resourceToken}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// --- Container registry + pull identity ---

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'acr${resourceToken}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-app-${resourceToken}'
  location: location
  tags: tags
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, appIdentity.id, 'acrpull')
  scope: registry
  properties: {
    // AcrPull
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    )
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// --- PostgreSQL Flexible Server (B1ms) ---

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: 'psql-${resourceToken}'
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: dbAdminUser
    administratorLoginPassword: databasePassword
    storage: { storageSizeGB: 32 }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: { mode: 'Disabled' }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: dbName
}

// PoC simplification: public network access limited to Azure services.
resource pgFirewall 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowAllAzureServicesAndResources'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

var databaseUrl = 'postgresql+psycopg://${dbAdminUser}:${databasePassword}@${postgres.properties.fullyQualifiedDomainName}:5432/${dbName}?sslmode=require'

// --- Container Apps environment ---

resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${resourceToken}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// --- API container app ---

resource apiApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-api-${resourceToken}'
  location: location
  tags: union(tags, { 'azd-service-name': 'api' })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${appIdentity.id}': {} }
  }
  dependsOn: [acrPull]
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: appIdentity.id
        }
      ]
      secrets: [
        { name: 'database-url', value: databaseUrl }
        { name: 'api-key', value: apiKey }
        { name: 'fmcsa-webkey', value: fmcsaWebkey }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: bootstrapImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'API_KEY', secretRef: 'api-key' }
            { name: 'FMCSA_WEBKEY', secretRef: 'fmcsa-webkey' }
            { name: 'MOCK_FMCSA', value: empty(fmcsaWebkey) ? 'true' : 'false' }
            { name: 'NEGOTIATION_THRESHOLDS', value: '0.12,0.08,0.04' }
          ]
        }
      ]
      scale: {
        // Tool calls happen mid-conversation; a cold start during a live
        // call is unacceptable.
        minReplicas: 1
        maxReplicas: 2
      }
    }
  }
}

// --- Dashboard container app ---

resource dashboardApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-dash-${resourceToken}'
  location: location
  tags: union(tags, { 'azd-service-name': 'dashboard' })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${appIdentity.id}': {} }
  }
  dependsOn: [acrPull]
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'auto'
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: appIdentity.id
        }
      ]
      secrets: [
        { name: 'api-key', value: apiKey }
      ]
    }
    template: {
      containers: [
        {
          name: 'dashboard'
          image: bootstrapImage
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            // nginx proxies /api/* here and injects the key server-side,
            // so the key never reaches the browser.
            { name: 'API_URL', value: 'https://${apiApp.properties.configuration.ingress.fqdn}' }
            { name: 'API_KEY', secretRef: 'api-key' }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 1 }
    }
  }
}

// --- API Management (Consumption) facade ---

resource apim 'Microsoft.ApiManagement/service@2023-05-01-preview' = {
  name: 'apim-${resourceToken}'
  location: location
  tags: tags
  sku: { name: 'Consumption', capacity: 0 }
  properties: {
    publisherEmail: publisherEmail
    publisherName: 'Acme Logistics PoC'
  }
}

// Backend API key kept as a named value, injected by policy so platform
// webhooks only need the APIM subscription key.
resource apimNamedValue 'Microsoft.ApiManagement/service/namedValues@2023-05-01-preview' = {
  parent: apim
  name: 'backend-api-key'
  properties: {
    displayName: 'backend-api-key'
    secret: true
    value: apiKey
  }
}

resource apimApi 'Microsoft.ApiManagement/service/apis@2023-05-01-preview' = {
  parent: apim
  name: 'carrier-api'
  properties: {
    displayName: 'Carrier Sales API'
    path: 'carrier-api'
    protocols: ['https']
    serviceUrl: 'https://${apiApp.properties.configuration.ingress.fqdn}'
    subscriptionRequired: true
    subscriptionKeyParameterNames: {
      header: 'Ocp-Apim-Subscription-Key'
      query: 'subscription-key'
    }
  }
}

resource apimApiPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-05-01-preview' = {
  parent: apimApi
  name: 'policy'
  dependsOn: [apimNamedValue]
  properties: {
    format: 'rawxml'
    value: '''
<policies>
  <inbound>
    <base />
    <set-header name="X-API-Key" exists-action="override">
      <value>{{backend-api-key}}</value>
    </set-header>
  </inbound>
  <backend><base /></backend>
  <outbound><base /></outbound>
  <on-error><base /></on-error>
</policies>
'''
  }
}

var apimOperations = [
  { name: 'verify-mc', method: 'POST', urlTemplate: '/api/verify-mc' }
  { name: 'search-loads', method: 'GET', urlTemplate: '/api/loads/search' }
  { name: 'evaluate-offer', method: 'POST', urlTemplate: '/api/evaluate-offer' }
  { name: 'book', method: 'POST', urlTemplate: '/api/book' }
  { name: 'record-call', method: 'POST', urlTemplate: '/api/calls' }
  { name: 'list-calls', method: 'GET', urlTemplate: '/api/calls' }
  { name: 'metrics', method: 'GET', urlTemplate: '/api/metrics' }
]

resource apimOps 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = [
  for op in apimOperations: {
    parent: apimApi
    name: op.name
    properties: {
      displayName: op.name
      method: op.method
      urlTemplate: op.urlTemplate
    }
  }
]

resource apimSubscription 'Microsoft.ApiManagement/service/subscriptions@2023-05-01-preview' = {
  parent: apim
  name: 'happyrobot'
  properties: {
    displayName: 'HappyRobot platform'
    scope: '/apis/${apimApi.id}'
    state: 'active'
  }
}

// --- Outputs ---

output containerRegistryEndpoint string = registry.properties.loginServer
output apiUrl string = 'https://${apiApp.properties.configuration.ingress.fqdn}'
output dashboardUrl string = 'https://${dashboardApp.properties.configuration.ingress.fqdn}'
output apimGatewayUrl string = '${apim.properties.gatewayUrl}/${apimApi.properties.path}'
