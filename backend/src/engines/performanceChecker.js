/**
 * Performance Checker
 *
 * Opt-in (--performance flag). Runs ONCE per scan, not once per browser —
 * Lighthouse measures Chromium-based performance and needs its own Chrome
 * instance with a remote debugging port, so it can't reuse the Playwright
 * browser instances the other engines share.
 *
 * Note: both `lighthouse` and `chrome-launcher` are ESM-only packages,
 * hence the dynamic import() calls below even though this file is CJS.
 */
async function run(config) {
  const { default: lighthouse } = await import('lighthouse');
  const chromeLauncher = await import('chrome-launcher');

  if (config.loginFlow) {
    return {
      module: 'Performance Checker',
      status: 'WARN',
      details: [
        'Skipped: form-based login (loginFlow) is not yet supported here. ' +
          'Performance Checker can only measure public pages or pages behind HTTP Basic Auth.',
      ],
    };
  }

  let chrome;
  try {
    chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    });
  } catch (err) {
    return {
      module: 'Performance Checker',
      status: 'FAIL',
      details: [`Could not launch Chrome for Lighthouse: ${err.message}`],
    };
  }

  try {
    const lighthouseOptions = {
      port: chrome.port,
      output: 'json',
      onlyCategories: ['performance'],
    };

    if (config.auth) {
      const basicAuth = Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64');
      lighthouseOptions.extraHeaders = { Authorization: `Basic ${basicAuth}` };
    }

    const runnerResult = await lighthouse(config.url, lighthouseOptions);

    if (!runnerResult || !runnerResult.lhr) {
      return {
        module: 'Performance Checker',
        status: 'FAIL',
        details: ['Lighthouse returned no result (page may have failed to load)'],
      };
    }

    const lhr = runnerResult.lhr;
    const score = Math.round((lhr.categories.performance.score || 0) * 100);
    const audits = lhr.audits;

    const metrics = {
      performanceScore: score,
      lcp: audits['largest-contentful-paint']?.displayValue || 'n/a',
      cls: audits['cumulative-layout-shift']?.displayValue || 'n/a',
      fcp: audits['first-contentful-paint']?.displayValue || 'n/a',
    };

    const threshold = config.thresholds?.performanceScore ?? 50;
    const status = score >= threshold ? 'PASS' : 'FAIL';

    return {
      module: 'Performance Checker',
      status,
      details: [
        `Performance score: ${score}/100 (threshold: ${threshold})`,
        `LCP (Largest Contentful Paint): ${metrics.lcp}`,
        `CLS (Cumulative Layout Shift): ${metrics.cls}`,
        `FCP (First Contentful Paint): ${metrics.fcp}`,
      ],
      raw: metrics,
    };
  } finally {
    await chrome.kill();
  }
}

module.exports = { run };