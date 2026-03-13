import { describe, expect, it } from 'vitest'
import {
  buildN8nTemplateCatalogSnapshot,
  filterN8nTemplates,
  normalizeN8nWorkflowTemplate,
  toN8nTemplateOption,
} from '../lib/n8nTemplateCatalog'

const baseWorkflow = {
  id: 1001,
  name: 'Lead enrichment with Gmail and HubSpot',
  totalViews: 2200,
  recentViews: 120,
  price: null,
  purchaseUrl: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  user: {
    username: 'ops-builder',
    verified: true,
  },
  readyToDemo: true,
  nodes: [
    {
      name: 'n8n-nodes-base.webhook',
      displayName: 'Webhook',
      codex: {
        data: {
          alias: ['Trigger'],
          categories: ['Core Nodes'],
          subcategories: {
            'Core Nodes': ['Helpers'],
          },
        },
      },
      nodeCategories: [{ name: 'Core Nodes' }],
    },
    {
      name: 'n8n-nodes-base.gmail',
      displayName: 'Gmail',
      codex: {
        data: {
          alias: ['Email'],
        },
      },
      nodeCategories: [{ name: 'Communication' }],
    },
    {
      name: 'n8n-nodes-base.hubspot',
      displayName: 'HubSpot',
      codex: {
        data: {
          alias: ['CRM'],
        },
      },
      nodeCategories: [{ name: 'Sales' }],
    },
  ],
}

describe('n8nTemplateCatalog normalization', () => {
  it('normalizes workflow metadata and extracts actions/skills', () => {
    const entry = normalizeN8nWorkflowTemplate(baseWorkflow)

    expect(entry).toBeTruthy()
    expect(entry.template_id).toBe(1001)
    expect(entry.slug).toContain('n8n-1001')
    expect(entry.install_tier).toBe('priority')
    expect(entry.action_keys).toEqual(expect.arrayContaining(['trigger_webhook', 'send_email', 'crm_sales']))
    expect(entry.skill_tags).toEqual(expect.arrayContaining(['trigger', 'email', 'crm']))
    expect(entry.module_targets).toEqual(expect.arrayContaining(['prospector', 'automation']))
  })

  it('marks paid templates as catalog_only and not installable', () => {
    const entry = normalizeN8nWorkflowTemplate({
      ...baseWorkflow,
      id: 1002,
      name: 'Paid automation template',
      price: 49,
      purchaseUrl: 'https://example.com/buy',
      recentViews: 0,
      totalViews: 10,
    })

    expect(entry.is_installable).toBe(false)
    expect(entry.install_tier).toBe('catalog_only')
  })
})

describe('n8nTemplateCatalog filtering + snapshot', () => {
  it('builds snapshot stats and supports filtering', () => {
    const snapshot = buildN8nTemplateCatalogSnapshot({
      workflows: [
        baseWorkflow,
        {
          ...baseWorkflow,
          id: 2001,
          name: 'Weather monitoring alerts',
          user: { username: 'sentinel', verified: false },
          totalViews: 150,
          recentViews: 12,
        },
      ],
      syncedAt: '2026-03-13T00:00:00.000Z',
    })

    expect(snapshot.stats.total).toBe(2)
    expect(snapshot.stats.installable).toBe(2)

    const filtered = filterN8nTemplates(snapshot.entries, { search: 'weather', limit: 5 })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toContain('Weather')
  })

  it('converts entries into automation template option payload', () => {
    const entry = normalizeN8nWorkflowTemplate(baseWorkflow)
    const option = toN8nTemplateOption(entry)

    expect(option.value).toBe('1001')
    expect(option.pageUrl).toBe('https://n8n.io/workflows/1001')
    expect(option.downloadUrl).toBe('https://api.n8n.io/templates/workflows/1001')
  })
})
