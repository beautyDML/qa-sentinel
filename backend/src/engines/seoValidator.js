/**
 * SEO Validator
 *
 * Assumes the page is already loaded (reuses the page Console Error
 * Scanner navigated to). Pure DOM inspection, no extra page loads.
 */
async function run(page) {
  const data = await page.evaluate(() => {
    const getMeta = (key) => {
      const el =
        document.querySelector(`meta[name="${key}"]`) ||
        document.querySelector(`meta[property="${key}"]`);
      return el ? el.getAttribute('content') : null;
    };

    const title = document.title || null;
    const metaDescription = getMeta('description');
    const canonical = document.querySelector('link[rel="canonical"]');
    const h1Count = document.querySelectorAll('h1').length;
    const ogTitle = getMeta('og:title');
    const ogDescription = getMeta('og:description');
    const ogImage = getMeta('og:image');
    const images = Array.from(document.querySelectorAll('img'));
    const imagesMissingAlt = images.filter(
      (img) => !img.getAttribute('alt') || img.getAttribute('alt').trim() === ''
    ).length;

    return {
      title,
      titleLength: title ? title.length : 0,
      metaDescription,
      metaDescriptionLength: metaDescription ? metaDescription.length : 0,
      canonicalHref: canonical ? canonical.getAttribute('href') : null,
      h1Count,
      ogTitle,
      ogDescription,
      ogImage,
      totalImages: images.length,
      imagesMissingAlt,
    };
  });

  const details = [];
  let status = 'PASS';

  const fail = (msg) => {
    details.push(msg);
    status = 'FAIL';
  };
  const warn = (msg) => {
    details.push(msg);
    if (status === 'PASS') status = 'WARN';
  };

  if (!data.title) fail('Missing <title> tag');
  else if (data.titleLength < 10 || data.titleLength > 60)
    warn(`Title length (${data.titleLength} chars) outside recommended 10–60`);

  if (!data.metaDescription) fail('Missing meta description');
  else if (data.metaDescriptionLength < 50 || data.metaDescriptionLength > 160)
    warn(`Meta description length (${data.metaDescriptionLength} chars) outside recommended 50–160`);

  if (!data.canonicalHref) fail('Missing canonical tag');
  if (data.h1Count === 0) fail('No H1 found on page');
  else if (data.h1Count > 1) warn(`Multiple H1 tags found (${data.h1Count})`);

  if (!data.ogTitle) warn('Missing og:title');
  if (!data.ogDescription) warn('Missing og:description');
  if (!data.ogImage) warn('Missing og:image');

  if (data.imagesMissingAlt > 0) {
    fail(`${data.imagesMissingAlt} of ${data.totalImages} images missing alt text`);
  }

  return {
    module: 'SEO Validator',
    status,
    details: details.length ? details : ['All SEO checks passed'],
    raw: data,
  };
}

module.exports = { run };