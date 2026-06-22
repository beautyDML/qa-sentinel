const { runPool, isSameOrigin } = require('../core/concurrency');

/**
 * Navigation Tester
 *
 * Extracts links from <nav>, header, and footer, then checks each one
 * with a lightweight HTTP request (page.context().request) instead of
 * opening a full browser page per link — full page loads execute all of
 * a site's JS on every check, which on JS-heavy sites can exhaust the
 * browser process after 30-50+ links and crash it mid-run.
 *
 * Checks run with bounded concurrency (default 6 at a time), with
 * progress logged periodically so long scans don't look stuck.
 *
 * Severity split: same-origin nav links failing is a real broken link
 * on your own site -> FAIL. Third-party nav links (social icons, etc.)
 * failing is downgraded to WARN, since platforms like LinkedIn return
 * deliberate anti-bot codes (its famous "HTTP 999") to scripted
 * requests that work completely fine for a real visitor clicking them.
 *
 * Known heuristic limitation: the mobile menu toggle check assumes
 * clicking the toggle directly changes the <nav> element's own
 * display/visibility. Some sites instead slide/transform a separate
 * panel without touching <nav>'s visibility — those can produce a
 * false "toggle didn't work" WARN. Not dangerous, just a blind spot
 * worth knowing about if this WARN shows up on a site you've manually
 * verified has a working mobile menu.
 */

const DEFAULT_CONCURRENCY = 6;
const REQUEST_TIMEOUT_MS = 10000;

async function run(page, baseUrl) {
  const navLinks = await page.evaluate(() => {
    const anchors = document.querySelectorAll('nav a[href], header a[href], footer a[href]');
    return Array.from(anchors).map((a) => ({
      href: a.getAttribute('href'),
      text: a.textContent.trim().slice(0, 50),
    }));
  });

  let origin;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    origin = null;
  }

  const seen = new Set();
  const links = [];
  for (const link of navLinks) {
    if (!link.href) continue;
    if (
      link.href.startsWith('#') ||
      link.href.startsWith('mailto:') ||
      link.href.startsWith('tel:') ||
      link.href.startsWith('javascript:')
    ) {
      continue;
    }
    let absolute;
    try {
      absolute = new URL(link.href, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(absolute)) continue;
    seen.add(absolute);
    links.push({ ...link, absolute });
  }

  const apiContext = page.context().request;

  const checkResults = await runPool(
    links,
    DEFAULT_CONCURRENCY,
    async (link) => {
      const severity = isSameOrigin(link.absolute, origin) ? 'fail' : 'warn';
      try {
        const response = await apiContext.get(link.absolute, {
          timeout: REQUEST_TIMEOUT_MS,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; qa-tool-link-check/1.0)' },
        });
        const code = response.status();
        return code >= 400 ? { text: link.text, href: link.absolute, issue: `HTTP ${code}`, severity } : null;
      } catch (err) {
        return { text: link.text, href: link.absolute, issue: err.message, severity };
      }
    },
    { label: 'Navigation Tester' }
  );

  const allIssues = checkResults.filter(Boolean);
  const failIssues = allIssues.filter((i) => i.severity === 'fail');
  const warnIssues = allIssues.filter((i) => i.severity === 'warn');

  let status = 'PASS';
  if (failIssues.length > 0) status = 'FAIL';
  else if (warnIssues.length > 0) status = 'WARN';

  const details = [...allIssues];

  // Best-effort mobile menu toggle check — common selector patterns only.
  // Stays on the original shared page; no extra pages opened here.
  const menuSelectors = ['[aria-label*="menu" i]', '.hamburger', '.menu-toggle', 'button[class*="menu" i]'];
  for (const selector of menuSelectors) {
    const handle = await page.$(selector).catch(() => null);
    if (!handle) continue;

    try {
      const navVisible = async () =>
        page.evaluate(() => {
          const nav = document.querySelector('nav');
          if (!nav) return null;
          const style = getComputedStyle(nav);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });

      const before = await navVisible();
      await handle.click();
      await page.waitForTimeout(300);
      const after = await navVisible();

      if (before !== null && before === after) {
        details.push({ issue: 'Mobile menu toggle click did not change nav visibility — check selector or toggle behavior (heuristic limitation: sites that slide a separate panel instead of toggling <nav> itself can trigger this even when the menu works)', severity: 'warn' });
        if (status === 'PASS') status = 'WARN';
      }
      await handle.click().catch(() => {}); // best-effort: close it back
    } catch (err) {
      details.push({ issue: `Mobile menu toggle test error: ${err.message}`, severity: 'warn' });
    }
    break; // only test the first matching toggle found
  }

  return {
    module: 'Navigation Tester',
    status,
    details: details.length ? details : [`All ${links.length} navigation links checked OK`],
    totalLinksChecked: links.length,
  };
}

module.exports = { run };