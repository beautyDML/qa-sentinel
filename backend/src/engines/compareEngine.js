const fs = require('fs');
const { badge, wrapPage, escapeHtml } = require('../reports/htmlUtils');

/**
 * Compares two results.json files (from two different scan runs) and
 * classifies what changed per browser, per module:
 *   FIX VERIFIED   - was FAIL in run1, now PASS in run2
 *   STILL FAILING  - was FAIL in both
 *   NEW REGRESSION - was PASS in run1, now FAIL in run2 (the important one)
 *   UNCHANGED      - same status both times (summarized as a count only)
 */
function compare(run1, run2) {
  const changes = [];
  let unchangedCount = 0;

  const browserNames = new Set([
    ...run1.browserResults.map((b) => b.browser),
    ...run2.browserResults.map((b) => b.browser),
  ]);

  for (const browserName of browserNames) {
    const b1 = run1.browserResults.find((b) => b.browser === browserName);
    const b2 = run2.browserResults.find((b) => b.browser === browserName);

    if (!b1 || !b2) {
      changes.push({
        browser: browserName,
        module: '(all)',
        verdict: 'SKIPPED',
        note: `Browser "${browserName}" was not scanned in both runs`,
      });
      continue;
    }

    const moduleNames = new Set([...b1.modules.map((m) => m.module), ...b2.modules.map((m) => m.module)]);

    for (const moduleName of moduleNames) {
      const m1 = b1.modules.find((m) => m.module === moduleName);
      const m2 = b2.modules.find((m) => m.module === moduleName);

      if (!m1 || !m2) {
        changes.push({ browser: browserName, module: moduleName, verdict: 'SKIPPED', note: 'Module missing from one run' });
        continue;
      }

      const verdict = classify(m1.status, m2.status);
      if (verdict === 'UNCHANGED') {
        unchangedCount++;
      } else {
        changes.push({ browser: browserName, module: moduleName, verdict, from: m1.status, to: m2.status });
      }
    }
  }

  const regressions = changes.filter((c) => c.verdict === 'NEW REGRESSION');
  const fixed = changes.filter((c) => c.verdict === 'FIX VERIFIED');
  const stillFailing = changes.filter((c) => c.verdict === 'STILL FAILING');

  return {
    run1: { url: run1.url, timestamp: run1.timestamp },
    run2: { url: run2.url, timestamp: run2.timestamp },
    changes,
    unchangedCount,
    summary: { regressions: regressions.length, fixed: fixed.length, stillFailing: stillFailing.length },
  };
}

function classify(status1, status2) {
  const isBad = (s) => s === 'FAIL';
  if (isBad(status1) && !isBad(status2)) return 'FIX VERIFIED';
  if (isBad(status1) && isBad(status2)) return 'STILL FAILING';
  if (!isBad(status1) && isBad(status2)) return 'NEW REGRESSION';
  return 'UNCHANGED';
}

function printConsole(result) {
  console.log(`\nComparing:`);
  console.log(`  Run 1: ${result.run1.timestamp}`);
  console.log(`  Run 2: ${result.run2.timestamp}\n`);

  if (result.summary.regressions > 0) {
    console.log(`⚠ ${result.summary.regressions} NEW REGRESSION(S):`);
    result.changes.filter((c) => c.verdict === 'NEW REGRESSION').forEach((c) => {
      console.log(`  [${c.browser}] ${c.module}: ${c.from} -> ${c.to}`);
    });
    console.log('');
  }

  if (result.summary.fixed > 0) {
    console.log(`✓ ${result.summary.fixed} FIX VERIFIED:`);
    result.changes.filter((c) => c.verdict === 'FIX VERIFIED').forEach((c) => {
      console.log(`  [${c.browser}] ${c.module}: ${c.from} -> ${c.to}`);
    });
    console.log('');
  }

  if (result.summary.stillFailing > 0) {
    console.log(`✗ ${result.summary.stillFailing} STILL FAILING:`);
    result.changes.filter((c) => c.verdict === 'STILL FAILING').forEach((c) => {
      console.log(`  [${c.browser}] ${c.module}`);
    });
    console.log('');
  }

  console.log(`${result.unchangedCount} check(s) unchanged.`);
}

function generateHtml(result) {
  const rows = result.changes
    .filter((c) => c.verdict !== 'SKIPPED')
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.browser)}</td><td>${escapeHtml(c.module)}</td><td>${badge(c.from)} &rarr; ${badge(
          c.to
        )}</td><td>${badge(c.verdict)}</td></tr>`
    )
    .join('');

  const body = `
<h1>Comparison Report</h1>
<div class="meta">Run 1: ${escapeHtml(result.run1.timestamp)} &middot; Run 2: ${escapeHtml(result.run2.timestamp)}</div>
<div class="summary-bar">
  <div class="summary-stat"><b style="color:#cf222e">${result.summary.regressions}</b>new regressions</div>
  <div class="summary-stat"><b style="color:#1a7f37">${result.summary.fixed}</b>fix verified</div>
  <div class="summary-stat"><b style="color:#9a6700">${result.summary.stillFailing}</b>still failing</div>
  <div class="summary-stat"><b>${result.unchangedCount}</b>unchanged</div>
</div>
<table style="width:100%;border-collapse:collapse">
  <thead><tr style="text-align:left;border-bottom:2px solid #eee">
    <th style="padding:8px 0">Browser</th><th>Module</th><th>Status change</th><th>Verdict</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`;

  return wrapPage('QA Comparison Report', body);
}

module.exports = { compare, printConsole, generateHtml };