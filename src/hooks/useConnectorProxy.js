import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { dispatchGovernedTool } from '../lib/controlPlane'

const BASE = import.meta.env.VITE_SUPABASE_URL

async function getToken() {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

export function useConnectorProxy(defaults = {}, options = {}) {
  const {
    cacheTTL = 0,
    sourceAgent = 'copilot',
    useGovernance = true,
  } = options
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])
  const cacheRef = useRef(new Map())

  const execute = useCallback(async (payload = {}) => {
    const connectorId = payload.connectorId || defaults.connectorId
    const endpointName = payload.endpointName || defaults.endpointName

    if (!connectorId) {
      const message = 'Connector ID is required'
      setError(message)
      return { error: message }
    }

    if (!endpointName && !payload.healthcheck) {
      const message = 'Endpoint name is required'
      setError(message)
      return { error: message }
    }

    setLoading(true)
    setError(null)

    const requestPayload = {
      connector_id: connectorId,
      endpoint_name: endpointName,
      params: payload.params || defaults.params || {},
      body: payload.body || defaults.body || undefined,
      healthcheck: Boolean(payload.healthcheck),
    }
    const riskClass = payload.riskClass || payload.risk_class || defaults.riskClass || defaults.risk_class || (requestPayload.healthcheck ? 'low' : 'medium')
    const shouldGovern = payload.governed ?? defaults.governed ?? useGovernance

    const cacheKey = JSON.stringify(requestPayload)
    if (cacheTTL > 0) {
      const cached = cacheRef.current.get(cacheKey)
      if (cached && Date.now() - cached.time < cacheTTL) {
        setData(cached.data)
        setLoading(false)
        return cached.data
      }
    }

    try {
      const token = await getToken()
      if (!BASE) throw new Error('Supabase URL not configured')

      const result = shouldGovern
        ? await dispatchGovernedTool({
          sourceAgent,
          source: payload.source || defaults.source || 'connector_proxy_ui',
          targetRef: 'api-proxy',
          riskClass,
          toolCodeName: 'api-proxy',
          functionName: 'api-proxy',
          payload: {
            ...requestPayload,
            risk_class: riskClass,
          },
          context: {
            connector_id: connectorId,
            endpoint_name: endpointName,
            healthcheck: requestPayload.healthcheck,
          },
          userId: token ? undefined : null,
        })
        : await fetch(`${BASE}/functions/v1/api-proxy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(requestPayload),
        }).then(async (response) => {
          const responseResult = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
          if (!response.ok || responseResult?.ok === false) {
            throw new Error(responseResult?.error || `HTTP ${response.status}`)
          }
          return responseResult
        })

      setData(result)
      if (cacheTTL > 0) {
        cacheRef.current.set(cacheKey, { data: result, time: Date.now() })
      }

      setHistory(prev => [{
        timestamp: new Date().toISOString(),
        payload: requestPayload,
        result: { success: true, recordCount: Array.isArray(result?.normalized) ? result.normalized.length : 1 },
      }, ...prev].slice(0, 20))

      return result
    } catch (err) {
      const message = err.message || 'Unknown connector error'
      setError(message)
      setHistory(prev => [{
        timestamp: new Date().toISOString(),
        payload: requestPayload,
        result: { success: false, error: message },
      }, ...prev].slice(0, 20))
      return { error: message }
    } finally {
      setLoading(false)
    }
  }, [cacheTTL, defaults.body, defaults.connectorId, defaults.endpointName, defaults.governed, defaults.params, defaults.riskClass, defaults.risk_class, defaults.source, sourceAgent, useGovernance])

  return { data, loading, error, history, execute }
}
