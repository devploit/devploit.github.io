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
  if (/href="\/index\.html(?:["#?])/.test(source)) failures.push(`${page} links to the non-canonical homepage`);

  if (page !== '404.html') {
    const canonical = page === 'index.html' ? 'https://devploit.dev/' : `https://devploit.dev/${page}`;
    if (!source.includes(`<link rel="canonical" href="${canonical}">`)) failures.push(`${page} has an unexpected canonical URL`);
    if (!source.includes(`<meta property="og:url" content="${canonical}">`)) failures.push(`${page} Open Graph URL does not match its canonical`);
    if ([...source.matchAll(/<h1\b/g)].length !== 1) failures.push(`${page} must have one main heading`);
    if (!/<meta name="description" content="[^"]+"/.test(source)) failures.push(`${page} needs a description`);
  }

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
for (const match of indexSource.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (/\bsrc=/.test(match[1])) continue;
  if (match[1].trim() !== 'type="application/ld+json"') {
    failures.push('index.html contains an inline executable script');
    continue;
  }
  try {
    JSON.parse(match[2]);
  } catch {
    failures.push('index.html contains invalid JSON-LD');
  }
}
if (/<style[^>]*>/.test(indexSource)) failures.push('index.html contains an inline style block');

const schemas = [...indexSource.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
if (schemas.length !== 1) failures.push('index.html must have one static profile schema');
if (schemas.length === 1) {
  try {
    const profile = JSON.parse(schemas[0][1]);
    if (profile['@type'] !== 'ProfilePage' || profile.mainEntity?.['@type'] !== 'Person' ||
        profile.mainEntity?.name !== 'Daniel Púa' || profile.url !== 'https://devploit.dev/') {
      failures.push('Homepage schema does not describe the canonical personal profile');
    }
    const posts = JSON.parse(await readFile(path.join(root, 'assets/data/posts.json'), 'utf8'));
    const blogSection = indexSource.match(/<!-- BLOG_HOME:START -->([\s\S]*?)<!-- BLOG_HOME:END -->/)?.[1] ?? '';
    for (const post of posts) {
      if (!blogSection.includes(`href="${post.url}"`)) failures.push(`Missing static article link: ${post.url}`);
      if (!profile.hasPart?.some((article) => article.url === post.url && article.headline === post.title)) {
        failures.push(`Profile schema is missing featured article: ${post.url}`);
      }
    }
  } catch (error) {
    failures.push(`Unable to validate homepage profile: ${error.message}`);
  }
}

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
if (published !== 11 || pending !== 1) failures.push(`Expected 11 published and 1 pending CVEs, found ${published} and ${pending}`);
const pendingLabel = `CVE ${pending === 1 ? 'publication' : 'publications'} pending`;
const statTile = (value, label) => `<span class="stat-value">${value}</span>\n            <span class="stat-label">${label}</span>`;
if (!cves.includes(statTile(published, 'published records')) || !cves.includes(statTile(pending, pendingLabel))) {
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

const projects = JSON.parse(await readFile(path.join(root, 'assets/data/projects.json'), 'utf8'));
const projectIds = [...projects.products, ...projects.openSource].map((project) => project.id);
if (new Set(projectIds).size !== projectIds.length) failures.push('assets/data/projects.json has duplicate project identifiers');
const productsSection = indexSource.match(/<!-- PRODUCTS_HOME:START -->([\s\S]*?)<!-- PRODUCTS_HOME:END -->/)?.[1] ?? '';
const openSourceSection = indexSource.match(/<!-- OSS_HOME:START -->([\s\S]*?)<!-- OSS_HOME:END -->/)?.[1] ?? '';
for (const product of projects.products) {
  if (!product.url.startsWith('https://')) failures.push(`Product ${product.id} must use an https URL`);
  if (product.highlights.length !== 3) failures.push(`Product ${product.id} must have exactly three highlights`);
  if (!productsSection.includes(`href="${product.url}"`)) failures.push(`index.html products section is missing ${product.url}`);
}
for (const project of projects.openSource) {
  if (!openSourceSection.includes(`href="${project.url}"`)) failures.push(`index.html open-source section is missing ${project.url}`);
}
if (!indexSource.includes('href="#products"')) failures.push('index.html navigation is missing the products link');
if (!homeScript.includes('#products')) failures.push('home.js active-section observer does not include #products');

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
console.log('Canonical URLs, static article links, and profile metadata are valid.');
