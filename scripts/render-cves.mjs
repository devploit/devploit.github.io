import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const data = JSON.parse(await readFile(path.join(root, 'assets/data/cves.json'), 'utf8'));
const recordsById = new Map(data.records.map((record) => [record.id, record]));

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
    if (output !== source) throw new Error(`${relativePath} is out of sync with assets/data/cves.json`);
    return;
  }

  await writeFile(filePath, output);
}

await updateSections('cves.html', {
  CVE_STATS: renderStats(),
  CVE_KEY_FINDINGS: renderKeyFindings(),
  CVE_RECORDS_META: renderRecordsMeta(),
  CVE_RECORDS: renderRecords()
});

await updateSections('index.html', {
  CVE_HOME_KICKER: renderHomeKicker(),
  CVE_HOME_FEATURED: renderHomeFeatured()
});

console.log(checkOnly ? 'CVE-generated content is up to date.' : 'Rendered CVE-generated content.');
