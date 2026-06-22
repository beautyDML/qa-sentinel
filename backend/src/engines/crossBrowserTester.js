/**
 * Cross Browser Tester
 *
 * Not a new check — a comparison layer over results every other engine
 * already produced per browser. Runs once, after the per-browser loop
 * finishes, and flags modules where status differs across browsers
 * (e.g. PASS on Chromium + Firefox, FAIL on WebKit). These mismatches
 * are the genuinely interesting bugs — browser-specific issues, not
 * "broken everywhere" issues.
 */
function run(browserResults) {
  if (browserResults.length < 2) {
    return {
      module: 'Cross Browser Tester',
      status: 'WARN',
      details: ['Only one browser was scanned — nothing to compare. Add more browsers to config.browsers to enable this check.'],
    };
  }

  const moduleNames = browserResults[0].modules.map((m) => m.module);
  const details = [];
  let status = 'PASS';

  for (const moduleName of moduleNames) {
    const statusesByBrowser = browserResults.map((br) => {
      const found = br.modules.find((m) => m.module === moduleName);
      return { browser: br.browser, status: found ? found.status : 'MISSING' };
    });

    const uniqueStatuses = new Set(statusesByBrowser.map((s) => s.status));
    if (uniqueStatuses.size > 1) {
      details.push({ module: moduleName, results: statusesByBrowser });
      status = 'FAIL';
    }
  }

  return {
    module: 'Cross Browser Tester',
    status,
    details: details.length ? details : ['All modules report consistent status across every browser tested'],
  };
}

module.exports = { run };