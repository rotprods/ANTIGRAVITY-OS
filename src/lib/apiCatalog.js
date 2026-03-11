/**
 * OCULOPS — API Catalog Index
 * Query the 10k API catalog for agent use.
 *
 * Usage:
 *   import { searchApis, filterByCategory, getFreeApis } from '@/lib/apiCatalog';
 */

let _catalog = null;

async function getCatalog() {
  if (_catalog) return _catalog;
  const mod = await import('@/data/api-mega-catalog.json', { assert: { type: 'json' } });
  _catalog = mod.default;
  return _catalog;
}

/**
 * Search APIs by keyword (name + description).
 * @param {string} query
 * @param {{ limit?: number, authFilter?: string, categoryFilter?: string }} opts
 * @returns {Promise<Array>}
 */
export async function searchApis(query, opts = {}) {
  const { limit = 20, authFilter, categoryFilter } = opts;
  const catalog = await getCatalog();
  const q = query.toLowerCase();

  let results = catalog.apis.filter((api) => {
    const match =
      api.name?.toLowerCase().includes(q) ||
      api.description?.toLowerCase().includes(q) ||
      api.category?.toLowerCase().includes(q);
    if (!match) return false;
    if (authFilter && api.auth !== authFilter) return false;
    if (categoryFilter && api.category?.toLowerCase() !== categoryFilter.toLowerCase()) return false;
    return true;
  });

  return results.slice(0, limit);
}

/**
 * Get all APIs in a category.
 * @param {string} category
 * @param {{ limit?: number }} opts
 */
export async function filterByCategory(category, opts = {}) {
  const { limit = 50 } = opts;
  const catalog = await getCatalog();
  const cat = category.toLowerCase();
  return catalog.apis
    .filter((a) => a.category?.toLowerCase().includes(cat))
    .slice(0, limit);
}

/**
 * Get APIs that require no authentication.
 * @param {{ category?: string, limit?: number }} opts
 */
export async function getFreeApis(opts = {}) {
  const { category, limit = 50 } = opts;
  const catalog = await getCatalog();
  return catalog.apis
    .filter((a) => {
      const isFree = a.auth === 'none' || a.auth === '' || !a.auth;
      if (category) return isFree && a.category?.toLowerCase().includes(category.toLowerCase());
      return isFree;
    })
    .slice(0, limit);
}

/**
 * Get catalog statistics.
 */
export async function getCatalogStats() {
  const catalog = await getCatalog();
  return {
    total: catalog.total,
    generated_at: catalog.generated_at,
    sources: catalog.sources,
    top_categories: Object.entries(catalog.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({ name, count })),
    auth_breakdown: catalog.apis.reduce((acc, a) => {
      const k = a.auth || 'unknown';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
  };
}

/**
 * Get all unique categories.
 */
export async function getCategories() {
  const catalog = await getCatalog();
  return Object.entries(catalog.categories)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

/**
 * Get a random sample of APIs.
 * @param {{ count?: number, authFilter?: string }} opts
 */
export async function getRandomApis(opts = {}) {
  const { count = 10, authFilter } = opts;
  const catalog = await getCatalog();
  let pool = authFilter
    ? catalog.apis.filter((a) => a.auth === authFilter)
    : catalog.apis;
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Find APIs by source.
 * @param {'apis.guru'|'public-apis'|'github'|'github-code-search'} source
 * @param {{ limit?: number }} opts
 */
export async function filterBySource(source, opts = {}) {
  const { limit = 50 } = opts;
  const catalog = await getCatalog();
  return catalog.apis
    .filter((a) => a.source === source)
    .slice(0, limit);
}
