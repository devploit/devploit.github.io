import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Reuse Playwright from the test environment without adding a site dependency.
const { chromium } = await import(process.env.SITE_PLAYWRIGHT_MODULE || 'playwright');
const baseUrl = process.env.SITE_BASE_URL || 'http://127.0.0.1:8765';
const posts = JSON.parse(await readFile(new URL('../assets/data/posts.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const feedUrl = 'https://blog.devploit.dev/feed.xml';
const updatedUrl = 'https://blog.devploit.dev/posts/updated-research-note/';
const feed = `<feed xmlns="http://www.w3.org/2005/Atom"><entry>
  <title>Updated research note</title><link href="${updatedUrl}" rel="alternate"/>
  <published>2026-09-01T12:00:00Z</published><category term="Security Research"/>
</entry></feed>`;

async function checkHomepage({ javaScriptEnabled, width, feedResponse, reducedMotion = 'no-preference' }) {
  const page = await browser.newPage({
    javaScriptEnabled, viewport: { width, height: 900 }, reducedMotion
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://api.github.com/**', (route) => route.fulfill({ json: { stargazers_count: 1234 } }));
  await page.route(feedUrl, (route) => feedResponse === null
    ? route.abort()
    : route.fulfill({ contentType: 'application/atom+xml', body: feedResponse }));
  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const state = await page.evaluate(() => ({
      hiddenSections: [...document.querySelectorAll('.reveal')].filter((element) => {
        const style = getComputedStyle(element);
        return style.opacity === '0' || style.visibility === 'hidden' || style.display === 'none';
      }).length,
      posts: [...document.querySelectorAll('#posts-container .post-item')].map((element) => element.href),
      status: document.getElementById('posts-status').textContent,
      schemas: [...document.querySelectorAll('script[type="application/ld+json"]')].map((element) => JSON.parse(element.textContent)),
      overflow: document.documentElement.scrollWidth > window.innerWidth
    }));
    assert.equal(state.hiddenSections, 0, 'Content must remain visible without scripts or scrolling');
    assert.equal(state.overflow, false, 'Content must fit the viewport');
    const refreshed = javaScriptEnabled && feedResponse === feed;
    assert.deepEqual(state.posts, refreshed ? [updatedUrl] : posts.map((post) => post.url));
    assert.equal(state.status, refreshed ? 'live from blog' : 'featured posts');
    assert.equal(state.schemas.length, 1, 'The profile must not be duplicated at runtime');
    assert.equal(state.schemas[0]['@type'], 'ProfilePage');
    assert.equal(state.schemas[0].mainEntity['@type'], 'Person');
    assert.deepEqual(errors, [], 'The homepage must not throw script errors');
    console.log(`Homepage passed: JS=${javaScriptEnabled}, width=${width}, feed=${refreshed ? 'live' : 'fallback'}`);
  } finally {
    await page.close();
  }
}

try {
  for (const width of [390, 1440]) {
    await checkHomepage({ javaScriptEnabled: false, width, feedResponse: null });
    await checkHomepage({ javaScriptEnabled: true, width, feedResponse: null });
  }
  await checkHomepage({ javaScriptEnabled: true, width: 390, feedResponse: feed });
  await checkHomepage({ javaScriptEnabled: true, width: 390, feedResponse: null, reducedMotion: 'reduce' });
  await checkHomepage({ javaScriptEnabled: true, width: 390, feedResponse: '<feed>invalid XML' });
  await checkHomepage({ javaScriptEnabled: true, width: 390, feedResponse: feed.replace(updatedUrl, 'https://example.com/unrelated') });

  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  for (const path of ['/ctf.html', '/cves.html', '/livehackingevents.html']) {
    await page.goto(new URL(path, baseUrl).href);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    assert.equal(canonical, `https://devploit.dev${path}`);
    assert.equal(await page.locator('a[href^="/index.html"]').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  }
  await page.close();
  console.log('Inner page canonical links and mobile layouts passed.');
} finally {
  await browser.close();
}
