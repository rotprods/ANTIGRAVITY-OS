const pw = require('playwright');
const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;

(async () => {
  // Sign in via Supabase REST API
  const email = 'rot.prods@gmail.com';
  const password = 'Rot829102001!';

  let session = null;
  try {
    const resp = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ email, password }),
    });
    session = await resp.json();
    if (session.access_token) {
      console.log('Auth OK — user:', session.user.email);
    } else {
      console.log('Auth FAILED:', JSON.stringify(session).substring(0, 200));
      return;
    }
  } catch (e) {
    console.log('Auth error:', e.message);
    return;
  }

  const browser = await pw.chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const allErrors = [];
  const failedHTTP = [];

  page.on('console', msg => {
    if (msg.type() === 'error') allErrors.push(msg.text().substring(0, 400));
  });
  page.on('pageerror', err => allErrors.push('PAGE_ERROR: ' + (err.message || '').substring(0, 400)));
  page.on('response', res => {
    if (res.status() >= 400 && !res.url().includes('posthog') && !res.url().includes('sentry')) {
      failedHTTP.push(res.status() + ' ' + res.url().substring(0, 200));
    }
  });

  const BASE = 'http://localhost:5173';

  // Load app and inject session
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 15000 });

  const storageKey = 'sb-' + new URL(SUPABASE_URL).hostname.split('.')[0] + '-auth-token';
  await page.evaluate(({ key, session }) => {
    const tokenData = {
      currentSession: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + session.expires_in,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: session.user,
      },
      expiresAt: Math.floor(Date.now() / 1000) + session.expires_in,
    };
    localStorage.setItem(key, JSON.stringify(tokenData));
    localStorage.setItem('oculops_onboarding_done', '1');
  }, { key: storageKey, session });

  // Reload with session
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);

  // Auth check
  const authCheck = await page.evaluate(() => ({
    hasMain: !!document.querySelector('main'),
    hasSidebar: !!document.querySelector('.os-sidebar'),
    isAuth: (document.body.textContent || '').includes('Entrar'),
    text: (document.body.textContent || '').substring(0, 200),
  }));

  console.log('\nAuth check:', authCheck.hasMain ? 'LOGGED IN' : authCheck.isAuth ? 'AUTH SCREEN' : 'UNKNOWN');
  if (!authCheck.hasMain) {
    console.log('Body:', authCheck.text);
    console.log('Errors:', allErrors);
    await browser.close();
    return;
  }

  // Take screenshot of landing
  await page.screenshot({ path: '/tmp/oculops-home.png', fullPage: false });
  console.log('Screenshot: /tmp/oculops-home.png\n');

  // TEST ALL ROUTES
  console.log('=== DASHBOARD AUDIT ===');
  console.log('Route'.padEnd(20) + ' | Status'.padEnd(13) + ' | HTML Len | Height | Content Preview');
  console.log('-'.repeat(100));

  const routes = [
    '/control-tower', '/pipeline', '/crm', '/intelligence',
    '/execution', '/finance', '/agents', '/herald',
    '/prospector', '/automation', '/analytics', '/markets',
    '/gtm', '/messaging', '/creative', '/knowledge',
    '/experiments', '/decisions', '/niches', '/simulation',
    '/settings', '/billing', '/watchtower', '/portfolio',
    '/flight-deck', '/pixel-office', '/marketplace',
    '/command-center', '/world-monitor', '/lab', '/studies',
    '/team-settings', '/reports', '/opportunities',
  ];

  const results = [];

  for (const route of routes) {
    const errsBefore = allErrors.length;
    const failBefore = failedHTTP.length;

    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2500);

      const r = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!main) return { tag: 'NO_MAIN', len: 0, h: 0, text: '' };
        const text = (main.textContent || '').trim().replace(/\s+/g, ' ');
        const html = main.innerHTML || '';
        const hasErr = text.includes('Reintentar') || text.includes('Error inesperado') || text.includes('error');
        const hasSkel = html.includes('class="skeleton"');
        const isEmpty = html.length < 100;
        return {
          tag: hasErr ? 'ERROR_BOUND' : hasSkel ? 'SKELETON' : isEmpty ? 'EMPTY' : 'OK',
          len: html.length,
          h: Math.round(main.getBoundingClientRect().height),
          text: text.substring(0, 80),
        };
      });

      const newErrs = allErrors.slice(errsBefore).filter(e => !e.includes('posthog') && !e.includes('Sentry'));
      const newFails = failedHTTP.slice(failBefore);
      const errNote = newErrs.length ? ` [${newErrs.length} err]` : '';

      results.push({ route, ...r, errors: newErrs, fails: newFails });
      console.log(`${route.padEnd(20)} | ${(r.tag + errNote).padEnd(18)} | ${String(r.len).padEnd(8)} | ${String(r.h).padEnd(6)} | "${r.text.substring(0, 50)}"`);

      if (newErrs.length) newErrs.forEach(e => console.log(`  ERR: ${e.substring(0, 200)}`));
      if (newFails.length) newFails.forEach(f => console.log(`  HTTP: ${f}`));

    } catch (e) {
      results.push({ route, tag: 'TIMEOUT', len: 0, h: 0, text: '', errors: [e.message] });
      console.log(`${route.padEnd(20)} | TIMEOUT            | ${''.padEnd(8)} | ${''.padEnd(6)} | ${(e.message || '').substring(0, 50)}`);
    }
  }

  // Summary
  const ok = results.filter(r => r.tag === 'OK').length;
  const broken = results.filter(r => r.tag !== 'OK');
  console.log('\n=== SUMMARY ===');
  console.log(`OK: ${ok}/${results.length}`);
  if (broken.length) {
    console.log(`BROKEN: ${broken.length}`);
    broken.forEach(r => console.log(`  ${r.route}: ${r.tag} (${r.errors.length} errors)`));
  }

  console.log(`\nTotal console errors: ${allErrors.filter(e => !e.includes('posthog') && !e.includes('Sentry')).length}`);
  console.log(`Total failed HTTP: ${failedHTTP.length}`);

  // Screenshot last broken page if any
  if (broken.length) {
    await page.goto(BASE + broken[0].route, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/oculops-broken.png', fullPage: false });
    console.log(`\nScreenshot of ${broken[0].route}: /tmp/oculops-broken.png`);
  }

  await browser.close();
})().catch(e => console.error('FATAL:', e.message));
