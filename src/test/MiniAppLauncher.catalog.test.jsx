import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockUseApiCatalog = vi.fn()
const mockUseApiNetwork = vi.fn()

vi.mock('../hooks/useApiCatalog', () => ({
  useApiCatalog: (...args) => mockUseApiCatalog(...args),
}))

vi.mock('../hooks/useApiNetwork', () => ({
  useApiNetwork: (...args) => mockUseApiNetwork(...args),
}))

import MiniAppLauncher from '../components/miniapps/MiniAppLauncher'

describe('MiniAppLauncher catalog integration', () => {
  beforeEach(() => {
    mockUseApiNetwork.mockReturnValue({
      apps: [{
        id: 'core:google_places',
        name: 'Google Places',
        icon: '📍',
        color: '#34A853',
        type: 'Geo Intelligence',
        description: 'Core geosearch',
        status: 'active',
        source: 'core',
        runMode: 'edge_function',
        endpoint: 'google-maps-search',
        inputSchema: [],
        moduleTargets: ['prospector'],
        agentTargets: ['atlas'],
      }],
      stats: { liveCount: 1, degradedCount: 0 },
      loading: false,
      error: null,
      refresh: vi.fn(),
    })

    mockUseApiCatalog.mockReturnValue({
      entries: [{
        slug: 'finance-fred-fred-stlouisfed-org',
        name: 'FRED',
        category: 'Finance',
        docs_url: 'https://fred.stlouisfed.org/docs/api/fred/',
        description: 'Macro indicators',
        auth_type: 'api_key',
        https_only: true,
        cors_policy: 'Unknown',
        module_targets: ['finance', 'world_monitor'],
        agent_targets: ['strategist', 'cortex'],
        tags: ['finance'],
        business_fit_score: 75,
        activation_tier: 'candidate',
        is_listed: true,
      }],
      loading: false,
      error: null,
      stats: {
        entryCount: 1,
        installedCount: 0,
        countsByModuleTarget: { finance: 1 },
        countsByAgentTarget: { strategist: 1 },
      },
      syncRun: null,
      installedApps: [],
      adapterReadyEntries: [],
      installConnector: vi.fn(),
      reload: vi.fn(),
    })
  })

  it('renders core and catalog apps together without breaking existing core behavior', () => {
    render(<MiniAppLauncher />)

    expect(screen.getByRole('button', { name: /Core \(1\)/i })).toBeInTheDocument()
    expect(screen.getByText('Google Places')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Catalog \(1\)/i }))
    expect(screen.getByText('FRED')).toBeInTheDocument()
  })
})
