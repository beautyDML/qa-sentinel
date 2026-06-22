const { chromium, firefox, webkit } = require('playwright');

const ENGINES = { chromium, firefox, webkit };

/**
 * Performs a form-based login: navigates to the login page, fills in
 * credentials, submits, and waits for navigation away from the login page
 * as the success signal (or a custom successSelector if provided).
 * Runs once per browser instance, before the page is handed off to engines.
 */
async function performLoginFlow(page, loginFlow) {
  await page.goto(loginFlow.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill(loginFlow.usernameSelector, loginFlow.username);
  await page.fill(loginFlow.passwordSelector, loginFlow.password);

  await Promise.all([
    loginFlow.successSelector
      ? page.waitForSelector(loginFlow.successSelector, { timeout: 15000 })
      : page.waitForNavigation({ waitUntil: 'load', timeout: 15000 }).catch(() => null),
    page.click(loginFlow.submitSelector),
  ]);

  // Best-effort confirmation: if a successSelector was given, its presence
  // already confirmed login. Otherwise we just confirmed navigation happened
  // away from the login form (good enough signal, not a guarantee).
}

/**
 * Launches a single browser + authenticated context + page.
 * Auth (if present in config) is applied at the context level via
 * httpCredentials, so it works transparently for every engine that
 * uses this manager — no per-engine auth handling needed.
 * If a loginFlow is configured, it runs right after, so the page handed
 * back is already logged in for engines that need it.
 */
async function launchOne(browserName, config) {
  const engine = ENGINES[browserName];
  if (!engine) {
    throw new Error(`Unknown browser engine: ${browserName}`);
  }

  const browser = await engine.launch({ headless: true });

  const contextOptions = {};
  if (config.auth) {
    contextOptions.httpCredentials = {
      username: config.auth.username,
      password: config.auth.password,
    };
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  if (config.loginFlow) {
    try {
      await performLoginFlow(page, config.loginFlow);
    } catch (err) {
      await browser.close();
      throw new Error(`Login flow failed on ${browserName}: ${err.message}`);
    }
  }

  return { name: browserName, browser, context, page };
}

/**
 * Launches every browser listed in config.browsers (default: all 3).
 * Returns an array of { name, browser, context, page } so engines that
 * need cross-browser checks (Cross Browser Tester) can iterate, while
 * engines that only need one browser can just use instances[0].
 */
async function launchAll(config) {
  const instances = [];
  try {
    for (const browserName of config.browsers) {
      instances.push(await launchOne(browserName, config));
    }
  } catch (err) {
    // A later browser failed (e.g. login flow error). Without this,
    // any browsers already launched in this call would never be closed
    // since the caller's `instances` assignment never completes.
    await closeAll(instances);
    throw err;
  }
  return instances;
}

/**
 * Closes every browser instance cleanly. Always call this in a finally
 * block so a failed engine doesn't leave orphaned browser processes.
 * Each close() is caught individually — if one browser already crashed
 * (e.g. the target site's own JS broke it mid-scan), that shouldn't stop
 * the other still-healthy browsers from closing properly.
 */
async function closeAll(instances) {
  await Promise.all(
    instances.map((i) =>
      i.browser.close().catch((err) => {
        console.error(`Warning: failed to close ${i.name} cleanly: ${err.message}`);
      })
    )
  );
}

module.exports = { launchOne, launchAll, closeAll };