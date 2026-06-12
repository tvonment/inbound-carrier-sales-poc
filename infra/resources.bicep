param environmentName string
param location string

@secure()
param databasePassword string

@secure()
param apiKey string

param fmcsaWebkey string
param publisherEmail string

@description('Entra app registration (client id) representing the API for Easy Auth; empty disables Easy Auth')
param apiAppClientId string

var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }

// Gateway-to-backend auth via Entra tokens. Requires the app registration
// created by the preprovision hook; without it we fall back to key-only.
var easyAuthEnabled = !empty(apiAppClientId)

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

// APIM's identity for calling the API. User-assigned (not system-assigned)
// because Easy Auth must pin the caller's client id, which only a
// user-assigned identity exposes at deploy time.
resource apimIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-apim-${resourceToken}'
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

// --- Network (database isolation) ---
// The database gets no public address: the API reaches it over a private
// endpoint inside this VNet. The only public surfaces are the APIM gateway
// and the ACA ingress, which Easy Auth restricts to APIM's identity.

resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: 'vnet-${resourceToken}'
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: ['10.0.0.0/16'] }
    subnets: [
      {
        // Container Apps environment subnet; workload-profile environments
        // require the Microsoft.App/environments delegation.
        name: 'aca-infra'
        properties: {
          addressPrefix: '10.0.0.0/24'
          delegations: [
            {
              name: 'aca'
              properties: { serviceName: 'Microsoft.App/environments' }
            }
          ]
        }
      }
      {
        name: 'private-endpoints'
        properties: { addressPrefix: '10.0.1.0/24' }
      }
    ]
  }
}

var acaInfraSubnetId = '${vnet.id}/subnets/aca-infra'
var privateEndpointSubnetId = '${vnet.id}/subnets/private-endpoints'

// Resolves the server's public FQDN to its private IP for apps in the VNet,
// so DATABASE_URL needs no change.
resource pgPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.postgres.database.azure.com'
  location: 'global'
  tags: tags
}

resource pgPrivateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: pgPrivateDnsZone
  name: 'link-${resourceToken}'
  location: 'global'
  tags: tags
  properties: {
    virtualNetwork: { id: vnet.id }
    registrationEnabled: false
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
    network: {
      // Reachable only through the private endpoint below.
      publicNetworkAccess: 'Disabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: dbName
}

resource pgPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: 'pe-psql-${resourceToken}'
  location: location
  tags: tags
  properties: {
    subnet: { id: privateEndpointSubnetId }
    privateLinkServiceConnections: [
      {
        name: 'psql'
        properties: {
          privateLinkServiceId: postgres.id
          groupIds: ['postgresqlServer']
        }
      }
    ]
  }
}

resource pgPrivateEndpointDns 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: pgPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'postgres'
        properties: { privateDnsZoneId: pgPrivateDnsZone.id }
      }
    ]
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
    vnetConfiguration: {
      infrastructureSubnetId: acaInfraSubnetId
      // Ingress stays external: APIM Consumption cannot join a VNet, so it
      // reaches the apps over their public ingress, which Easy Auth locks
      // to APIM's identity.
      internal: false
    }
    workloadProfiles: [
      { name: 'Consumption', workloadProfileType: 'Consumption' }
    ]
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
    workloadProfileName: 'Consumption'
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
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/healthz', port: 8000 }
            }
            {
              type: 'Readiness'
              httpGet: { path: '/healthz', port: 8000 }
            }
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

// Easy Auth: the platform sidecar rejects any request without a valid Entra
// token issued to APIM's identity, before traffic reaches the container.
// The ACA FQDN stays routable but is no longer a side door around APIM.
resource apiAuthConfig 'Microsoft.App/containerApps/authConfigs@2024-03-01' = if (easyAuthEnabled) {
  parent: apiApp
  name: 'current'
  properties: {
    platform: { enabled: true }
    globalValidation: {
      unauthenticatedClientAction: 'Return401'
      // Health probes carry no token.
      excludedPaths: ['/healthz']
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          // Managed identities are issued v1 tokens; sts.windows.net is the
          // matching issuer for tenant ${tenant().tenantId}.
          openIdIssuer: 'https://sts.windows.net/${tenant().tenantId}/'
          clientId: apiAppClientId
        }
        validation: {
          allowedAudiences: [
            apiAppClientId
            'api://${apiAppClientId}'
          ]
          defaultAuthorizationPolicy: {
            // Only APIM's managed identity may call; any other principal in
            // the tenant could otherwise mint a token for this audience.
            allowedApplications: [apimIdentity.properties.clientId]
          }
        }
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
    workloadProfileName: 'Consumption'
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
        // The dashboard talks to the API through APIM like every other
        // consumer (the backend only accepts Entra tokens minted for APIM),
        // so its key is an APIM subscription key, injected by nginx
        // server-side — it never reaches the browser.
        { name: 'api-key', value: apimSubscription.listSecrets().primaryKey }
      ]
    }
    template: {
      containers: [
        {
          name: 'dashboard'
          image: bootstrapImage
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'API_URL', value: '${apim.properties.gatewayUrl}/${apimApi.properties.path}' }
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
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${apimIdentity.id}': {} }
  }
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

// Gateway-to-backend auth: an Entra token for the API's app registration,
// acquired with APIM's user-assigned identity. The X-API-Key header stays
// as the app-level check (defense in depth).
var managedIdentityAuthSnippet = easyAuthEnabled
  ? '<authentication-managed-identity resource="${apiAppClientId}" client-id="${apimIdentity.properties.clientId}" />'
  : ''

resource apimApiPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-05-01-preview' = {
  parent: apimApi
  name: 'policy'
  dependsOn: [apimNamedValue]
  properties: {
    format: 'rawxml'
    value: format('''
<policies>
  <inbound>
    <base />
    {0}
    <set-header name="X-API-Key" exists-action="override">
      <value>{{{{backend-api-key}}}}</value>
    </set-header>
  </inbound>
  <backend><base /></backend>
  <outbound><base /></outbound>
  <on-error><base /></on-error>
</policies>
''', managedIdentityAuthSnippet)
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

// APIM's management plane rejects concurrent child writes (ETag/
// PreconditionFailed), so operations are created one at a time and the
// subscription waits for them.
@batchSize(1)
resource apimOps 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = [
  for op in apimOperations: {
    parent: apimApi
    name: op.name
    dependsOn: [apimApiPolicy]
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
  dependsOn: [apimOps]
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
