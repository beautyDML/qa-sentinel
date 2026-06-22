const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default;

/**
 * Visual Regression Engine
 *
 * Full-page screenshots (catches below-the-fold bugs, not just what's
 * visible without scrolling). One baseline PER BROWSER — Chromium,
 * Firefox, and WebKit render fonts/anti-aliasing slightly differently
 * even on an identical page, so comparing across browsers would produce
 * constant false failures.
 *
 * Baselines live outside the timestamped per-run output folders, since
 * they need to persist across runs. Diff images (only created on FAIL)
 * are saved into the current run's output folder, since those are
 * specific to that one comparison.
 *
 * Height tolerance: full-page screenshots on real sites routinely vary
 * by a few pixels between runs even with zero actual content change —
 * an ad slot loads a fraction slower, a video poster image swaps in,
 * a font finishes loading and reflows by a pixel. Hard-failing on ANY
 * dimension mismatch (even 1px) turns this into noise. Instead, small
 * height differences (within HEIGHT_TOLERANCE_RATIO of the taller
 * screenshot, or HEIGHT_TOLERANCE_PX, whichever is larger) are absorbed
 * by cropping both screenshots to their shared height before diffing,
 * rather than auto-failing. Width must still match exactly — that only
 * changes with a genuine viewport/config change, never noise.
 */

const HEIGHT_TOLERANCE_RATIO = 0.005; // 0.5% of the taller screenshot's height
const HEIGHT_TOLERANCE_PX = 15; // floor, so short pages still get a usable tolerance

async function run(page, browserName, { threshold = 0.02, updateBaseline = false, baselineDir, runOutputDir }) {
  fs.mkdirSync(baselineDir, { recursive: true });
  const baselinePath = path.join(baselineDir, `${browserName}.png`);

  const screenshotBuffer = await page.screenshot({ fullPage: true });

  if (updateBaseline) {
    fs.writeFileSync(baselinePath, screenshotBuffer);
    return {
      module: 'Visual Regression Engine',
      status: 'PASS',
      details: ['Baseline updated with current screenshot (--update-baseline was set)'],
    };
  }

  if (!fs.existsSync(baselinePath)) {
    fs.writeFileSync(baselinePath, screenshotBuffer);
    return {
      module: 'Visual Regression Engine',
      status: 'PASS',
      details: [`No baseline existed for ${browserName} — created one from this run. Future runs will compare against it.`],
    };
  }

  let baselinePNG = PNG.sync.read(fs.readFileSync(baselinePath));
  let currentPNG = PNG.sync.read(screenshotBuffer);

  const notes = [];

  if (baselinePNG.width !== currentPNG.width) {
    // Width only changes on a real viewport/config change — never noise.
    return {
      module: 'Visual Regression Engine',
      status: 'FAIL',
      details: [
        `Screenshot width changed: baseline was ${baselinePNG.width}px wide, current is ${currentPNG.width}px wide. ` +
          'This only happens from a viewport/config change, not normal page variance. ' +
          'If intentional, re-run with --update-baseline.',
      ],
    };
  }

  if (baselinePNG.height !== currentPNG.height) {
    const tallerHeight = Math.max(baselinePNG.height, currentPNG.height);
    const heightDiff = Math.abs(baselinePNG.height - currentPNG.height);
    const tolerance = Math.max(HEIGHT_TOLERANCE_PX, tallerHeight * HEIGHT_TOLERANCE_RATIO);

    if (heightDiff > tolerance) {
      return {
        module: 'Visual Regression Engine',
        status: 'FAIL',
        details: [
          `Screenshot height changed beyond tolerance: baseline was ${baselinePNG.height}px tall, ` +
            `current is ${currentPNG.height}px tall (${heightDiff}px difference, tolerance was ` +
            `${Math.round(tolerance)}px). Usually means content was added/removed. If intentional, ` +
            're-run with --update-baseline.',
        ],
      };
    }

    // Within tolerance — crop both to the shared height and diff that
    // region instead of failing outright. The few extra pixels off the
    // bottom of the taller one are very likely a half-loaded element,
    // not meaningful page content.
    const sharedHeight = Math.min(baselinePNG.height, currentPNG.height);
    baselinePNG = cropToHeight(baselinePNG, sharedHeight);
    currentPNG = cropToHeight(currentPNG, sharedHeight);
    notes.push(
      `Heights differed by ${heightDiff}px (within ${Math.round(tolerance)}px tolerance) — compared the shared ${sharedHeight}px region.`
    );
  }

  const { width, height } = currentPNG;
  const diffPNG = new PNG({ width, height });
  const diffPixelCount = pixelmatch(baselinePNG.data, currentPNG.data, diffPNG.data, width, height, {
    threshold: 0.1, // pixelmatch's own per-pixel sensitivity, not our pass/fail threshold
  });

  const totalPixels = width * height;
  const diffRatio = diffPixelCount / totalPixels;
  const passed = diffRatio <= threshold;

  const details = [
    ...notes,
    `${(diffRatio * 100).toFixed(2)}% of pixels changed (threshold: ${(threshold * 100).toFixed(2)}%)`,
  ];

  let diffImagePath = null;
  if (!passed) {
    const diffDir = path.join(runOutputDir, 'screenshots');
    fs.mkdirSync(diffDir, { recursive: true });
    diffImagePath = path.join(diffDir, `${browserName}-diff.png`);
    fs.writeFileSync(diffImagePath, PNG.sync.write(diffPNG));
    details.push(`Diff image saved: ${diffImagePath}`);
  }

  return {
    module: 'Visual Regression Engine',
    status: passed ? 'PASS' : 'FAIL',
    details,
    diffRatio,
    diffImagePath,
  };
}

function cropToHeight(png, targetHeight) {
  const cropped = new PNG({ width: png.width, height: targetHeight });
  PNG.bitblt(png, cropped, 0, 0, png.width, targetHeight, 0, 0);
  return cropped;
}

module.exports = { run };