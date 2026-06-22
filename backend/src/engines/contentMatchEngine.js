const fs = require('fs');
const mammoth = require('mammoth');
const stringSimilarity = require('string-similarity');

/**
 * Content Match Engine
 *
 * v1 approach (deliberately simple): every paragraph/heading in the
 * reference .docx is treated as an independent chunk, fuzzy-matched
 * against the whole page's text chunks. No semantic role labeling
 * (e.g. "this is the hero heading") — just "this reference text was
 * found / altered / missing / duplicated on the page". No API or LLM
 * involved — pure string similarity (Dice coefficient).
 */
async function run(page, docxPath, threshold = 0.8) {
  if (!docxPath || !fs.existsSync(docxPath)) {
    return {
      module: 'Content Match Engine',
      status: 'WARN',
      details: ['No docx reference file configured — skipping content match (set config.docx to enable)'],
    };
  }

  const referenceChunks = await extractDocxChunks(docxPath);
  if (referenceChunks.length === 0) {
    return {
      module: 'Content Match Engine',
      status: 'WARN',
      details: ['Reference docx contained no usable text chunks'],
    };
  }

  const pageChunks = await extractPageChunks(page);
  if (pageChunks.length === 0) {
    return {
      module: 'Content Match Engine',
      status: 'FAIL',
      details: ['Page contained no visible text to compare against the reference document'],
    };
  }

  const CONSIDER_FLOOR = 0.4; // below this, not even worth calling "altered" — treat as missing
  const details = [];
  let status = 'PASS';
  let matchedCount = 0;

  for (const refChunk of referenceChunks) {
    const scored = pageChunks
      .map((pageText) => ({ pageText, score: stringSimilarity.compareTwoStrings(refChunk, pageText) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const strongMatches = scored.filter((s) => s.score >= threshold);

    if (strongMatches.length >= 2) {
      details.push({
        reference: truncate(refChunk),
        status: 'duplicate',
        issue: `Matches ${strongMatches.length} different locations on the page (similarity >= ${threshold})`,
        matches: strongMatches.slice(0, 3).map((s) => truncate(s.pageText)),
      });
      status = 'FAIL';
    } else if (best.score >= threshold) {
      matchedCount++;
      // matched cleanly — no detail entry needed, keeps output focused on problems
    } else if (best.score >= CONSIDER_FLOOR) {
      details.push({
        reference: truncate(refChunk),
        status: 'altered',
        issue: `Closest match on page is only ${Math.round(best.score * 100)}% similar (threshold: ${Math.round(threshold * 100)}%)`,
        closestMatch: truncate(best.pageText),
      });
      status = 'FAIL';
    } else {
      details.push({
        reference: truncate(refChunk),
        status: 'missing',
        issue: 'No reasonably similar text found anywhere on the page',
      });
      status = 'FAIL';
    }
  }

  return {
    module: 'Content Match Engine',
    status,
    details: details.length ? details : [`All ${referenceChunks.length} reference content chunk(s) found on page`],
    summary: {
      totalReferenceChunks: referenceChunks.length,
      matched: matchedCount,
      issues: details.length,
    },
  };
}

/**
 * Pulls paragraphs and headings out of the docx as plain text chunks.
 * Uses convertToHtml (not extractRawText) so we can split on block-level
 * tags reliably, even though we don't currently use the heading/paragraph
 * distinction for anything beyond chunk boundaries.
 */
async function extractDocxChunks(docxPath) {
  const { value: html } = await mammoth.convertToHtml({ path: docxPath });

  const blockPattern = /<(h1|h2|h3|h4|p|li)[^>]*>(.*?)<\/\1>/gis;
  const chunks = [];
  let match;

  while ((match = blockPattern.exec(html)) !== null) {
    const text = stripTags(match[2]).trim();
    if (text.length >= 3) chunks.push(text);
  }

  return chunks;
}

/**
 * Pulls visible text chunks from the live page: headings, paragraphs,
 * list items, and button/link text (so CTA-style short text can match too).
 */
async function extractPageChunks(page) {
  return page.evaluate(() => {
    const selectors = 'h1, h2, h3, h4, p, li, button, a';
    const elements = Array.from(document.querySelectorAll(selectors));

    const chunks = [];
    const seen = new Set();

    for (const el of elements) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      const text = (el.textContent || '').trim();
      if (text.length < 3) continue;
      if (seen.has(text)) continue;

      seen.add(text);
      chunks.push(text);
    }

    return chunks;
  });
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text, max = 80) {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

module.exports = { run, extractDocxChunks, extractPageChunks };