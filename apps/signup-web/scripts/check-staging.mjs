// Read-only staging preflight. Never creates orders, companies, codes or payments.
import fs from 'node:fs';
const args = process.argv.slice(2);
const file = args[args.indexOf('--config') + 1];
if (!args.includes('--config') || !file || file.startsWith('--')) {
  console.error('Usage: node scripts/check-staging.mjs --config <settings.json> [--online]');
  process.exit(1);
}
try {
  const settings = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  const url = (key, originOnly = false) => {
    const value = settings[key];
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is not confirmed.`);
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || /REPLACE|\.invalid$|\.example$/i.test(parsed.hostname)) throw new Error(`${key} must be a confirmed HTTPS URL without credentials/placeholders.`);
    if (originOnly && (parsed.pathname !== '/' || parsed.search || parsed.hash)) throw new Error(`${key} must be an origin, without a path/query/fragment.`);
    return parsed;
  };
  const signup = url('signupOrigin', true), api = url('apiOrigin', true);
  for (const key of ['productUrl','termsUrl','refundUrl','privacyUrl']) url(key);
  if (settings.windowsDownloadUrl) url('windowsDownloadUrl');
  if (settings.androidDownloadUrl) url('androidDownloadUrl');
  if (!settings.windowsDownloadUrl && !settings.androidDownloadUrl && settings.installerContactFallback !== true) throw new Error('Downloads or an approved installer contact fallback are required.');
  if (!['contact','test'].includes(settings.paymentMode)) throw new Error('Only the implemented contact or staging test payment mode may be selected.');
  if (settings.paymentMode === 'test' && settings.throwawayCatalogueConfirmed !== true) throw new Error('Test payments require explicit throwaway-catalogue confirmation.');
  console.log('PASS: staging settings are complete; HTTPS URLs, payment mode and installer fallback validated.');
  if (args.includes('--online')) {
    const read = async (target, options) => {
      const response = await fetch(target, {...options, redirect:'error', signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error(`Read-only staging request failed: ${new URL(target).pathname} (${response.status}).`);
      return response;
    };
    const catalogResponse = await read(new URL('/api/public/catalog',api), {headers:{Origin:signup.origin}});
    if (api.origin !== signup.origin && catalogResponse.headers.get('access-control-allow-origin') !== signup.origin) throw new Error('API CORS does not allow the configured signup origin.');
    const catalog = await catalogResponse.json();
    if (api.origin !== signup.origin) {
      const preflight = await read(new URL('/api/public/signup/quote',api), {method:'OPTIONS',headers:{Origin:signup.origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
      if (preflight.headers.get('access-control-allow-origin') !== signup.origin || !/\bPOST\b/i.test(preflight.headers.get('access-control-allow-methods') || '') || !/content-type/i.test(preflight.headers.get('access-control-allow-headers') || '')) throw new Error('API CORS preflight does not allow signup JSON POST requests.');
    }
    if (!Array.isArray(catalog.plans) || !catalog.plans.length) throw new Error('Public catalogue has no available plans.');
    if (catalog.testPayments !== (settings.paymentMode === 'test')) throw new Error('Catalogue test-payment availability does not match the confirmed mode.');
    for (const route of ['/','/signup','/signup/plan','/signup/review','/signup/done']) {
      const response = await read(new URL(route,signup));
      const html = await response.text();
      if (!/id=["']root["']/.test(html)) throw new Error(`SPA document missing at ${route}.`);
      const metaPolicy = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1] || '';
      // The build emits a meta CSP. Check each declared CSP independently because browsers intersect policies.
      const policies = [response.headers.get('content-security-policy'), metaPolicy].filter(Boolean);
      if (!policies.length) throw new Error(`CSP missing at ${route}.`);
      for (const policy of policies) {
        const directive = policy.match(/(?:^|;)\s*connect-src\s+([^;]+)/i)?.[1];
        const sources = directive?.split(/\s+/) || [];
        if (!sources.includes(api.origin) && !(api.origin === signup.origin && sources.includes("'self'"))) throw new Error(`API origin missing from CSP connect-src at ${route}.`);
      }
    }
    for (const key of ['productUrl','termsUrl','refundUrl','privacyUrl']) await read(settings[key],{method:'HEAD'});
    console.log(`PASS: read-only catalogue, CORS, SPA documents, CSP and policy/product destinations. Trial days reported: ${catalog.trialDays}. No companies or payments created. Browser validation and disposable live flows remain separate checks.`);
  }
} catch (error) {
  console.error(`NOT READY: ${error.message}`);
  process.exitCode = 1;
}
