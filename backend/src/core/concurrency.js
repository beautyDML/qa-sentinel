/**
 * Shared helpers for engines that check many URLs (Broken Link Scanner,
 * Navigation Tester). Previously duplicated identically in both files —
 * extracted here so concurrency tuning or bug fixes only need to happen
 * once.
 */

/**
 * Runs `worker` over `items` with at most `concurrency` in flight at once.
 * Logs progress every `logEvery` completions so long scans don't look stuck.
 */
async function runPool(items, concurrency, worker, { label, logEvery = 10 } = {}) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;

  async function lane() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await worker(items[i]);
      completed++;
      if (label && (completed % logEvery === 0 || completed === items.length)) {
        console.log(`    ${label}: ${completed}/${items.length} checked`);
      }
    }
  }

  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, () => lane());
  await Promise.all(lanes);
  return results;
}

/**
 * True if `linkUrl` shares an origin with `origin`. Used to decide
 * whether a failing link is a real same-site bug (FAIL) or a third-party
 * link that's likely just bot-protected (WARN). Defaults to true (treat
 * as same-origin) when the comparison can't be made, so callers fail
 * safe toward the stricter severity rather than silently downgrading.
 */
function isSameOrigin(linkUrl, origin) {
  if (!origin) return true;
  try {
    return new URL(linkUrl).origin === origin;
  } catch {
    return true;
  }
}

module.exports = { runPool, isSameOrigin };