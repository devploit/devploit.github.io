/* Renders all data-driven site content (CVEs, CTF results, live hacking
   events) from assets/data/*.json into the marked HTML sections, and keeps
   sitemap.xml lastmod dates in sync with actual page changes.
   Kept under its historical name so existing tooling keeps working. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const data = JSON.parse(await readFile(path.join(root, 'assets/data/cves.json'), 'utf8'));
const ctfData = JSON.parse(await readFile(path.join(root, 'assets/data/ctf.json'), 'utf8'));
const liveData = JSON.parse(await readFile(path.join(root, 'assets/data/live.json'), 'utf8'));
const recordsById = new Map(data.records.map((record) => [record.id, record]));
const ctfById = new Map(ctfData.results.map((result) => [result.id, result]));

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slug(record) {
  return record.id.toLowerCase();
}

function cvssLabel(record) {
  return record.cvss
    ? `CVSS ${record.cvss.score} ${record.cvss.severity}`
    : 'CVSS Pending';
}

function publicationCountLabel(count) {
  return `${count} CVE ${count === 1 ? 'publication' : 'publications'} pending`;
}

function requireRecord(id, collectionName) {
  const record = recordsById.get(id);
  if (!record) throw new Error(`${collectionName} references unknown CVE ${id}`);
  return record;
}

function requireCtfResult(id, collectionName) {
  const result = ctfById.get(id);
  if (!result) throw new Error(`${collectionName} references unknown CTF result ${id}`);
  return result;
}

/* ── CVEs ── */

function renderStats() {
  const published = data.records.filter((record) => record.publicationStatus === 'published').length;
  const pending = data.records.length - published;
  return [
    '        <div class="stats" aria-label="CVE track record">',
    `          <span class="badge">${data.records.length} CVE identifiers</span>`,
    `          <span class="badge">${published} published CVE records</span>`,
    `          <span class="badge">${publicationCountLabel(pending)}</span>`,
    '        </div>'
  ].join('\n');
}

function renderKeyFindings() {
  return data.keyFindings.map((id) => {
    const record = requireRecord(id, 'keyFindings');
    const score = ` · ${cvssLabel(record)}`;
    return [
      '            <article class="item">',
      `              <a class="item-link" href="#${slug(record)}">`,
      '                <div class="title-row">',
      `                  <div class="title">${escapeHtml(record.id)} · ${escapeHtml(record.keyTitle)}</div>`,
      `                  <div class="year">${record.year}</div>`,
      '                </div>',
      `                <div class="subtitle">${escapeHtml(record.keySubtitle + score)}</div>`,
      '              </a>',
      '            </article>'
    ].join('\n');
  }).join('\n');
}

function renderRecord(record) {
  const metadata = [
    { label: cvssLabel(record), emphasized: Boolean(record.cvss) },
    { label: record.type },
    { label: record.cwes.join(' / ') },
    { label: record.version },
    { label: record.publication },
    { label: record.verification }
  ];

  if (record.publicationStatus === 'pending') {
    metadata.push({ label: 'CVE publication pending' });
  }

  const badges = metadata.map(({ label, emphasized }) =>
    `                <span class="cve-badge${emphasized ? '' : ' is-muted'}">${escapeHtml(label)}</span>`
  ).join('\n');

  const references = record.references.map((reference) =>
    `                <a class="source-link" href="${escapeHtml(reference.url)}" target="_blank" rel="noopener">${escapeHtml(reference.label)}</a>`
  ).join('\n');

  return [
    `            <article class="item is-static" id="${slug(record)}">`,
    '              <div class="title-row">',
    `                <div class="title">${escapeHtml(record.id)}</div>`,
    `                <div class="year">${record.year}</div>`,
    '              </div>',
    `              <div class="subtitle">${escapeHtml(record.title)}</div>`,
    `              <p class="summary">${escapeHtml(record.summary)}</p>`,
    '              <div class="cve-meta" aria-label="CVE metadata">',
    badges,
    '              </div>',
    '              <div class="source-links" aria-label="External references">',
    references,
    '              </div>',
    '            </article>'
  ].join('\n');
}

function renderRecords() {
  return data.records.map(renderRecord).join('\n');
}

function renderRecordsMeta() {
  const published = data.records.filter((record) => record.publicationStatus === 'published').length;
  const pending = data.records.length - published;
  return `          <div class="meta">${published} published · ${publicationCountLabel(pending)}</div>`;
}

function renderHomeKicker() {
  return `              <span class="recognition-kicker">${data.records.length} assigned</span>`;
}

function renderHomeFeatured() {
  return data.homeFeatured.map((id) => {
    const record = requireRecord(id, 'homeFeatured');
    return [
      '              <li>',
      `                <a href="/cves.html#${slug(record)}">`,
      '                  <div class="recognition-item-top">',
      `                    <div class="recognition-title">${escapeHtml(record.id)}</div>`,
      `                    <div class="recognition-year">${record.year}</div>`,
      '                  </div>',
      `                  <div class="recognition-subtitle">${escapeHtml(record.homeSubtitle)}</div>`,
      '                  <div class="recognition-meta">',
      `                    <span class="recognition-badge">${escapeHtml(cvssLabel(record))}</span>`,
      `                    <span class="recognition-badge is-muted">${escapeHtml(record.homeType || record.type)}</span>`,
      `                    <span class="recognition-badge is-muted">${escapeHtml(record.cwes[0])}</span>`,
      '                  </div>',
      '                </a>',
      '              </li>'
    ].join('\n');
  }).join('\n');
}

/* ── CTF results ── */

function ctfKeyTitle(result) {
  return result.keyTitle || result.title;
}

function ctfKeySubtitle(result) {
  return result.keySubtitle || result.subtitle;
}

function renderCtfItem(result, { title, subtitle }) {
  const inner = [
    `              <div class="title-row"><div class="title">${escapeHtml(title)}</div><div class="year">${result.year}</div></div>`,
    `              <div class="subtitle">${escapeHtml(subtitle)}</div>`
  ];

  if (result.url) {
    return [
      '            <div class="item">',
      `              <a href="${escapeHtml(result.url)}" target="_blank" rel="noopener">`,
      ...inner.map((line) => `  ${line}`),
      '              </a>',
      '            </div>'
    ].join('\n');
  }

  return ['            <div class="item">', ...inner, '            </div>'].join('\n');
}

function renderCtfKeyResults() {
  return ctfData.keyResults.map((id) => {
    const result = requireCtfResult(id, 'keyResults');
    return renderCtfItem(result, { title: ctfKeyTitle(result), subtitle: ctfKeySubtitle(result) });
  }).join('\n');
}

function renderCtfScope(scope) {
  return ctfData.results
    .filter((result) => result.scope === scope)
    .map((result) => renderCtfItem(result, { title: result.title, subtitle: result.subtitle }))
    .join('\n');
}

function renderCtfIndividualMeta() {
  const years = ctfData.results
    .filter((result) => result.scope === 'individual')
    .map((result) => result.year);
  return `              <div class="meta">${Math.min(...years)}-${Math.max(...years)}</div>`;
}

function renderCtfHomeKicker() {
  const firstYear = Math.min(...ctfData.results.map((result) => result.year));
  return `              <span class="recognition-kicker">Since ${firstYear}</span>`;
}

function renderCtfHomeFeatured() {
  return ctfData.homeFeatured.map((id) => {
    const result = requireCtfResult(id, 'homeFeatured');
    const title = result.homeTitle || ctfKeyTitle(result);
    const subtitle = result.homeSubtitle || ctfKeySubtitle(result);
    const inner = [
      '                <div class="recognition-item-top">',
      `                  <div class="recognition-title">${escapeHtml(title)}</div>`,
      `                  <div class="recognition-year">${result.year}</div>`,
      '                </div>',
      `                <div class="recognition-subtitle">${escapeHtml(subtitle)}</div>`
    ];

    if (result.url) {
      return [
        '              <li>',
        `                <a href="${escapeHtml(result.url)}" target="_blank" rel="noopener">`,
        ...inner.map((line) => `  ${line}`),
        '                </a>',
        '              </li>'
      ].join('\n');
    }

    return ['              <li>', ...inner, '              </li>'].join('\n');
  }).join('\n');
}

/* ── Live hacking events ── */

function liveTitle(event) {
  return `${event.rankLabel} · ${event.event}`;
}

function renderLiveStats() {
  const badges = [
    `${liveData.events.length} public event result${liveData.events.length === 1 ? '' : 's'}`,
    ...liveData.events.map((event) => `Top ${parseInt(event.rankLabel, 10)} in ${event.city} ${event.year}`)
  ];
  return [
    '        <div class="stats" aria-label="Live hacking track record">',
    ...badges.map((badge) => `          <span class="badge">${escapeHtml(badge)}</span>`),
    '        </div>'
  ].join('\n');
}

function renderLiveResults() {
  return liveData.events.map((event) => [
    '            <div class="item">',
    `              <div class="title-row"><div class="title">${escapeHtml(liveTitle(event))}</div><div class="year">${event.year}</div></div>`,
    `              <div class="subtitle">${escapeHtml(event.city)}</div>`,
    '              <div class="item-meta">',
    `                <span class="tag">${escapeHtml(event.platform)}</span>`,
    `                <span class="tag is-muted">${escapeHtml(event.format)}</span>`,
    `                <span class="tag is-muted">${escapeHtml(event.rankLabel)} place</span>`,
    '              </div>',
    '            </div>'
  ].join('\n')).join('\n');
}

function renderLiveHomeKicker() {
  return `              <span class="recognition-kicker">${escapeHtml(liveData.homeKicker)}</span>`;
}

function renderLiveHomeFeatured() {
  return liveData.events.map((event) => [
    '              <li>',
    '                <div class="recognition-item-top">',
    `                  <div class="recognition-title">${escapeHtml(liveTitle(event))}</div>`,
    `                  <div class="recognition-year">${event.year}</div>`,
    '                </div>',
    `                <div class="recognition-subtitle">${escapeHtml(event.city)}</div>`,
    '                <div class="recognition-meta">',
    `                  <span class="recognition-badge">${escapeHtml(event.platform)}</span>`,
    `                  <span class="recognition-badge is-muted">${escapeHtml(event.format)}</span>`,
    '                </div>',
    '              </li>'
  ].join('\n')).join('\n');
}

/* ── File updates ── */

async function updateSections(relativePath, sections) {
  const filePath = path.join(root, relativePath);
  const source = await readFile(filePath, 'utf8');
  let output = source;

  for (const [name, content] of Object.entries(sections)) {
    const start = `<!-- ${name}:START -->`;
    const end = `<!-- ${name}:END -->`;
    const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
    if (!pattern.test(output)) throw new Error(`Missing ${name} markers in ${relativePath}`);
    output = output.replace(pattern, `${start}\n${content}\n${end}`);
  }

  if (checkOnly) {
    if (output !== source) throw new Error(`${relativePath} is out of sync with its assets/data source`);
    return false;
  }

  const changed = output !== source;
  if (changed) await writeFile(filePath, output);
  return changed;
}

/* Bump sitemap lastmod only for pages whose rendered content changed. */
async function updateSitemap(changedPages) {
  if (checkOnly || !changedPages.length) return;

  const sitemapPath = path.join(root, 'sitemap.xml');
  const source = await readFile(sitemapPath, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  let output = source;

  for (const page of changedPages) {
    const loc = page === 'index.html' ? 'https://devploit.dev/' : `https://devploit.dev/${page}`;
    const pattern = new RegExp(`(<loc>${loc.replaceAll('/', '\\/').replaceAll('.', '\\.')}</loc>\\s*<lastmod>)[^<]+(</lastmod>)`);
    if (!pattern.test(output)) throw new Error(`sitemap.xml has no entry for ${loc}`);
    output = output.replace(pattern, `$1${today}$2`);
  }

  if (output !== source) await writeFile(sitemapPath, output);
}

const pageSections = {
  'cves.html': {
    CVE_STATS: renderStats(),
    CVE_KEY_FINDINGS: renderKeyFindings(),
    CVE_RECORDS_META: renderRecordsMeta(),
    CVE_RECORDS: renderRecords()
  },
  'ctf.html': {
    CTF_KEY_RESULTS: renderCtfKeyResults(),
    CTF_INDIVIDUAL_META: renderCtfIndividualMeta(),
    CTF_INDIVIDUAL: renderCtfScope('individual'),
    CTF_TEAM: renderCtfScope('team')
  },
  'livehackingevents.html': {
    LIVE_STATS: renderLiveStats(),
    LIVE_RESULTS: renderLiveResults()
  },
  'index.html': {
    CVE_HOME_KICKER: renderHomeKicker(),
    CVE_HOME_FEATURED: renderHomeFeatured(),
    CTF_HOME_KICKER: renderCtfHomeKicker(),
    CTF_HOME_FEATURED: renderCtfHomeFeatured(),
    LIVE_HOME_KICKER: renderLiveHomeKicker(),
    LIVE_HOME_FEATURED: renderLiveHomeFeatured()
  }
};

const changedPages = [];
for (const [page, sections] of Object.entries(pageSections)) {
  if (await updateSections(page, sections)) changedPages.push(page);
}

await updateSitemap(changedPages);

console.log(checkOnly ? 'Data-driven content is up to date.' : 'Rendered data-driven content.');
