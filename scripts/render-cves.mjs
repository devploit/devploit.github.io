/* Renders all data-driven site content (CVEs, CTF results, live hacking
   events, products and open-source repos) from assets/data/*.json into the
   marked HTML sections, and keeps sitemap.xml lastmod dates in sync with
   actual page changes.
   Kept under its historical name so existing tooling keeps working. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const data = JSON.parse(await readFile(path.join(root, 'assets/data/cves.json'), 'utf8'));
const ctfData = JSON.parse(await readFile(path.join(root, 'assets/data/ctf.json'), 'utf8'));
const liveData = JSON.parse(await readFile(path.join(root, 'assets/data/live.json'), 'utf8'));
const projectsData = JSON.parse(await readFile(path.join(root, 'assets/data/projects.json'), 'utf8'));
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

/* Shared hero stat tiles: a large value with a short label underneath. */
function renderStatTiles(label, tiles) {
  return [
    `        <div class="stats" aria-label="${escapeHtml(label)}">`,
    ...tiles.map(([value, text]) => [
      '          <div class="stat">',
      `            <span class="stat-value">${escapeHtml(value)}</span>`,
      `            <span class="stat-label">${escapeHtml(text)}</span>`,
      '          </div>'
    ].join('\n')),
    '        </div>'
  ].join('\n');
}

function severityKey(record) {
  if (!record.cvss) return 'pending';
  return record.cvss.severity.toLowerCase();
}

function renderStats() {
  const published = data.records.filter((record) => record.publicationStatus === 'published').length;
  const pending = data.records.length - published;
  return renderStatTiles('CVE track record', [
    [String(data.records.length), 'CVE identifiers'],
    [String(published), 'published records'],
    [String(pending), publicationCountLabel(pending).replace(/^\d+ /, '')]
  ]);
}

function renderKeyFindings() {
  return data.keyFindings.map((id) => {
    const record = requireRecord(id, 'keyFindings');
    const score = ` · ${cvssLabel(record)}`;
    return [
      `            <article class="item" data-severity="${severityKey(record)}">`,
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
    `                <span class="cve-badge${emphasized ? ` is-${severityKey(record)}` : ' is-muted'}">${escapeHtml(label)}</span>`
  ).join('\n');

  const references = record.references.map((reference) =>
    `                <a class="source-link" href="${escapeHtml(reference.url)}" target="_blank" rel="noopener">${escapeHtml(reference.label)}</a>`
  ).join('\n');

  return [
    `            <article class="item is-static" id="${slug(record)}" data-severity="${severityKey(record)}">`,
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
  const events = liveData.events;
  const best = events.reduce((top, event) => (parseInt(event.rankLabel, 10) < parseInt(top.rankLabel, 10) ? event : top), events[0]);
  const platforms = new Set(events.map((event) => event.platform)).size;
  return renderStatTiles('Live hacking track record', [
    [String(events.length), `public event result${events.length === 1 ? '' : 's'}`],
    [best.rankLabel, `best placement, ${best.city} ${best.year}`],
    [String(platforms), `platform${platforms === 1 ? '' : 's'}, all onsite`]
  ]);
}

function renderLiveResults() {
  return liveData.events.map((event) => [
    '            <div class="item">',
    `              <div class="title-row"><div class="title">${escapeHtml(liveTitle(event))}</div><div class="year">${event.year}</div></div>`,
    `              <div class="subtitle">${escapeHtml(event.city)}</div>`,
    '              <div class="item-meta">',
    `                <span class="tag">${escapeHtml(event.platform)}</span>`,
    `                <span class="tag is-muted">${escapeHtml(event.format)}</span>`,
    '              </div>',
    '            </div>'
  ].join('\n')).join('\n');
}

/* ── CTF hero stats, derived from the placement prefix in each title ── */

function ctfRank(result) {
  const match = /^(\d+)(?:st|nd|rd|th)\b/.exec(result.title);
  return match ? parseInt(match[1], 10) : null;
}

function renderCtfStats() {
  const ranks = ctfData.results.map(ctfRank).filter((rank) => rank !== null);
  const firsts = ranks.filter((rank) => rank === 1).length;
  const podiums = ranks.filter((rank) => rank <= 3).length;
  const since = Math.min(...ctfData.results.map((result) => result.year));
  return renderStatTiles('CTF track record', [
    [String(firsts), `first place${firsts === 1 ? '' : 's'}`],
    [String(podiums), `podium finishes, solo and team`],
    [String(since), 'competing since']
  ]);
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

/* ── Products & open source ── */

function renderProductCard(product) {
  const highlights = product.highlights.map((highlight) =>
    `              <li>${escapeHtml(highlight)}</li>`
  ).join('\n');
  const tags = product.tags.map((tag) =>
    `              <span class="tool-tag">${escapeHtml(tag)}</span>`
  ).join('\n');

  return [
    `          <a href="${escapeHtml(product.url)}" target="_blank" rel="noopener" class="product-card" data-product-name="${escapeHtml(product.name)}" data-product-url="${escapeHtml(product.url)}" data-product-tagline="${escapeHtml(product.tagline)}" aria-label="${escapeHtml(product.name)}, ${escapeHtml(product.domain)} (opens in new tab)">`,
    '            <div class="product-chrome" aria-hidden="true">',
    '              <span class="product-dots"><i></i><i></i><i></i></span>',
    `              <span class="product-domain">${escapeHtml(product.domain)}</span>`,
    `              <span class="product-status">${escapeHtml(product.status)}</span>`,
    '            </div>',
    '            <div class="product-body">',
    `              <h3 class="product-name">${escapeHtml(product.name)}</h3>`,
    `              <p class="product-tagline">${escapeHtml(product.tagline)}</p>`,
    '              <ul class="product-highlights" role="list">',
    highlights,
    '              </ul>',
    '            </div>',
    '            <div class="product-foot">',
    '              <div class="product-metric">',
    `                <span class="product-metric-value">${escapeHtml(product.metric.value)}</span>`,
    `                <span class="product-metric-label">${escapeHtml(product.metric.label)}</span>`,
    '              </div>',
    '              <span class="product-open">open</span>',
    '            </div>',
    '            <div class="tool-tags product-tags">',
    tags,
    '            </div>',
    '          </a>'
  ].join('\n');
}

function renderProductsHome() {
  return projectsData.products.map(renderProductCard).join('\n\n');
}

function renderOpenSourceCard(project) {
  const tags = project.tags.map((tag) =>
    `              <span class="tool-tag">${escapeHtml(tag)}</span>`
  ).join('\n');

  return [
    `          <a href="${escapeHtml(project.url)}" target="_blank" rel="noopener" class="tool-card" aria-label="${escapeHtml(project.name)} on GitHub (opens in new tab)">`,
    '            <div class="tool-header">',
    `              <span class="tool-name">${escapeHtml(project.name)}</span>`,
    `              <span class="tool-badge" data-star-repo="${escapeHtml(project.repo)}">${escapeHtml(project.starsLabel)}</span>`,
    '            </div>',
    `            <p class="tool-desc">${escapeHtml(project.description)}</p>`,
    '            <div class="tool-tags">',
    tags,
    '            </div>',
    '          </a>'
  ].join('\n');
}

function renderOpenSourceHome() {
  return projectsData.openSource.map(renderOpenSourceCard).join('\n\n');
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
    CTF_STATS: renderCtfStats(),
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
    LIVE_HOME_FEATURED: renderLiveHomeFeatured(),
    PRODUCTS_HOME: renderProductsHome(),
    OSS_HOME: renderOpenSourceHome()
  }
};

const changedPages = [];
for (const [page, sections] of Object.entries(pageSections)) {
  if (await updateSections(page, sections)) changedPages.push(page);
}

await updateSitemap(changedPages);

console.log(checkOnly ? 'Data-driven content is up to date.' : 'Rendered data-driven content.');
