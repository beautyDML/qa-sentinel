/**
 * Console Error Scanner
 *
 * This engine owns the page navigation, since console/network listeners
 * must be attached BEFORE the page loads to catch errors during load.
 * SEO Validator and Broken Link Scanner reuse this same loaded page
 * afterward, so the site is only visited once per browser.
 *
 * Severity rules:
 *   - console.error, uncaught exceptions, navigation failure -> FAIL
 *     (something on the page is genuinely broken)
 *   - same-origin HTTP errors / failed requests -> FAIL
 *     (the site's own resources are failing)
 *   - third-party HTTP errors / failed requests -> WARN
 *     (ad/analytics/CDN noise, extremely common, invisible to visitors)
 *   - net::ERR_ABORTED specifically -> ignored entirely
 *     (this is very often the browser itself cancelling a request, e.g.
 *     a video preload deprioritized once the page finishes loading, or
 *     a request superseded by navigation — not a real broken resource.
 *     Treating it as a failure produces noisy false positives on almost
 *     any page with background video/audio or prefetching.)
 */
async function run(page, url) {
  const errors = [];
  const sameOriginNetworkIssues = [];
  const thirdPartyNetworkIssues = [];

  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    origin = null;
  }

  const isSameOrigin = (resourceUrl) => {
    if (!origin) return true; // can't tell — treat as same-origin to be safe
    try {
      return new URL(resourceUrl).origin === origin;
    } catch {
      return true;
    }
  };

  const onConsole = (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() });
    }
  };
  const onPageError = (err) => {
    errors.push({ type: 'uncaught exception', text: err.message });
  };
  const onRequestFailed = (request) => {
    const failure = request.failure();
    const reason = failure ? failure.errorText : 'unknown';

    // Browser-initiated cancellation, not a real failure — see file header.
    if (reason === 'net::ERR_ABORTED') return;

    const issue = { type: 'request failed', url: request.url(), reason };
    (isSameOrigin(request.url()) ? sameOriginNetworkIssues : thirdPartyNetworkIssues).push(issue);
  };
  const onResponse = (response) => {
    const status = response.status();
    if (status >= 400) {
      const issue = { type: 'http error', url: response.url(), status };
      (isSameOrigin(response.url()) ? sameOriginNetworkIssues : thirdPartyNetworkIssues).push(issue);
    }
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);

  let navigationError = null;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    // Brief window for async errors that fire just after load completes
    await page.waitForTimeout(1000);
  } catch (err) {
    navigationError = err.message;
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onRequestFailed);
    page.off('response', onResponse);
  }

  const failDetails = [];
  if (navigationError) failDetails.push({ type: 'navigation failed', text: navigationError });
  failDetails.push(...errors, ...sameOriginNetworkIssues);

  const warnDetails = [...thirdPartyNetworkIssues];

  let status = 'PASS';
  if (failDetails.length > 0) status = 'FAIL';
  else if (warnDetails.length > 0) status = 'WARN';

  // Tagged so the report can (eventually) render severity per item instead
  // of one flat list — for now this just keeps the data honest even if
  // the current report template doesn't visually distinguish them yet.
  const details = [
    ...failDetails.map((d) => ({ ...d, severity: 'fail' })),
    ...warnDetails.map((d) => ({ ...d, severity: 'warn' })),
  ];

  return {
    module: 'Console Error Scanner',
    status,
    details: details.length
      ? details
      : ['No console errors or failed requests detected'],
  };
}

module.exports = { run };