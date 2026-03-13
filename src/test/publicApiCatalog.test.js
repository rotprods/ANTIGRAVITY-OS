import { describe, it, expect } from 'vitest'
import readmeFixture from './fixtures/publicApisReadme.fixture.md?raw'
import {
  buildCatalogSlug,
  computeActivationTier,
  normalizeAuthValue,
  normalizeCorsValue,
  normalizeHttpsValue,
  parsePublicApisMarkdown,
  scoreBusinessFit,
} from '../lib/publicApiCatalog'

describe('publicApiCatalog parsing + normalization', () => {
  it('normalizes known source anomalies from README rows', () => {
    expect(normalizeAuthValue('X-Mashape-Key')).toBe('api_key')
    expect(normalizeAuthValue('User-Agent')).toBe('header')
    expect(normalizeHttpsValue('YES')).toBe('Yes')
    expect(normalizeCorsValue('Unkown')).toBe('Unknown')
  })

  it('parses markdown categories/tables and supports trailing pipes', () => {
    const entries = parsePublicApisMarkdown(readmeFixture)
    expect(entries).toHaveLength(7)

    const adresse = entries.find(entry => entry.name === 'adresse.data.gouv.fr')
    expect(adresse).toBeTruthy()
    expect(adresse.auth_type).toBe('none')
    expect(adresse.https_only).toBe(true)
    expect(adresse.cors_policy).toBe('Unknown')

    const trailing = entries.find(entry => entry.name === 'Trailing Pipe API')
    expect(trailing).toBeTruthy()
    expect(trailing.auth_type).toBe('api_key')
    expect(trailing.cors_policy).toBe('No')
  })

  it('builds stable slug keys with category + name + docs hostname', () => {
    const one = buildCatalogSlug('Finance', 'Same Name', 'https://same-one.example.com/docs')
    const two = buildCatalogSlug('News', 'Same Name', 'https://same-two.example.com/docs')

    expect(one).not.toBe(two)
    expect(one).toContain('finance')
    expect(two).toContain('news')
  })
})

describe('publicApiCatalog scoring + activation tiers', () => {
  it('scores business fit using category, keywords, auth, and HTTPS modifiers', () => {
    const highFit = scoreBusinessFit({
      name: 'Open weather market intelligence',
      description: 'Macro forecast and treasury weather signals',
      category: 'Weather',
      auth_type: 'none',
      https_only: true,
    })
    const lowFit = scoreBusinessFit({
      name: 'Fun API',
      description: 'Pure memes',
      category: 'Entertainment',
      auth_type: 'none',
      https_only: false,
    })

    expect(highFit).toBe(65)
    expect(lowFit).toBe(0)
  })

  it('assigns activation tier correctly for catalog/candidate/adapter_ready', () => {
    const candidate = computeActivationTier({
      slug: 'weather-open-meteo-open-meteo-com',
      https_only: true,
      business_fit_score: 67,
    })
    const catalogOnly = computeActivationTier({
      slug: 'fun-api',
      https_only: false,
      business_fit_score: 90,
    })
    const adapterReady = computeActivationTier({
      slug: 'finance-fred-fred-stlouisfed-org',
      https_only: true,
      business_fit_score: 40,
    }, {
      adapterReadySlugs: new Set(['finance-fred-fred-stlouisfed-org']),
    })

    expect(candidate).toBe('candidate')
    expect(catalogOnly).toBe('catalog_only')
    expect(adapterReady).toBe('adapter_ready')
  })
})
