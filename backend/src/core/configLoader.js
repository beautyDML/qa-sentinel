const fs = require('fs');
const path = require('path');

/**
 * Default viewport presets used by the Responsive Tester.
 * Kept here so every engine references the same source of truth.
 */
const DEFAULT_VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  laptop: { width: 1366, height: 768 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

const DEFAULT_BROWSERS = ['chromium', 'firefox', 'webkit'];

/**
 * Loads a scan config from a JSON file path, or accepts an already-parsed
 * object (useful when config comes from CLI flags instead of a file).
 *
 * Required: url
 * Optional: auth { username, password } - HTTP Basic Auth (staging popup)
 *           loginFlow { loginUrl, usernameSelector, passwordSelector,
 *                       submitSelector, username, password, successSelector }
 *                       - form-based login (real login page with input fields)
 *           docx (path to .docx reference file),
 *           browsers (array), viewports (object), ctaSelectors (array)
 *
 * auth and loginFlow are independent and can both be set (e.g. a staging
 * server with a Basic Auth wall in front of an app that also has its own
 * login form). If neither is set, the site is treated as fully public.
 */
function loadConfig(input) {
  let raw;

  if (typeof input === 'string') {
    const resolved = path.resolve(input);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Config file not found: ${resolved}`);
    }
    raw = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  } else if (typeof input === 'object' && input !== null) {
    raw = input;
  } else {
    throw new Error('loadConfig expects a file path or a config object');
  }

  if (!raw.url) {
    throw new Error('Config is missing required field: url');
  }

  const config = {
    url: raw.url,
    auth: raw.auth && raw.auth.username ? raw.auth : null,
    loginFlow: raw.loginFlow || null,
    docx: raw.docx || null,
    browsers: raw.browsers && raw.browsers.length ? raw.browsers : DEFAULT_BROWSERS,
    viewports: raw.viewports || DEFAULT_VIEWPORTS,
    ctaSelectors: raw.ctaSelectors || ['text=/get started/i', 'text=/sign up/i', 'text=/contact/i', 'text=/buy now/i'],
    thresholds: {
      contentMatch: 0.8, // fuzzy match similarity cutoff (0-1)
      visualDiff: 0.02,  // max allowed % of changed pixels before FAIL
      performanceScore: 50, // Lighthouse score below this = FAIL
      ...raw.thresholds,
    },
  };

  validateConfig(config);
  return config;
}

function validateConfig(config) {
  try {
    new URL(config.url);
  } catch {
    throw new Error(`Invalid URL in config: ${config.url}`);
  }

  const validBrowsers = ['chromium', 'firefox', 'webkit'];
  for (const b of config.browsers) {
    if (!validBrowsers.includes(b)) {
      throw new Error(`Unknown browser "${b}". Must be one of: ${validBrowsers.join(', ')}`);
    }
  }

  if (config.docx && !fs.existsSync(path.resolve(config.docx))) {
    throw new Error(`docx reference file not found: ${config.docx}`);
  }

  if (config.auth && (!config.auth.username || !config.auth.password)) {
    throw new Error('auth must include both username and password');
  }

  if (config.loginFlow) {
    const required = ['loginUrl', 'usernameSelector', 'passwordSelector', 'submitSelector', 'username', 'password'];
    const missing = required.filter((field) => !config.loginFlow[field]);
    if (missing.length) {
      throw new Error(`loginFlow is missing required field(s): ${missing.join(', ')}`);
    }
    try {
      new URL(config.loginFlow.loginUrl);
    } catch {
      throw new Error(`Invalid loginFlow.loginUrl: ${config.loginFlow.loginUrl}`);
    }
  }
}

module.exports = { loadConfig, DEFAULT_VIEWPORTS, DEFAULT_BROWSERS };