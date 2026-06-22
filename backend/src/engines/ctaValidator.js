/**
 * CTA Validator
 *
 * Checks every element matching config.ctaSelectors (e.g. "Get Started",
 * "Sign Up" patterns) for visibility, enabled state, and — if it's a
 * link — a working destination. Reuses the same lightweight HEAD/GET
 * check Broken Link Scanner uses, no full navigation needed.
 *
 * Note: selectors that match zero elements are not failures — they're
 * just candidate patterns that don't apply to this particular page.
 */
async function run(page, baseUrl, ctaSelectors) {
  const details = [];
  let status = 'PASS';
  let totalFound = 0;
  const requestContext = page.context().request;

  for (const selector of ctaSelectors) {
    let locator;
    try {
      locator = page.locator(selector);
    } catch (err) {
      details.push({ selector, issue: `Invalid selector: ${err.message}` });
      status = 'FAIL';
      continue;
    }

    const count = await locator.count();
    if (count === 0) continue;
    totalFound += count;

    for (let i = 0; i < count; i++) {
      const el = locator.nth(i);
      const text = ((await el.textContent().catch(() => '')) || '').trim().slice(0, 50);
      const visible = await el.isVisible().catch(() => false);

      if (!visible) {
        details.push({ selector, text, issue: 'Not visible' });
        status = 'FAIL';
        continue;
      }

      const enabled = await el.isEnabled().catch(() => false);
      if (!enabled) {
        details.push({ selector, text, issue: 'Disabled' });
        status = 'FAIL';
        continue;
      }

      const href = await el.getAttribute('href').catch(() => null);
      if (href === null) {
        // Likely a JS-driven button, not a link — visibility/enabled is
        // all we can verify without more config about what it should do.
        continue;
      }

      if (!href || href === '#') {
        details.push({ selector, text, issue: 'Dead link (empty or "#")' });
        status = 'FAIL';
        continue;
      }

      let absolute;
      try {
        absolute = new URL(href, baseUrl).toString();
      } catch {
        details.push({ selector, text, issue: `Malformed href: ${href}` });
        status = 'FAIL';
        continue;
      }

      try {
        let response = await requestContext.head(absolute, { timeout: 15000 }).catch(() => null);
        if (!response || response.status() === 405) {
          response = await requestContext.get(absolute, { timeout: 15000 });
        }
        if (response.status() >= 400) {
          details.push({ selector, text, href: absolute, issue: `HTTP ${response.status()}` });
          status = 'FAIL';
        }
      } catch (err) {
        details.push({ selector, text, href: absolute, issue: err.message });
        status = 'FAIL';
      }
    }
  }

  if (totalFound === 0) {
    return {
      module: 'CTA Validator',
      status: 'WARN',
      details: ['No elements matched configured ctaSelectors — adjust config.ctaSelectors, or this page genuinely has none'],
    };
  }

  return {
    module: 'CTA Validator',
    status,
    details: details.length ? details : [`All ${totalFound} CTA element(s) checked OK`],
    totalFound,
  };
}

module.exports = { run };