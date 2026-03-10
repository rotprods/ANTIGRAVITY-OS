import fs from 'fs';
import https from 'https';
import path from 'path';

const DOCS_DIR = path.join(process.cwd(), 'docs');
const PUBLIC_CATALOG_DIR = path.join(process.cwd(), 'public', 'public-api-catalog');

async function fetchPublicApisReadme() {
    return new Promise((resolve, reject) => {
        https.get('https://raw.githubusercontent.com/public-apis/public-apis/master/README.md', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function generateMasterCatalog() {
    console.log('Fetching public-apis README...');
    const readmeContent = await fetchPublicApisReadme();

    console.log('Reading local full.json...');
    let existingApis = [];
    try {
        const fullJsonPath = path.join(PUBLIC_CATALOG_DIR, 'full.json');
        if (fs.existsSync(fullJsonPath)) {
            existingApis = JSON.parse(fs.readFileSync(fullJsonPath, 'utf8'));
        }
    } catch (e) {
        console.warn('Could not read full.json:', e.message);
    }

    const lines = readmeContent.split('\n');
    let inTable = false;
    let githubApis = [];
    let currentCategory = 'General';

    // Parse GitHub README tables
    for (const line of lines) {
        if (line.startsWith('### ')) {
            currentCategory = line.substring(4).trim();
        } else if (line.startsWith('| API |')) {
            inTable = true;
        } else if (line.startsWith('|---|') || line.startsWith('|--- |')) {
            // separator
        } else if (inTable && line.startsWith('|')) {
            const cols = line.split('|').map(s => s.trim());
            if (cols.length >= 5) {
                const apiLinkRaw = cols[1]; // e.g. [Animals](https://...)
                let name = apiLinkRaw;
                let url = '';
                const match = apiLinkRaw.match(/\[(.*?)\]\((.*?)\)/);
                if (match) {
                    name = match[1];
                    url = match[2];
                }
                const description = cols[2];
                const auth = cols[3];
                const cors = cols[4];
                const linkLabel = cols[5] || '';

                if (name && name !== 'API') {
                    githubApis.push({
                        name,
                        url,
                        description,
                        auth: auth === 'No' ? 'None' : auth,
                        category: currentCategory,
                        source: 'public-apis/git'
                    });
                }
            }
        } else if (inTable && !line.startsWith('|')) {
            inTable = false; // end of table
        }
    }

    // Map existing APIs
    const localMapped = Array.isArray(existingApis.entries) ? existingApis.entries.map(api => ({
        name: api.name || api.title || 'Unknown API',
        url: api.url || api.docs_url || api.reference_url || '',
        description: api.description || 'No description',
        auth: api.auth || 'Unknown',
        category: api.category || 'Integrations',
        source: 'local_catalog'
    })) : [];

    // Merge & deduplicate by URL
    const merged = new Map();
    for (const api of [...localMapped, ...githubApis]) {
        if (api.url && !merged.has(api.url)) {
            merged.set(api.url, api);
        }
    }

    const allApis = Array.from(merged.values());
    console.log(`Merged ${allApis.length} total APIs`);

    // Sort by category
    allApis.sort((a, b) => a.category.localeCompare(b.category));

    let mdContent = `# ANTIGRAVITY OS — Mega API Catalog\n\n`;
    mdContent += `> This master catalog contains **${allApis.length}** public APIs compiled from multiple open sources, including the public-apis registry and our internal verified directory.\n\n`;

    let activeCategory = '';
    for (const api of allApis) {
        if (api.category !== activeCategory) {
            activeCategory = api.category;
            mdContent += `\n## ${activeCategory}\n\n`;
            mdContent += `| API Name | Description | Auth | Source |\n`;
            mdContent += `|----------|-------------|------|--------|\n`;
        }
        const safeName = api.name.replace(/\|/g, '-');
        const safeDesc = api.description.replace(/\|/g, '-').replace(/\r?\n/g, ' ');
        const mdLink = api.url ? `[${safeName}](${api.url})` : safeName;
        mdContent += `| ${mdLink} | ${safeDesc} | ${api.auth || 'None'} | ${api.source === 'local_catalog' ? '✅ Internal' : '🌐 Scraped'} |\n`;
    }

    const outPath = path.join(DOCS_DIR, 'api-master-catalog.md');
    fs.writeFileSync(outPath, mdContent);
    console.log(`Successfully wrote ${allApis.length} APIs to docs/api-master-catalog.md`);
}

generateMasterCatalog().catch(console.error);
