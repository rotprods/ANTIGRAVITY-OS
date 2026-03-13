import { useCallback, useMemo, useState } from 'react'
import { useApiCatalog } from './useApiCatalog'
import { useConnectorProxy } from './useConnectorProxy'

const DEFAULT_STORAGE_KEY = 'antigravity.connector.savedFeeds.v1'

function readSavedFeeds(storageKey) {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}

function writeSavedFeeds(storageKey, value) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value))
  } catch {
    // no-op in constrained environments
  }
}

export function useConnectorInfrastructure(options = {}) {
  const {
    moduleTarget = 'all',
    storageKey = DEFAULT_STORAGE_KEY,
    includeInternal = false,
  } = options

  const {
    installedApps,
    loading: catalogLoading,
    error: catalogError,
    stats,
    reload,
  } = useApiCatalog({
    moduleTarget,
    isListed: includeInternal ? undefined : true,
  })

  const {
    execute,
    error: proxyError,
  } = useConnectorProxy({}, { cacheTTL: 15000 })

  const [latestByConnector, setLatestByConnector] = useState({})
  const [errorByConnector, setErrorByConnector] = useState({})
  const [runningConnectorId, setRunningConnectorId] = useState(null)
  const [savedFeedIds, setSavedFeedIds] = useState(() => readSavedFeeds(storageKey))

  const connectors = useMemo(
    () => installedApps.filter(app => app.runMode === 'connector_proxy'),
    [installedApps]
  )

  const liveConnectors = useMemo(
    () => connectors.filter(app => app.connectorStatus === 'live'),
    [connectors]
  )

  const connectorsById = useMemo(
    () => new Map(connectors.map(connector => [connector.connectorId, connector])),
    [connectors]
  )

  const findConnectorByCapability = useCallback((capability) => {
    if (!capability) return null
    const normalized = String(capability).trim().toLowerCase()
    return liveConnectors.find(connector =>
      (connector.capabilities || []).map(cap => String(cap).toLowerCase()).includes(normalized)
    ) || null
  }, [liveConnectors])

  const runConnector = useCallback(async (connectorRef, payload = {}) => {
    const connectorId = typeof connectorRef === 'string' ? connectorRef : connectorRef?.connectorId
    const connector = connectorsById.get(connectorId)

    if (!connectorId || !connector) {
      return { error: 'Connector not found' }
    }
    if (connector.connectorStatus !== 'live') {
      return { error: 'Only live connectors can execute' }
    }

    setRunningConnectorId(connectorId)
    setErrorByConnector(prev => ({ ...prev, [connectorId]: null }))

    const result = await execute({
      connectorId,
      endpointName: payload.endpointName || connector.endpointName,
      params: payload.params ?? connector.sampleParams ?? {},
      body: payload.body ?? {},
      healthcheck: Boolean(payload.healthcheck),
    })

    if (result?.error) {
      setErrorByConnector(prev => ({ ...prev, [connectorId]: result.error }))
      setRunningConnectorId(null)
      return result
    }

    setLatestByConnector(prev => ({ ...prev, [connectorId]: result }))
    setRunningConnectorId(null)
    return result
  }, [connectorsById, execute])

  const runByCapability = useCallback(async (capability, payload = {}) => {
    const connector = findConnectorByCapability(capability)
    if (!connector) {
      return { error: `No live connector found for capability '${capability}'` }
    }
    return runConnector(connector, payload)
  }, [findConnectorByCapability, runConnector])

  const toggleSavedFeed = useCallback((connectorId) => {
    if (!connectorId) return
    setSavedFeedIds(prev => {
      const next = prev.includes(connectorId)
        ? prev.filter(id => id !== connectorId)
        : [...prev, connectorId]
      writeSavedFeeds(storageKey, next)
      return next
    })
  }, [storageKey])

  const isSavedFeed = useCallback((connectorId) => savedFeedIds.includes(connectorId), [savedFeedIds])

  return {
    loading: catalogLoading,
    error: catalogError || proxyError,
    stats,
    connectors,
    liveConnectors,
    savedFeedIds,
    latestByConnector,
    errorByConnector,
    runningConnectorId,
    runConnector,
    runByCapability,
    findConnectorByCapability,
    toggleSavedFeed,
    isSavedFeed,
    reload,
  }
}

export default useConnectorInfrastructure
