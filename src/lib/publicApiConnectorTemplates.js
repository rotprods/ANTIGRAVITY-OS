import { buildCatalogSlug, getAgentTargetsForEntry } from './publicApiCatalog.js'

const categoryMeta = {
  Geocoding: { icon: '📍', color: '#34A853' },
  Finance: { icon: '💹', color: '#22C55E' },
  News: { icon: '📰', color: '#2563EB' },
  'Open Data': { icon: '🗂️', color: '#F97316' },
  Government: { icon: '🏛️', color: '#64748B' },
  Weather: { icon: '🌦️', color: '#0EA5E9' },
  Jobs: { icon: '💼', color: '#A855F7' },
  Transportation: { icon: '🛣️', color: '#EF4444' },
  Development: { icon: '🧩', color: '#14B8A6' },
}

function createTemplate(definition) {
  return {
    mode: 'search',
    authRequirements: { requiredFields: [], optionalFields: [] },
    authConfigDefaults: {},
    capabilities: [],
    inputSchema: [],
    endpoints: [],
    healthcheckEndpoint: null,
    internalOnly: false,
    ...definition,
  }
}

export const PUBLIC_API_ADAPTER_TEMPLATES = [
  createTemplate({
    templateKey: 'administrative-divisions-db',
    name: 'Administrative Divisions DB',
    category: 'Geocoding',
    docsUrl: 'https://github.com/kamikazechaser/administrative-divisions-db',
    catalogSlug: buildCatalogSlug('Geocoding', 'administrative-divisons-db', 'https://github.com/kamikazechaser/administrative-divisions-db'),
    baseUrl: 'https://rawcdn.githack.com/kamikazechaser/administrative-divisions-db/master',
    endpointName: 'country_divisions',
    normalizerKey: 'administrative_divisions',
    capabilities: ['territory_lookup', 'region_normalization', 'prospector'],
    inputSchema: [
      { key: 'country_code', label: 'Country Code', type: 'text', placeholder: 'ES, FR, DE...' },
    ],
    endpoints: [
      {
        name: 'country_divisions',
        method: 'GET',
        path: '/api/{country_code}.json',
        requiredParams: ['country_code'],
        sampleParams: { country_code: 'ES' },
      },
    ],
    healthcheckEndpoint: {
      name: 'healthcheck',
      method: 'GET',
      path: '/api/ES.json',
    },
  }),
  createTemplate({
    templateKey: 'adresse-data-gouv',
    name: 'adresse.data.gouv.fr',
    category: 'Geocoding',
    docsUrl: 'https://adresse.data.gouv.fr',
    catalogSlug: buildCatalogSlug('Geocoding', 'adresse.data.gouv.fr', 'https://adresse.data.gouv.fr'),
    baseUrl: 'https://api-adresse.data.gouv.fr',
    endpointName: 'search',
    normalizerKey: 'adresse_search',
    capabilities: ['geocoding', 'address_lookup', 'prospector'],
    inputSchema: [
      { key: 'q', label: 'Address Query', type: 'text', placeholder: '8 bd du port 95000 Cergy' },
      { key: 'limit', label: 'Limit', type: 'select', options: [{ value: '5', label: '5' }, { value: '10', label: '10' }, { value: '20', label: '20' }] },
    ],
    endpoints: [
      {
        name: 'search',
        method: 'GET',
        path: '/search/',
        requiredParams: ['q'],
        sampleParams: { q: '8 bd du port 95000 Cergy', limit: '5' },
      },
    ],
    healthcheckEndpoint: {
      name: 'healthcheck',
      method: 'GET',
      path: '/search/',
      sampleParams: { q: '8 bd du port', limit: '1' },
    },
  }),
  createTemplate({
    templateKey: 'graphhopper',
    name: 'GraphHopper',
    category: 'Transportation',
    docsUrl: 'https://docs.graphhopper.com/',
    catalogSlug: buildCatalogSlug('Transportation', 'GraphHopper', 'https://docs.graphhopper.com/'),
    baseUrl: 'https://graphhopper.com',
    endpointName: 'route',
    normalizerKey: 'graphhopper_route',
    capabilities: ['routing', 'travel_time', 'territory_planning', 'prospector'],
    authRequirements: { requiredFields: ['api_key'], optionalFields: [] },
    authConfigDefaults: { query_name: 'key' },
    inputSchema: [
      { key: 'points', label: 'Points (lat,lng)', type: 'text', placeholder: '40.4168,-3.7038;41.3874,2.1686' },
      { key: 'profile', label: 'Profile', type: 'select', options: [{ value: 'car', label: 'Car' }, { value: 'bike', label: 'Bike' }, { value: 'foot', label: 'Foot' }] },
    ],
    endpoints: [
      {
        name: 'route',
        method: 'GET',
        path: '/api/1/route',
        requiredParams: ['points'],
        paramTransforms: {
          points: 'repeat:point',
        },
        sampleParams: { points: ['40.4168,-3.7038', '41.3874,2.1686'], profile: 'car', instructions: 'false' },
      },
    ],
    healthcheckEndpoint: {
      name: 'healthcheck',
      method: 'GET',
      path: '/api/1/route',
      requiredParams: ['points'],
      paramTransforms: {
        points: 'repeat:point',
      },
      sampleParams: { points: ['40.4168,-3.7038', '40.4180,-3.7100'], profile: 'car', instructions: 'false' },
    },
  }),
  createTemplate({
    templateKey: 'disify',
    name: 'Disify',
    category: 'Email',
    docsUrl: 'https://www.disify.com/',
    catalogSlug: buildCatalogSlug('Email', 'Disify', 'https://www.disify.com/'),
    baseUrl: 'https://www.disify.com',
    endpointName: 'validate_email',
    normalizerKey: 'disify_email',
    capabilities: ['email_validation', 'outreach', 'prospector'],
    inputSchema: [
      { key: 'email', label: 'Email Address', type: 'text', placeholder: 'hello@example.com' },
      { key: 'id', label: 'Record ID', type: 'text', placeholder: 'd117271ce938bf91bc718f6cfb7954de' },
    ],
    endpoints: [
      {
        name: 'validate_email',
        method: 'GET',
        path: '/api/email/{email}',
        requiredParams: ['email'],
        sampleParams: { email: 'hello@example.com' },
      },
      {
        name: 'view_record',
        method: 'GET',
        path: '/api/view/{id}',
        requiredParams: ['id'],
        sampleParams: { id: 'd117271ce938bf91bc718f6cfb7954de' },
        normalizer_key: 'disify_view',
      },
    ],
    healthcheckEndpoint: {
      name: 'healthcheck',
      method: 'GET',
      path: '/api/email/example@example.com',
    },
  }),
  createTemplate({
    templateKey: 'microlink',
    name: 'Microlink.io',
    category: 'Open Data',
    docsUrl: 'https://microlink.io',
    catalogSlug: buildCatalogSlug('Open Data', 'Microlink.io', 'https://microlink.io'),
    baseUrl: 'https://api.microlink.io',
    endpointName: 'preview_url',
    normalizerKey: 'microlink_preview',
    capabilities: ['website_preview', 'lead_enrichment', 'prospector', 'knowledge'],
    inputSchema: [
      { key: 'url', label: 'Website URL', type: 'text', placeholder: 'https://example.com' },
    ],
    endpoints: [
      {
        name: 'preview_url',
        method: 'GET',
        path: '/',
        requiredParams: ['url'],
        sampleParams: { url: 'https://example.com', screenshot: 'false' },
      },
    ],
    healthcheckEndpoint: {
      name: 'healthcheck',
      method: 'GET',
      path: '/',
      sampleParams: { url: 'https://example.com', screenshot: 'false' },
    },
  }),
  createTemplate({
    templateKey: 'open-meteo',
    name: 'Open-Meteo',
    category: 'Weather',
    docsUrl: 'https://open-meteo.com/',
    catalogSlug: buildCatalogSlug('Weather', 'Open-Meteo', 'https://open-meteo.com/'),
    baseUrl: 'https://api.open-meteo.com',
    endpointName: 'forecast',
    normalizerKey: 'open_meteo_forecast',
    capabilities: ['weather', 'forecast', 'watchtower', 'world_monitor'],
    inputSchema: [
      { key: 'latitude', label: 'Latitude', type: 'text', placeholder: '40.4168' },
      { key: 'longitude', label: 'Longitude', type: 'text', placeholder: '-3.7038' },
    ],
    endpoints: [
      {
        name: 'forecast',
        method: 'GET',
        path: '/v1/forecast',
        requiredParams: ['latitude', 'longitude'],
        sampleParams: { latitude: '40.4168', longitude: '-3.7038', current: 'temperature_2m,wind_speed_10m' },
      },
    ],
    healthcheckEndpoint: {
      name: 'healthcheck',
      method: 'GET',
      path: '/v1/forecast',
      sampleParams: { latitude: '40.4168', longitude: '-3.7038', current: 'temperature_2m' },
    },
  }),
  createTemplate({
    templateKey: 'aemet',
    name: 'Aemet',
    category: 'Weather',
    docsUrl: 'https://opendata.aemet.es/centrodedescargas/inicio',
    catalogSlug: buildCatalogSlug('Weather', 'Aemet', 'https://opendata.aemet.es/centrodedescargas/inicio'),
    baseUrl: 'https://opendata.aemet.es/opendata',
    endpointName: 'observations',
    normalizerKey: 'aemet_observations',
    capabilities: ['weather', 'spain_weather', 'watchtower', 'world_monitor'],
    authRequirements: { requiredFields: ['api_key'], optionalFields: [] },
    authConfigDefaults: { query_name: 'api_key' },
    inputSchema: [],
    endpoints: [
      {
        name: 'observations',
        method: 'GET',
        path: '/api/observacion/convencional/todas',
        followUpField: 'datos',
      },
    ],
    healthcheckEndpoint: {
      name: 'healthcheck',
      method: 'GET',
      path: '/api/observacion/convencional/todas',
      followUpField: 'datos',
    },
  }),
  createTemplate({
    templateKey: 'the-guardian',
    name: 'The Guardian',
    category: 'News',
    docsUrl: 'http://open-platform.theguardian.com/',
    catalogSlug: buildCatalogSlug('News', 'The Guardian', 'http://open-platform.theguardian.com/'),
    baseUrl: 'https://content.guardianapis.com',
    endpointName: 'search',
    normalizerKey: 'guardian_search',
    capabilities: ['news', 'watchtower', 'world_monitor'],
    authRequirements: { requiredFields: ['api_key'], optionalFields: [] },
    authConfigDefaults: { query_name: 'api-key' },
    inputSchema: [
      { key: 'q', label: 'Search Query', type: 'text', placeholder: 'artificial intelligence' },
    ],
    endpoints: [
      {
        name: 'search',
        method: 'GET',
        path: '/search',
        sampleParams: { q: 'artificial intelligence', section: 'technology', 'page-size': '5', 'show-fields': 'headline,trailText,byline' },
      },
    ],
    healthcheckEndpoint: {
      name: 'healthcheck',
      method: 'GET',
      path: '/search',
      sampleParams: { section: 'technology', 'page-size': '1', 'show-fields': 'headline' },
    },
  }),
  createTemplate({
    templateKey: 'fred',
    name: 'FRED',
    category: 'Finance',
    docsUrl: 'https://fred.stlouisfed.org/docs/api/fred/',
    catalogSlug: buildCatalogSlug('Finance', 'FRED', 'https://fred.stlouisfed.org/docs/api/fred/'),
    baseUrl: 'https://api.stlouisfed.org',
    endpointName: 'series_observations',
    normalizerKey: 'fred_series',
    capabilities: ['macro_data', 'finance', 'world_monitor'],
    authRequirements: { requiredFields: ['api_key'], optionalFields: [] },
    authConfigDefaults: { query_name: 'api_key' },
    inputSchema: [
      { key: 'series_id', label: 'Series ID', type: 'text', placeholder: 'FEDFUNDS' },
    ],
    endpoints: [
      {
        name: 'series_observations',
        method: 'GET',
        path: '/fred/series/observations',
        requiredParams: ['series_id'],
        sampleParams: { series_id: 'FEDFUNDS', file_type: 'json', limit: '10', sort_order: 'desc' },
      },
    ],
    healthcheckEndpoint: {
      name: 'healthcheck',
      method: 'GET',
      path: '/fred/series/observations',
      sampleParams: { series_id: 'FEDFUNDS', file_type: 'json', limit: '1', sort_order: 'desc' },
    },
  }),
  createTemplate({
    templateKey: 'fed-treasury',
    name: 'Fed Treasury',
    category: 'Finance',
    docsUrl: 'https://fiscaldata.treasury.gov/api-documentation/',
    catalogSlug: buildCatalogSlug('Finance', 'Fed Treasury', 'https://fiscaldata.treasury.gov/api-documentation/'),
    baseUrl: 'https://api.fiscaldata.treasury.gov',
    endpointName: 'rates_of_exchange',
    normalizerKey: 'treasury_rates',
    capabilities: ['macro_data', 'treasury_data', 'finance', 'world_monitor'],
    inputSchema: [],
    endpoints: [
      {
        name: 'rates_of_exchange',
        method: 'GET',
        path: '/services/api/fiscal_service/v1/accounting/od/rates_of_exchange',
        sampleParams: {
          fields: 'country_currency_desc,exchange_rate,record_date',
          filter: 'country_currency_desc:in:(Canada-Dollar),record_date:gte:2024-01-01',
          'page[size]': '5',
        },
      },
    ],
    healthcheckEndpoint: {
      name: 'healthcheck',
      method: 'GET',
      path: '/services/api/fiscal_service/v1/accounting/od/rates_of_exchange',
      sampleParams: {
        fields: 'country_currency_desc,exchange_rate,record_date',
        filter: 'country_currency_desc:in:(Canada-Dollar),record_date:gte:2024-01-01',
        'page[size]': '1',
      },
    },
  }),
  createTemplate({
    templateKey: 'arbeitnow',
    name: 'Arbeitnow',
    category: 'Jobs',
    docsUrl: 'https://documenter.getpostman.com/view/18545278/UVJbJdKh',
    catalogSlug: buildCatalogSlug('Jobs', 'Arbeitnow', 'https://documenter.getpostman.com/view/18545278/UVJbJdKh'),
    baseUrl: 'https://www.arbeitnow.com',
    endpointName: 'job_board',
    normalizerKey: 'arbeitnow_jobs',
    capabilities: ['jobs', 'hiring_signals', 'watchtower'],
    inputSchema: [
      { key: 'page', label: 'Page', type: 'select', options: [{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }] },
    ],
    endpoints: [
      {
        name: 'job_board',
        method: 'GET',
        path: '/api/job-board-api',
        sampleParams: { page: '1' },
      },
    ],
    healthcheckEndpoint: {
      name: 'healthcheck',
      method: 'GET',
      path: '/api/job-board-api',
      sampleParams: { page: '1' },
    },
  }),
  createTemplate({
    templateKey: 'apis-guru',
    name: 'APIs.guru',
    category: 'Development',
    docsUrl: 'https://apis.guru/api-doc/',
    catalogSlug: buildCatalogSlug('Development', 'APIs.guru', 'https://apis.guru/api-doc/'),
    baseUrl: 'https://api.apis.guru',
    endpointName: 'list',
    normalizerKey: 'apis_guru_list',
    capabilities: ['openapi_discovery', 'connector_enrichment', 'knowledge'],
    internalOnly: true,
    inputSchema: [],
    endpoints: [
      {
        name: 'list',
        method: 'GET',
        path: '/v2/list.json',
      },
    ],
    healthcheckEndpoint: {
      name: 'healthcheck',
      method: 'GET',
      path: '/v2/list.json',
    },
  }),
]

export function getCategoryMeta(category) {
  return categoryMeta[category] || { icon: '🕸️', color: '#5B9EFF' }
}

export function getTemplateByCatalogSlug(slug) {
  return PUBLIC_API_ADAPTER_TEMPLATES.find(template => template.catalogSlug === slug) || null
}

export function getTemplateByKey(templateKey) {
  return PUBLIC_API_ADAPTER_TEMPLATES.find(template => template.templateKey === templateKey) || null
}

export function validateConnectorCredentials(template, authConfig = {}) {
  const errors = []

  for (const field of template.authRequirements.requiredFields || []) {
    if (!authConfig[field]) {
      errors.push(`Missing required credential: ${field}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function buildConnectorInstallPayload(entry, template) {
  const defaultAuthConfig = { ...(template.authConfigDefaults || {}) }
  const agentTargets = getAgentTargetsForEntry(entry)

  if (template.authRequirements.requiredFields.includes('api_key')) {
    if (!defaultAuthConfig.query_name && !defaultAuthConfig.header_name) {
      defaultAuthConfig.query_name = 'api_key'
    }
    defaultAuthConfig.api_key = ''
  }

  return {
    name: entry.name,
    base_url: template.baseUrl,
    auth_type: entry.auth_type,
    auth_config: defaultAuthConfig,
    endpoints: template.endpoints,
    healthcheck_endpoint: template.healthcheckEndpoint,
    is_active: true,
    catalog_slug: entry.slug,
    template_key: template.templateKey,
    normalizer_key: template.normalizerKey,
    capabilities: template.capabilities,
    health_status: 'pending',
    metadata: {
      docs_url: entry.docs_url,
      category: entry.category,
      description: entry.description,
      module_targets: entry.module_targets,
      agent_targets: agentTargets,
    },
  }
}

export function buildCatalogMiniApp(entry, options = {}) {
  const template = options.template || getTemplateByCatalogSlug(entry.slug)
  const connector = options.connector || null
  const meta = getCategoryMeta(entry.category)
  const status = connector
    ? connector.health_status === 'live'
      ? 'active'
      : connector.health_status === 'error'
        ? 'pending'
        : 'pending'
    : entry.activation_tier === 'adapter_ready'
      ? 'pending'
      : 'planned'
  const agentTargets = getAgentTargetsForEntry({
    ...entry,
    agent_targets: (connector?.metadata && Array.isArray(connector.metadata.agent_targets))
      ? connector.metadata.agent_targets
      : entry.agent_targets,
  })

  return {
    id: connector ? `connector:${connector.id}` : `catalog:${entry.slug}`,
    name: entry.name,
    icon: meta.icon,
    color: meta.color,
    mode: template?.mode || 'search',
    type: entry.category,
    endpoint: connector ? 'api-proxy' : null,
    endpointName: template?.endpointName || null,
    connectorId: connector?.id || null,
    connectorStatus: connector?.health_status || null,
    description: entry.description,
    inputSchema: template?.inputSchema || [],
    status,
    source: connector ? 'connector' : 'public_catalog',
    runMode: connector ? 'connector_proxy' : 'docs_only',
    docsUrl: entry.docs_url,
    moduleTargets: entry.module_targets || [],
    agentTargets,
    authType: entry.auth_type,
    httpsOnly: entry.https_only,
    corsPolicy: entry.cors_policy,
    activationTier: connector?.health_status === 'live' ? 'live' : entry.activation_tier,
    templateKey: template?.templateKey || null,
    normalizerKey: template?.normalizerKey || null,
    capabilities: connector?.capabilities || template?.capabilities || [],
    authRequirements: template?.authRequirements || { requiredFields: [], optionalFields: [] },
    authConfigDefaults: template?.authConfigDefaults || {},
    sampleParams: template?.endpoints?.[0]?.sampleParams || {},
    healthcheckParams: template?.healthcheckEndpoint?.sampleParams || {},
    lastHealthcheckAt: connector?.last_healthcheck_at || null,
    metadata: connector?.metadata || entry.raw_source || {},
    installable: Boolean(template) && !connector && !template.internalOnly,
    internalOnly: template?.internalOnly || false,
    catalogSlug: entry.slug,
  }
}
