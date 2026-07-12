import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', 'ctf.html', 'cves.html', 'livehackingevents.html', '404.html'];
const innerPages = ['ctf.html', 'cves.html', 'livehackingevents.html'];
const failures = [];

for (const page of pages) {
  const source = await readFile(path.join(root, page), 'utf8');
  const ids = [...source.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) failures.push(`${page} has duplicate IDs: ${[...new Set(duplicates)].join(', ')}`);
  if (!source.includes('class="skip-link"')) failures.push(`${page} is missing a skip link`);
  if (!/<main[^>]+id="main-content"/.test(source)) failures.push(`${page} is missing the main-content landmark target`);
  if (!/<nav[^>]+aria-label="Main navigation"/.test(source)) failures.push(`${page} is missing a labelled main navigation`);
  if (!source.includes('Content-Security-Policy')) failures.push(`${page} is missing its CSP fallback`);
  if (source.includes('unsafe-inline')) failures.push(`${page} CSP still allows unsafe-inline`);

  for (const match of source.matchAll(/(?:href|src)="(\/[^"?#]*)/g)) {
    const target = match[1] === '/' ? 'index.html' : match[1].slice(1);
    try {
      await access(path.join(root, target));
    } catch {
      failures.push(`${page} references missing local target ${match[1]}`);
    }
  }
}

for (const page of innerPages) {
  const source = await readFile(path.join(root, page), 'utf8');
  if (!source.includes('aria-current="page"')) failures.push(`${page} is missing aria-current on its active navigation item`);
  if (!source.includes('/assets/css/inner.css')) failures.push(`${page} is missing the shared inner-page stylesheet`);
}

const indexSource = await readFile(path.join(root, 'index.html'), 'utf8');
if (/<script(?![^>]+src=)[^>]*>/.test(indexSource)) failures.push('index.html contains an inline script');
if (/<style[^>]*>/.test(indexSource)) failures.push('index.html contains an inline style block');

const homeScript = await readFile(path.join(root, 'assets/js/home.js'), 'utf8');
if (homeScript.includes('api.allorigins.win')) failures.push('The home feed still depends on AllOrigins');
if (!homeScript.includes("url.origin === blogOrigin")) failures.push('Blog feed links are not restricted to the expected origin');

const homeStyles = await readFile(path.join(root, 'assets/css/home.css'), 'utf8');
if (!homeStyles.includes(".recognition-link::after {\n  content: '→';")) failures.push('Recognition links do not use a navigation arrow');
for (const selector of ['.recognition-kicker', '.recognition-year', '.recognition-subtitle', '.recognition-badge']) {
  if (!homeStyles.includes(selector)) failures.push(`Missing mobile typography rule for ${selector}`);
}

for (const stylesheet of ['assets/css/ctf.css', 'assets/css/cves.css', 'assets/css/live.css']) {
  const source = await readFile(path.join(root, stylesheet), 'utf8');
  for (const sharedSelector of ['.hero {', '.stats {', '.section-head {', '.card {', '.title-row {', '.subtitle {', '.footer {']) {
    if (source.includes(sharedSelector)) failures.push(`${stylesheet} duplicates shared selector ${sharedSelector}`);
  }
}

const cveData = JSON.parse(await readFile(path.join(root, 'assets/data/cves.json'), 'utf8'));
const cves = await readFile(path.join(root, 'cves.html'), 'utf8');
const cveIds = cveData.records.map((record) => record.id);
if (new Set(cveIds).size !== cveIds.length) failures.push('assets/data/cves.json has duplicate CVE identifiers');
const published = cveData.records.filter((record) => record.publicationStatus === 'published').length;
const pending = cveData.records.length - published;
if (published !== 9 || pending !== 2) failures.push(`Expected 9 published and 2 pending CVEs, found ${published} and ${pending}`);
if (!cves.includes(`${published} published CVE records`) || !cves.includes(`${pending} CVE publications pending`)) {
  failures.push('Rendered CVE status counts do not match the source data');
}
const amelia = cveData.records.find((record) => record.id === 'CVE-2026-6449');
if (!amelia || amelia.cvss?.score !== 5.3 || amelia.cvss?.severity !== 'Medium') {
  failures.push('CVE-2026-6449 must use the official CVSS 5.3 Medium score');
}
const admZip = cveData.records.find((record) => record.id === 'CVE-2026-39244');
if (!admZip || admZip.cvss?.score !== 7.5 || admZip.cvss?.severity !== 'High') {
  failures.push('CVE-2026-39244 must use the official CVSS 7.5 High score');
}

const cloudflareRule = JSON.parse(await readFile(path.join(root, 'cloudflare/security-headers-rule.json'), 'utf8'));
const configuredHeaders = cloudflareRule.action_parameters?.headers || {};
for (const header of [
  'content-security-policy',
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy'
]) {
  if (configuredHeaders[header]?.operation !== 'set') failures.push(`Cloudflare rule is missing a set operation for ${header}`);
}

for (const source of [cves, indexSource]) {
  for (const match of source.matchAll(/href="(?:\/cves\.html)?#(cve-[^"]+)"/g)) {
    if (!cves.includes(`id="${match[1]}"`)) failures.push(`Missing CVE anchor target ${match[1]}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Local paths, IDs, and CVE anchors are valid.');
