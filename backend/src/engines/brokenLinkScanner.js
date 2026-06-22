const { runPool, isSameOrigin } = require('../core/concurrency');

/**
 * Broken Link Scanner
 *
 * Assumes the page is already loaded. Extracts every <a href>, then
 * checks each link's status via the browser context's request API
 * (HEAD, falling back to GET) instead of fully navigating to each one.
 *
 * Checks run with bounded concurrency (default 6 at a time) with
 * progress logging, instead of one-by-one.
 *
 * Severity split: a same-origin link returning 4xx/5xx is a real broken
 * link on your own site -> FAIL. A third-party link returning an error
 * is downgraded to WARN, because plenty of platforms (Facebook,
 * LinkedIn, Instagram, Cloudflare-injected resources, etc.) reject
 * plain scripted HTTP requests with 400/403/999-style codes even though
 * the link works completely fine for a real person clicking it in a
 * browser. Treating those identically to a real broken link produces
 * false positives on almost any page that links out to social platforms.
 */

const DEFAULT_CONCURRENCY = 6;
const REQUEST_TIMEOUT_MS = 10000;

async function checkLink(requestContext, link, origin) {
  try {
    let response = await requestContext.head(link, { timeout: REQUEST_TIMEOUT_MS }).catch(() => null);
    if (!response || response.status() === 405) {
      // Some servers reject HEAD; fall back to GET
      response = await requestContext.get(link, { timeout: REQUEST_TIMEOUT_MS });
    }
    const code = response.status();
    if (code < 400) return null;
    return {
      url: link,
      status: code,
      severity: isSameOrigin(link, origin) ? 'fail' : 'warn',
    };
  } catch (err) {
    return {
      url: link,
      status: 'ERROR',
      error: err.message,
      severity: isSameOrigin(link, origin) ? 'fail' : 'warn',
    };
  }
}

async function run(page, baseUrl) {
  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href'))
  );

  let origin;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    origin = null;
  }

  const seen = new Set();
  const links = [];
  for (const href of hrefs) {
    if (!href) continue;
    if (
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:')
    ) {
      continue;
    }
    let absolute;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      continue; // genuinely malformed href, worth flagging separately later
    }
    if (seen.has(absolute)) continue;
    seen.add(absolute);
    links.push(absolute);
  }

  const requestContext = page.context().request;

  const checkResults = await runPool(
    links,
    DEFAULT_CONCURRENCY,
    (link) => checkLink(requestContext, link, origin),
    { label: 'Broken Link Scanner' }
  );

  const allIssues = checkResults.filter(Boolean);
  const failIssues = allIssues.filter((i) => i.severity === 'fail');
  const warnIssues = allIssues.filter((i) => i.severity === 'warn');

  let status = 'PASS';
  if (failIssues.length > 0) status = 'FAIL';
  else if (warnIssues.length > 0) status = 'WARN';

  return {
    module: 'Broken Link Scanner',
    status,
    details: allIssues.length ? allIssues : [`All ${links.length} links checked OK`],
    totalLinksChecked: links.length,
  };
}

module.exports = { run };