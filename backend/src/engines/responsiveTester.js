/**
 * Responsive Tester
 *
 * Resizes the already-loaded page to each viewport preset and checks for
 * common responsive bugs. Reuses the existing page — no new navigation.
 *
 * Honest limitation: distinguishing "intentionally hidden on this size"
 * from "accidentally broken" isn't fully solvable without knowing the
 * site's intended design. This flags candidates (WARN), not guaranteed
 * bugs — screenshots from Visual Regression (Phase 7) are the better
 * tool for actually judging intent.
 */
async function run(page, viewports) {
  const details = [];
  let status = 'PASS';
  const originalViewport = page.viewportSize();

  for (const [name, size] of Object.entries(viewports)) {
    await page.setViewportSize(size);
    await page.waitForTimeout(200); // let layout settle

    const hasOverflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1; // +1px tolerance for rounding
    });
    if (hasOverflow) {
      details.push({ viewport: name, size, issue: 'Horizontal overflow detected (page scrolls sideways)' });
      status = 'FAIL';
    }

    const overlaps = await checkInteractiveOverlaps(page);
    if (overlaps.length > 0) {
      details.push({
        viewport: name,
        size,
        issue: `${overlaps.length} interactive element overlap(s) detected`,
        examples: overlaps.slice(0, 3),
      });
      status = status === 'FAIL' ? 'FAIL' : 'WARN';
    }

    const hiddenWithContentCount = await checkHiddenContent(page);
    if (hiddenWithContentCount > 0) {
      details.push({
        viewport: name,
        size,
        issue: `${hiddenWithContentCount} element(s) hidden but contain text (may be intentional responsive behavior)`,
      });
      if (status === 'PASS') status = 'WARN';
    }
  }

  if (originalViewport) await page.setViewportSize(originalViewport);

  return {
    module: 'Responsive Tester',
    status,
    details: details.length ? details : [`All ${Object.keys(viewports).length} viewports checked OK`],
  };
}

async function checkInteractiveOverlaps(page) {
  return page.evaluate(() => {
    const interactive = Array.from(document.querySelectorAll('button, a, input, select, textarea')).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    });

    const overlaps = [];
    for (let i = 0; i < interactive.length; i++) {
      for (let j = i + 1; j < interactive.length; j++) {
        const a = interactive[i];
        const b = interactive[j];
        if (a.contains(b) || b.contains(a)) continue; // nested elements (icon inside button) are fine

        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const overlapArea =
          Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)) *
          Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));

        if (overlapArea > 0) {
          overlaps.push({
            a: a.tagName + ':' + (a.textContent || '').trim().slice(0, 20),
            b: b.tagName + ':' + (b.textContent || '').trim().slice(0, 20),
          });
        }
        if (overlaps.length >= 10) return overlaps; // cap to avoid huge payloads
      }
    }
    return overlaps;
  });
}

async function checkHiddenContent(page) {
  return page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('body *'));
    let count = 0;
    for (const el of all) {
      if (el.children.length > 0) continue; // only count leaf-ish nodes, avoid counting wrapper ancestors too
      const style = getComputedStyle(el);
      const text = (el.textContent || '').trim();
      if ((style.display === 'none' || style.visibility === 'hidden') && text.length > 20) {
        count++;
      }
    }
    return count;
  });
}

module.exports = { run };