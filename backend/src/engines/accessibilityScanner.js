const { AxeBuilder } = require('@axe-core/playwright');

/**
 * Accessibility Scanner
 *
 * Reuses the page already loaded by Console Error Scanner — no extra
 * navigation. Runs the full Axe Core ruleset and maps violations to our
 * standard PASS/WARN/FAIL shape based on severity:
 *   - any 'critical' or 'serious' violation  -> FAIL
 *   - only 'moderate'/'minor' violations     -> WARN
 *   - no violations                          -> PASS
 */
async function run(page) {
  const results = await new AxeBuilder({ page }).analyze();

  const violations = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact, // 'critical' | 'serious' | 'moderate' | 'minor'
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    affectedElements: v.nodes.length,
    // Keep a couple of example selectors, not every single one — full
    // node list can be huge on content-heavy pages and isn't needed
    // to act on the violation.
    examples: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }));

  const hasCritical = violations.some((v) => v.impact === 'critical' || v.impact === 'serious');
  const status = violations.length === 0 ? 'PASS' : hasCritical ? 'FAIL' : 'WARN';

  return {
    module: 'Accessibility Scanner',
    status,
    details: violations.length
      ? violations
      : ['No accessibility violations detected'],
    summary: {
      total: violations.length,
      critical: violations.filter((v) => v.impact === 'critical').length,
      serious: violations.filter((v) => v.impact === 'serious').length,
      moderate: violations.filter((v) => v.impact === 'moderate').length,
      minor: violations.filter((v) => v.impact === 'minor').length,
    },
  };
}

module.exports = { run };