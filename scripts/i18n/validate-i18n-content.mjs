#!/usr/bin/env node

/**
 * Read-only content and local-link QA for the 36-page multilingual site.
 *
 * This validator intentionally does not re-check hreflang/switcher clusters;
 * add-i18n-seo.mjs owns those checks. Built-in Node modules only.
 */

import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SITE_ROOT = path.join(SCRIPT_DIR, 'site');

const LOCALES = [
  { key: 'en', slug: '', htmlLang: 'en', hreflang: 'en' },
  {
    key: 'ru',
    slug: 'ru',
    htmlLang: 'ru',
    hreflang: 'ru',
    capPatterns: [
      /(?:до|не более|максимум(?:\s+до)?)\s+(?:двух|2)\s+час(?:ов|а)?/iu,
    ],
  },
  {
    key: 'es',
    slug: 'es',
    htmlLang: 'es-ES',
    hreflang: 'es-ES',
    capPatterns: [
      /(?:hasta|máximo(?:\s+de)?|no más de)\s+(?:dos|2)\s+horas?/iu,
    ],
  },
  {
    key: 'pt-br',
    slug: 'pt-br',
    htmlLang: 'pt-BR',
    hreflang: 'pt-BR',
    capPatterns: [
      /(?:até|máximo(?:\s+de)?|no máximo)\s+(?:duas|2)\s+horas?/iu,
    ],
  },
  {
    key: 'de',
    slug: 'de',
    htmlLang: 'de',
    hreflang: 'de',
    capPatterns: [/(?:bis zu|maximal|höchstens)\s+(?:zwei|2)\s+stunden?/iu],
  },
  {
    key: 'fr',
    slug: 'fr',
    htmlLang: 'fr',
    hreflang: 'fr',
    capPatterns: [
      /(?:jusqu['’]à|maximum(?:\s+de)?|au maximum)\s+(?:deux|2)\s+heures?/iu,
    ],
  },
  {
    key: 'it',
    slug: 'it',
    htmlLang: 'it',
    hreflang: 'it',
    capPatterns: [/(?:fino a|massimo(?:\s+di)?|al massimo)\s+(?:due|2)\s+ore/iu],
  },
  {
    key: 'ja',
    slug: 'ja',
    htmlLang: 'ja',
    hreflang: 'ja',
    capPatterns: [
      /(?:最大|最長|上限).{0,8}(?:2|二)\s*時間/u,
      /(?:2|二)\s*時間.{0,6}(?:以内|まで|上限)/u,
    ],
  },
  {
    key: 'ko',
    slug: 'ko',
    htmlLang: 'ko',
    hreflang: 'ko',
    capPatterns: [
      /(?:최대|최장|상한).{0,8}(?:2|두)\s*시간/u,
      /(?:2|두)\s*시간.{0,6}(?:이내|까지|상한)/u,
    ],
  },
  {
    key: 'zh-hans',
    slug: 'zh-hans',
    htmlLang: 'zh-Hans',
    hreflang: 'zh-Hans',
    capPatterns: [
      /(?:最多|最长|上限).{0,8}(?:2|两|二|两个)\s*小时/u,
      /(?:2|两|二|两个)\s*小时.{0,6}(?:以内|最多|上限)/u,
    ],
  },
  {
    key: 'zh-hant',
    slug: 'zh-hant',
    htmlLang: 'zh-Hant',
    hreflang: 'zh-Hant',
    capPatterns: [
      /(?:最多|最長|上限).{0,8}(?:2|兩|二|兩個)\s*小時/u,
      /(?:2|兩|二|兩個)\s*小時.{0,6}(?:以內|最多|上限)/u,
    ],
  },
  {
    key: 'ar',
    slug: 'ar',
    htmlLang: 'ar',
    hreflang: 'ar',
    rtl: true,
    capPatterns: [
      /(?:حتى|بحد أقصى|حد أقصى|لا تزيد عن|بما لا يتجاوز)\s*.{0,8}(?:ساعتين|ساعتان|ساعتَيْن|2\s*ساع|٢\s*ساع)/u,
      /(?:ساعتين|ساعتان|ساعتَيْن|2\s*ساع|٢\s*ساع).{0,8}(?:كحد أقصى|على الأكثر|حد أقصى)/u,
    ],
  },
];

LOCALES[0].capPatterns = [
  /(?:up to|maximum(?:\s+of)?|max(?:imum)?(?:\s+of)?|no more than)\s+(?:two|2)\s+hours?/iu,
];

const ROUTES = [
  { key: 'home', segments: [] },
  { key: 'work', segments: ['work'] },
  { key: 'ai-systems', segments: ['work', 'ai-systems'], requiresOffer: true },
];

const BANNED_PUNCTUATION = new Map([
  ['\u2011', 'U+2011 non-breaking hyphen'],
  ['\u2013', 'U+2013 en dash'],
  ['\u2014', 'U+2014 em dash'],
  ['\u201C', 'U+201C left double quotation mark'],
  ['\u201D', 'U+201D right double quotation mark'],
]);

const ENGLISH_BOILERPLATE = [
  /\bskip to content\b/iu,
  /\bfree founder field guide\b/iu,
  /\bscreen cvs with ai\b/iu,
  /\binterview smarter\b/iu,
  /\bselected work\b/iu,
  /\bread the investor deck\b/iu,
  /\bread the story\b/iu,
  /\bexplore the map\b/iu,
  /\bone operator memo with real metrics\b/iu,
  /\bwork with me\b/iu,
  /\bthink through one hard decision\b/iu,
  /\bbring one specific operating problem\b/iu,
  /\bchoose the route that matches the outcome\b/iu,
  /\bfocused operator advisory remains available\b/iu,
  /\ba useful brief fits in one email\b/iu,
  /\bsend an advisory brief\b/iu,
  /\bview upwork consultation\b/iu,
  /\breview my track record\b/iu,
  /\bput one ai workflow or agent system into production\b/iu,
  /\bai automation consulting and hands-on implementation\b/iu,
  /\bthree ways to engage\b/iu,
  /\bthe unit of work is one concrete operating outcome\b/iu,
  /\bwhat i work on\b/iu,
  /\bowned-product proof\b/iu,
  /\bfrom brief to an operating system\b/iu,
  /\bgood fit and bad fit\b/iu,
  /\bsend a project brief\b/iu,
  /\bproduction ai delivery\b/iu,
  /\bcompleted exits\b/iu,
  /\bstart with the real workflow\b/iu,
];

const ENGLISH_FUNCTION_WORDS = new Set([
  'a',
  'about',
  'after',
  'all',
  'also',
  'an',
  'and',
  'are',
  'as',
  'at',
  'before',
  'between',
  'bring',
  'build',
  'but',
  'by',
  'can',
  'choose',
  'does',
  'do',
  'each',
  'fit',
  'fits',
  'for',
  'from',
  'get',
  'have',
  'here',
  'how',
  'if',
  'in',
  'into',
  'is',
  'it',
  'keep',
  'more',
  'need',
  'not',
  'of',
  'on',
  'one',
  'only',
  'or',
  'read',
  'see',
  'send',
  'share',
  'should',
  'so',
  'that',
  'the',
  'then',
  'through',
  'this',
  'to',
  'under',
  'use',
  'what',
  'when',
  'where',
  'which',
  'who',
  'will',
  'with',
  'without',
  'work',
  'you',
  'your',
]);

const TECHNICAL_OR_BRAND_WORDS = new Set([
  'ai',
  'api',
  'apis',
  'app',
  'apps',
  'aws',
  'balchunas',
  'brain',
  'company',
  'dynamodb',
  'github',
  'google',
  'hypee',
  'lambda',
  'linkedin',
  'llm',
  'llms',
  'mcp',
  'meta',
  'play',
  's3',
  'stable',
  'diffusion',
  'store',
  'tiktok',
  'upwork',
  'usd',
  'yandex',
]);

const EXACT_ENGLISH_UI_LABELS = new Set([
  'about',
  'available now',
  'back',
  'book a call',
  'close',
  'confirm fit.',
  'current',
  'email me',
  'home',
  'language',
  'learn more',
  'next',
  'previous',
  'privacy',
  'projects',
  'read more',
  'selected work',
  'send a brief',
  'start here',
  'subscribe',
  'work',
]);

const PLACEHOLDER_PATTERN = /__I18N_[A-Z0-9_:-]*/giu;
const CONFIRM_FIT_PATTERN = /\bconfirm\s+fit\./giu;

function printUsage() {
  console.log(`Usage:
  node validate-i18n-content.mjs [--site-root PATH] [--origin URL]

Defaults:
  --site-root ${DEFAULT_SITE_ROOT}
  --origin    https://alekseibalchunas.com

The validator is read-only and exits with code 1 on any QA error.`);
}

function parseArgs(argv) {
  const options = {
    siteRoot: DEFAULT_SITE_ROOT,
    origin: 'https://alekseibalchunas.com',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--site-root') {
      if (!argv[index + 1]) throw new Error('--site-root requires a path');
      options.siteRoot = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg === '--origin') {
      if (!argv[index + 1]) throw new Error('--origin requires a URL');
      options.origin = argv[index + 1].replace(/\/+$/, '');
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  const parsed = new URL(options.origin);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('--origin must use http or https');
  }
  options.origin = parsed.origin + parsed.pathname.replace(/\/+$/, '');
  return options;
}

function publicPath(locale, route) {
  const localePrefix = locale.slug ? `${locale.slug}/` : '';
  const routeSuffix = route.segments.length > 0 ? `${route.segments.join('/')}/` : '';
  return `/${localePrefix}${routeSuffix}`;
}

function publicUrl(origin, locale, route) {
  return `${origin}${publicPath(locale, route)}`;
}

function pageFile(siteRoot, locale, route) {
  const parts = [siteRoot];
  if (locale.slug) parts.push(locale.slug);
  parts.push(...route.segments, 'index.html');
  return path.join(...parts);
}

function expectedPages(siteRoot, origin) {
  return ROUTES.flatMap((route) =>
    LOCALES.map((locale) => ({
      locale,
      route,
      file: pageFile(siteRoot, locale, route),
      url: publicUrl(origin, locale, route),
    })),
  );
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function walkHtml(directory) {
  if (!(await exists(directory))) return [];
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkHtml(fullPath)));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) files.push(fullPath);
  }
  return files.sort();
}

function getAttribute(tag, attribute) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(
    new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
  );
  return match ? match[1] ?? match[2] ?? match[3] ?? '' : null;
}

function relTokens(tag) {
  return (getAttribute(tag, 'rel') ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function decodeEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };
  return String(value)
    .replace(/&#x([0-9a-f]+);/giu, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/gu, (_match, decimal) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&([a-z]+);/giu, (match, name) => named[name.toLowerCase()] ?? match);
}

function plainText(fragment) {
  return decodeEntities(
    String(fragment)
      .replace(/<!--([\s\S]*?)-->/g, ' ')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/gu, ' ')
    .trim();
}

function visibleText(html) {
  return plainText(
    html
      .replace(/<head\b[^>]*>[\s\S]*?<\/head>/iu, ' ')
      .replace(/<!-- i18n-switcher:start -->[\s\S]*?<!-- i18n-switcher:end -->/iu, ' ')
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/giu, ' ')
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/giu, ' '),
  );
}

function htmlTextSegments(html, parsedJsonLd = []) {
  const withoutSwitcher = html.replace(
    /<!-- i18n-switcher:start -->[\s\S]*?<!-- i18n-switcher:end -->/iu,
    ' ',
  );
  const segments = [];

  const title = withoutSwitcher.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu)?.[1];
  if (title) segments.push(plainText(title));

  for (const tag of metaTags(withoutSwitcher)) {
    const name = (getAttribute(tag, 'name') ?? '').toLowerCase();
    const property = (getAttribute(tag, 'property') ?? '').toLowerCase();
    if (
      name === 'description' ||
      name === 'twitter:title' ||
      name === 'twitter:description' ||
      property === 'og:title' ||
      property === 'og:description'
    ) {
      segments.push(decodeEntities(getAttribute(tag, 'content') ?? ''));
    }
  }

  const body = withoutSwitcher
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/iu, ' ')
    .replace(/<!--([\s\S]*?)-->/gu, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/giu, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/giu, ' ');

  for (const openingTag of body.match(/<[a-z][^>]*>/giu) ?? []) {
    for (const attribute of ['alt', 'aria-label', 'placeholder', 'title']) {
      const value = getAttribute(openingTag, attribute);
      if (value) segments.push(decodeEntities(value));
    }
  }

  const textNodes = decodeEntities(body.replace(/<[^>]+>/gu, '\n'))
    .split(/\n+/gu)
    .map((value) => value.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);
  segments.push(...textNodes);

  for (const value of parsedJsonLd.flatMap((document) => collectJsonStrings(document))) {
    segments.push(value);
  }

  return segments.map((value) => String(value).replace(/\s+/gu, ' ').trim()).filter(Boolean);
}

function normalizeComparableText(value) {
  return decodeEntities(value)
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('en');
}

function clearEnglishReferenceSegment(value) {
  const normalized = normalizeComparableText(value);
  if (
    /^(?:https?:\/\/|www\.)/iu.test(normalized) ||
    /\b[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/iu.test(normalized) ||
    /@/u.test(normalized)
  ) {
    return false;
  }
  const tokens = normalized.match(/[a-z]+(?:'[a-z]+)?/gu) ?? [];
  const nonBrand = tokens.filter((token) => !TECHNICAL_OR_BRAND_WORDS.has(token));
  if (nonBrand.length >= 4) return true;
  const functionHits = nonBrand.filter((token) => ENGLISH_FUNCTION_WORDS.has(token)).length;
  return nonBrand.length >= 3 && functionHits >= 1;
}

function classIdStructure(html) {
  const safeHtml = html
    .replace(
      /<!-- i18n-switcher:start -->[\s\S]*?<!-- i18n-switcher:end -->/giu,
      ' ',
    )
    .replace(/<!--([\s\S]*?)-->/gu, ' ')
    .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/giu, '$1$2')
    .replace(/(<style\b[^>]*>)[\s\S]*?(<\/style>)/giu, '$1$2');
  const structure = [];
  for (const match of safeHtml.matchAll(/<([a-z][a-z0-9:-]*)\b[^>]*>/giu)) {
    const tag = match[0];
    const className = getAttribute(tag, 'class');
    const id = getAttribute(tag, 'id');
    if (className === null && id === null) continue;
    structure.push({
      tag: match[1].toLowerCase(),
      className: className === null ? null : className.trim().split(/\s+/gu).filter(Boolean).join(' '),
      id: id === null ? null : id,
    });
  }
  return structure;
}

function describeStructureEntry(entry) {
  if (!entry) return '<missing>';
  const attributes = [];
  if (entry.id !== null) attributes.push(`id=${JSON.stringify(entry.id)}`);
  if (entry.className !== null) attributes.push(`class=${JSON.stringify(entry.className)}`);
  return `<${entry.tag}${attributes.length > 0 ? ` ${attributes.join(' ')}` : ''}>`;
}

function validateClassIdStructure(html, page, reference, errors, metrics) {
  if (page.locale.key === 'en' || !reference) return;
  const actual = classIdStructure(html);
  const expected = reference.classIdStructure;
  const differences = [];
  const length = Math.max(actual.length, expected.length);
  for (let index = 0; index < length; index += 1) {
    if (JSON.stringify(actual[index]) !== JSON.stringify(expected[index])) {
      differences.push(
        `entry ${index + 1}: expected ${describeStructureEntry(expected[index])}, got ${describeStructureEntry(
          actual[index],
        )}`,
      );
    }
  }
  if (differences.length === 0) return;
  metrics.structureMismatchPages += 1;
  errors.push(
    `${page.file}: class/id structure differs from English ${page.route.key} template ` +
      `(expected ${expected.length} entries, got ${actual.length}; ${differences.length} differences)`,
  );
  for (const difference of differences.slice(0, 12)) {
    errors.push(`${page.file}: class/id ${difference}`);
  }
  if (differences.length > 12) {
    errors.push(`${page.file}: ${differences.length - 12} additional class/id differences`);
  }
}

function metaTags(html) {
  return html.match(/<meta\b[^>]*>/giu) ?? [];
}

function linkTags(html) {
  return html.match(/<link\b[^>]*>/giu) ?? [];
}

function jsonLdBlocks(html) {
  const blocks = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/giu;
  let match;
  while ((match = scriptPattern.exec(html)) !== null) {
    const openingTag = `<script${match[1]}>`;
    if ((getAttribute(openingTag, 'type') ?? '').toLowerCase() === 'application/ld+json') {
      blocks.push(match[2].trim());
    }
  }
  return blocks;
}

function allObjects(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) allObjects(item, output);
  } else if (value && typeof value === 'object') {
    output.push(value);
    for (const item of Object.values(value)) allObjects(item, output);
  }
  return output;
}

function hasType(object, expectedType) {
  const types = Array.isArray(object?.['@type']) ? object['@type'] : [object?.['@type']];
  return types.includes(expectedType);
}

function parseJsonLd(html, page, errors, metrics) {
  const parsed = [];
  const blocks = jsonLdBlocks(html);
  metrics.jsonLdBlocks += blocks.length;
  blocks.forEach((source, index) => {
    try {
      parsed.push(JSON.parse(source));
    } catch (error) {
      metrics.jsonLdInvalid += 1;
      errors.push(`${page.file}: JSON-LD block ${index + 1} is invalid: ${error.message}`);
    }
  });
  return parsed;
}

function hasExpectedServiceOffer(parsedJsonLd) {
  const objects = parsedJsonLd.flatMap((document) => allObjects(document));
  const services = objects.filter((object) => hasType(object, 'Service'));
  for (const service of services) {
    const offers = Array.isArray(service.offers) ? service.offers : [service.offers];
    for (const offer of offers.filter(Boolean)) {
      if (
        hasType(offer, 'Offer') &&
        Number(offer.price) === 299 &&
        String(offer.priceCurrency ?? '').toUpperCase() === 'USD'
      ) {
        return true;
      }
    }
  }
  return false;
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function findBannedPunctuation(html, page, errors, metrics) {
  for (const [character, label] of BANNED_PUNCTUATION) {
    let start = 0;
    while (true) {
      const index = html.indexOf(character, start);
      if (index < 0) break;
      metrics.bannedPunctuation += 1;
      errors.push(`${page.file}:${lineNumber(html, index)}: banned ${label}`);
      start = index + character.length;
    }
  }
}

function findI18nPlaceholders(html, page, errors, metrics) {
  for (const match of html.matchAll(PLACEHOLDER_PATTERN)) {
    metrics.i18nPlaceholders += 1;
    errors.push(
      `${page.file}:${lineNumber(html, match.index)}: unresolved i18n placeholder ${JSON.stringify(
        match[0],
      )}`,
    );
  }
}

function findNonEnglishConfirmFit(html, page, errors, metrics) {
  if (page.locale.key === 'en' || page.route.key !== 'ai-systems') return;
  for (const match of html.matchAll(CONFIRM_FIT_PATTERN)) {
    metrics.confirmFitErrors += 1;
    errors.push(
      `${page.file}:${lineNumber(html, match.index)}: untranslated English boilerplate "${match[0]}"`,
    );
  }
}

function collectJsonStrings(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonStrings(item, output);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key.startsWith('@')) continue;
      collectJsonStrings(item, output);
    }
  } else if (typeof value === 'string' && !/^https?:\/\//iu.test(value)) {
    output.push(value);
  }
  return output;
}

function collectAllStrings(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectAllStrings(item, output);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectAllStrings(item, output);
  } else if (typeof value === 'string') {
    output.push(value);
  }
  return output;
}

function englishDensity(segment) {
  const tokens = (segment.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/gu) ?? []).filter(
    (token) => !TECHNICAL_OR_BRAND_WORDS.has(token),
  );
  if (tokens.length < 6) return { suspicious: false, hits: 0, total: tokens.length };
  const hits = tokens.filter((token) => ENGLISH_FUNCTION_WORDS.has(token)).length;
  return { suspicious: hits >= 3 && hits / tokens.length >= 0.36, hits, total: tokens.length };
}

function englishBoilerplateIssues(html, parsedJsonLd, page, reference) {
  if (page.locale.key === 'en') return [];
  const segments = htmlTextSegments(html, parsedJsonLd);
  const findings = new Set();
  for (const rawSegment of segments) {
    const segment = rawSegment.replace(/\s+/gu, ' ').trim();
    if (!segment) continue;
    const normalized = normalizeComparableText(segment);
    if (EXACT_ENGLISH_UI_LABELS.has(normalized)) {
      findings.add(segment);
      continue;
    }
    if (reference?.englishSegments.has(normalized) && clearEnglishReferenceSegment(segment)) {
      findings.add(segment.slice(0, 180));
      continue;
    }
    if (ENGLISH_BOILERPLATE.some((pattern) => pattern.test(segment))) {
      findings.add(segment.slice(0, 180));
      continue;
    }
    const density = englishDensity(segment);
    if (density.suspicious) findings.add(segment.slice(0, 180));
  }
  return [...findings];
}

function normalizedUniqueValue(value) {
  return decodeEntities(value).replace(/\s+/gu, ' ').trim().toLocaleLowerCase('und');
}

function routeUrlCandidates(html, parsedJsonLd) {
  const candidates = new Set();
  for (const tag of html.match(/<[a-z][^>]*>/giu) ?? []) {
    const href = getAttribute(tag, 'href');
    if (href) candidates.add(decodeEntities(href));
    const property = (getAttribute(tag, 'property') ?? '').toLowerCase();
    if (property === 'og:url') {
      const content = getAttribute(tag, 'content');
      if (content) candidates.add(decodeEntities(content));
    }
  }
  for (const value of parsedJsonLd.flatMap((document) => collectAllStrings(document))) {
    if (/^(?:https?:\/\/|\/|\.\.?\/|#)/iu.test(value)) candidates.add(decodeEntities(value));
  }
  return [...candidates];
}

function validateCanonicalRoutePaths(
  html,
  parsedJsonLd,
  page,
  options,
  allowedPagePaths,
  errors,
  metrics,
) {
  const siteOrigin = new URL(options.origin).origin;
  for (const candidate of routeUrlCandidates(html, parsedJsonLd)) {
    let resolved;
    try {
      resolved = new URL(candidate, page.url);
    } catch (error) {
      metrics.routePathErrors += 1;
      errors.push(`${page.file}: invalid route URL ${JSON.stringify(candidate)}: ${error.message}`);
      continue;
    }

    if (
      resolved.protocol === 'http:' ||
      resolved.protocol === 'https:'
    ) {
      if (
        resolved.pathname.includes('/freelancers/') &&
        resolved.hostname.toLowerCase() !== 'www.upwork.com'
      ) {
        metrics.externalUrlErrors += 1;
        errors.push(
          `${page.file}: probable corrupted Upwork URL host in ${JSON.stringify(candidate)}`,
        );
      }
    }

    if (!['http:', 'https:'].includes(resolved.protocol) || resolved.origin !== siteOrigin) continue;
    let pathname;
    try {
      pathname = decodeURIComponent(resolved.pathname);
    } catch {
      metrics.routePathErrors += 1;
      errors.push(`${page.file}: invalid path encoding in route URL ${JSON.stringify(candidate)}`);
      continue;
    }
    if (pathname.endsWith('/') && !allowedPagePaths.has(pathname)) {
      metrics.routePathErrors += 1;
      errors.push(
        `${page.file}: noncanonical internal page route ${JSON.stringify(pathname)}; ` +
          'localized pages must keep the stable /work/ and /work/ai-systems/ slugs',
      );
    }
  }
}

async function resolveLocalHref(href, page, options) {
  const decodedHref = decodeEntities(href);
  const resolvedUrl = new URL(decodedHref, page.url);
  const siteOrigin = new URL(options.origin).origin;
  if (!['http:', 'https:'].includes(resolvedUrl.protocol) || resolvedUrl.origin !== siteOrigin) {
    return { external: true };
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(resolvedUrl.pathname);
  } catch {
    return { error: `invalid URL encoding in ${href}` };
  }
  const relative = decodedPath.replace(/^\/+/, '');
  let target = path.resolve(options.siteRoot, relative);
  const root = path.resolve(options.siteRoot);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    return { error: `path escapes site root: ${href}` };
  }

  if (decodedPath.endsWith('/')) target = path.join(target, 'index.html');
  else {
    try {
      if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    } catch {
      // Existence is reported below with the final target.
    }
  }

  if (!(await exists(target))) return { error: `missing target ${target}` };

  if (resolvedUrl.hash && target.toLowerCase().endsWith('.html')) {
    const fragment = decodeURIComponent(resolvedUrl.hash.slice(1));
    const targetHtml = await readFile(target, 'utf8');
    const ids = (targetHtml.match(/\bid\s*=\s*(?:"[^"]*"|'[^']*')/giu) ?? []).map((tag) =>
      getAttribute(tag, 'id'),
    );
    if (!ids.includes(fragment)) return { error: `missing fragment #${fragment} in ${target}` };
  }

  return { target };
}

async function validateHrefs(html, page, options, errors, metrics) {
  const tags = html.match(/<[a-z][^>]*\bhref\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>/giu) ?? [];
  for (const tag of tags) {
    const href = getAttribute(tag, 'href') ?? '';
    metrics.hrefs += 1;
    if (!href) {
      metrics.hrefMissing += 1;
      errors.push(`${page.file}: empty href`);
      continue;
    }
    if (/\s/u.test(href)) {
      metrics.hrefSpaces += 1;
      errors.push(`${page.file}: href contains whitespace: ${JSON.stringify(href)}`);
      continue;
    }
    const isFragmentHref = href.startsWith('#');
    if (isFragmentHref) metrics.anchorsChecked += 1;
    if (href === '#') {
      metrics.hrefMissing += 1;
      metrics.anchorErrors += 1;
      errors.push(`${page.file}: empty fragment href #`);
      continue;
    }
    let resolution;
    try {
      resolution = await resolveLocalHref(href, page, options);
    } catch (error) {
      resolution = { error: error.message };
    }
    if (resolution.error) {
      metrics.hrefMissing += 1;
      if (isFragmentHref) metrics.anchorErrors += 1;
      errors.push(`${page.file}: href ${href}: ${resolution.error}`);
    } else if (!resolution.external) {
      metrics.localHrefs += 1;
    }
  }
}

function addDuplicateErrors(records, field, routeKey, errors, metrics) {
  const groups = new Map();
  for (const record of records) {
    const value = normalizedUniqueValue(record[field]);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(record.file);
  }
  for (const [value, files] of groups) {
    if (value && files.length > 1) {
      metrics.duplicateMetadata += 1;
      errors.push(
        `${routeKey}: duplicate ${field} across locales: ${files.join(', ')} (${value.slice(0, 120)})`,
      );
    }
  }
}

function parseJsonLdQuietly(html) {
  const parsed = [];
  for (const source of jsonLdBlocks(html)) {
    try {
      parsed.push(JSON.parse(source));
    } catch {
      // The regular page pass reports invalid JSON-LD with file and block context.
    }
  }
  return parsed;
}

async function buildRouteReferences(pages) {
  const references = new Map();
  for (const route of ROUTES) {
    const englishPage = pages.find(
      (page) => page.route.key === route.key && page.locale.key === 'en',
    );
    if (!englishPage || !(await exists(englishPage.file))) continue;
    const html = await readFile(englishPage.file, 'utf8');
    const parsedJsonLd = parseJsonLdQuietly(html);
    const englishSegments = new Set(
      htmlTextSegments(html, parsedJsonLd)
        .filter(clearEnglishReferenceSegment)
        .map(normalizeComparableText),
    );
    references.set(route.key, {
      classIdStructure: classIdStructure(html),
      englishSegments,
      file: englishPage.file,
    });
  }
  return references;
}

async function validatePage(
  page,
  options,
  reference,
  allowedPagePaths,
  errors,
  metrics,
) {
  const html = await readFile(page.file, 'utf8');
  metrics.pagesChecked += 1;

  findI18nPlaceholders(html, page, errors, metrics);
  findNonEnglishConfirmFit(html, page, errors, metrics);
  validateClassIdStructure(html, page, reference, errors, metrics);

  const titleMatches = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/giu)];
  const h1Matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/giu)];
  const descriptions = metaTags(html).filter(
    (tag) => (getAttribute(tag, 'name') ?? '').toLowerCase() === 'description',
  );
  const canonicals = linkTags(html).filter((tag) => relTokens(tag).includes('canonical'));
  const ogUrls = metaTags(html).filter(
    (tag) => (getAttribute(tag, 'property') ?? '').toLowerCase() === 'og:url',
  );

  const countChecks = [
    ['title', titleMatches.length],
    ['H1', h1Matches.length],
    ['meta description', descriptions.length],
    ['canonical', canonicals.length],
    ['og:url', ogUrls.length],
  ];
  for (const [label, count] of countChecks) {
    if (count !== 1) errors.push(`${page.file}: expected one ${label}, got ${count}`);
  }

  const title = plainText(titleMatches[0]?.[1] ?? '');
  const h1 = plainText(h1Matches[0]?.[1] ?? '');
  const description = decodeEntities(getAttribute(descriptions[0] ?? '', 'content') ?? '').trim();
  if (!title) errors.push(`${page.file}: title is empty`);
  if (!h1) errors.push(`${page.file}: H1 is empty`);
  if (!description) errors.push(`${page.file}: meta description is empty`);

  const canonical = getAttribute(canonicals[0] ?? '', 'href');
  if (canonicals.length === 1 && canonical !== page.url) {
    metrics.canonicalMismatch += 1;
    errors.push(`${page.file}: canonical expected ${page.url}, got ${canonical}`);
  }
  const ogUrl = decodeEntities(getAttribute(ogUrls[0] ?? '', 'content') ?? '');
  if (ogUrls.length === 1 && ogUrl !== page.url) {
    metrics.ogUrlMismatch += 1;
    errors.push(`${page.file}: og:url expected ${page.url}, got ${ogUrl}`);
  }

  const htmlTags = html.match(/<html\b[^>]*>/giu) ?? [];
  if (htmlTags.length !== 1) errors.push(`${page.file}: expected one html element, got ${htmlTags.length}`);
  const htmlTag = htmlTags[0] ?? '';
  if (getAttribute(htmlTag, 'lang') !== page.locale.htmlLang) {
    metrics.langMismatch += 1;
    errors.push(
      `${page.file}: html lang expected ${page.locale.htmlLang}, got ${getAttribute(
        htmlTag,
        'lang',
      )}`,
    );
  }
  const direction = getAttribute(htmlTag, 'dir');
  if ((page.locale.rtl && direction !== 'rtl') || (!page.locale.rtl && direction === 'rtl')) {
    metrics.dirMismatch += 1;
    errors.push(`${page.file}: html dir expected ${page.locale.rtl ? 'rtl' : 'not rtl'}, got ${direction}`);
  }

  const parsedJsonLd = parseJsonLd(html, page, errors, metrics);
  validateCanonicalRoutePaths(
    html,
    parsedJsonLd,
    page,
    options,
    allowedPagePaths,
    errors,
    metrics,
  );
  if (page.route.requiresOffer) {
    if (!hasExpectedServiceOffer(parsedJsonLd)) {
      metrics.offerErrors += 1;
      errors.push(`${page.file}: missing Service Offer with USD 299`);
    }
    const bodyText = visibleText(html);
    if (!page.locale.capPatterns.some((pattern) => pattern.test(bodyText))) {
      metrics.capErrors += 1;
      errors.push(`${page.file}: visible copy does not state the localized maximum two-hour cap`);
    }
  }

  findBannedPunctuation(html, page, errors, metrics);
  const boilerplate = englishBoilerplateIssues(html, parsedJsonLd, page, reference);
  if (boilerplate.length > 0) {
    metrics.englishBoilerplatePages += 1;
    for (const finding of boilerplate.slice(0, 10)) {
      errors.push(`${page.file}: probable English boilerplate: ${JSON.stringify(finding)}`);
    }
    if (boilerplate.length > 10) {
      errors.push(`${page.file}: ${boilerplate.length - 10} additional English boilerplate findings`);
    }
  }

  await validateHrefs(html, page, options, errors, metrics);
  return { file: page.file, title, description, route: page.route.key };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pages = expectedPages(options.siteRoot, options.origin);
  const errors = [];
  const warnings = [];
  const metrics = {
    expectedPages: pages.length,
    pagesChecked: 0,
    pagesMissing: 0,
    canonicalMismatch: 0,
    ogUrlMismatch: 0,
    langMismatch: 0,
    dirMismatch: 0,
    jsonLdBlocks: 0,
    jsonLdInvalid: 0,
    offerErrors: 0,
    capErrors: 0,
    i18nPlaceholders: 0,
    confirmFitErrors: 0,
    structureMismatchPages: 0,
    routePathErrors: 0,
    externalUrlErrors: 0,
    hrefs: 0,
    localHrefs: 0,
    hrefMissing: 0,
    hrefSpaces: 0,
    anchorsChecked: 0,
    anchorErrors: 0,
    bannedPunctuation: 0,
    englishBoilerplatePages: 0,
    duplicateMetadata: 0,
  };

  const existingPages = [];
  for (const page of pages) {
    if (await exists(page.file)) existingPages.push(page);
    else {
      metrics.pagesMissing += 1;
      errors.push(`missing expected locale route: ${page.file}`);
    }
  }

  const allHtml = await walkHtml(options.siteRoot);
  const expectedFiles = new Set(pages.map((page) => path.resolve(page.file)));
  const unexpected = allHtml.filter((file) => !expectedFiles.has(path.resolve(file)));
  for (const file of unexpected) warnings.push(`unexpected HTML outside the 36-page matrix: ${file}`);

  const references = await buildRouteReferences(pages);
  for (const route of ROUTES) {
    if (!references.has(route.key)) {
      errors.push(`${route.key}: missing English template for class/id and copy comparison`);
    }
  }
  const allowedPagePaths = new Set(pages.map((page) => new URL(page.url).pathname));

  const records = [];
  for (const page of existingPages) {
    try {
      records.push(
        await validatePage(
          page,
          options,
          references.get(page.route.key),
          allowedPagePaths,
          errors,
          metrics,
        ),
      );
    } catch (error) {
      errors.push(`${page.file}: validation crashed: ${error.stack ?? error.message}`);
    }
  }

  for (const route of ROUTES) {
    const routeRecords = records.filter((record) => record.route === route.key);
    if (routeRecords.length !== LOCALES.length) {
      errors.push(`${route.key}: expected 12 locale pages, got ${routeRecords.length}`);
    }
    addDuplicateErrors(routeRecords, 'title', route.key, errors, metrics);
    addDuplicateErrors(routeRecords, 'description', route.key, errors, metrics);
  }

  console.log(
    `QA pages expected=${metrics.expectedPages} checked=${metrics.pagesChecked} missing=${metrics.pagesMissing} ` +
      `unexpected=${unexpected.length}`,
  );
  console.log(
    `QA seo canonical_mismatch=${metrics.canonicalMismatch} og_url_mismatch=${metrics.ogUrlMismatch} ` +
      `lang_mismatch=${metrics.langMismatch} dir_mismatch=${metrics.dirMismatch} ` +
      `duplicate_metadata=${metrics.duplicateMetadata}`,
  );
  console.log(
    `QA jsonld blocks=${metrics.jsonLdBlocks} invalid=${metrics.jsonLdInvalid} ` +
      `offer_errors=${metrics.offerErrors} cap_errors=${metrics.capErrors}`,
  );
  console.log(
    `QA links checked=${metrics.hrefs} local=${metrics.localHrefs} missing=${metrics.hrefMissing} ` +
      `spaces=${metrics.hrefSpaces} anchors=${metrics.anchorsChecked} anchor_errors=${metrics.anchorErrors}`,
  );
  console.log(
    `QA editorial banned_punctuation=${metrics.bannedPunctuation} ` +
      `english_boilerplate_pages=${metrics.englishBoilerplatePages} ` +
      `i18n_placeholders=${metrics.i18nPlaceholders} confirm_fit_errors=${metrics.confirmFitErrors}`,
  );
  console.log(
    `QA invariants structure_mismatch_pages=${metrics.structureMismatchPages} ` +
      `route_path_errors=${metrics.routePathErrors} external_url_errors=${metrics.externalUrlErrors}`,
  );

  for (const warning of warnings) console.warn(`WARNING ${warning}`);
  if (errors.length > 0) {
    console.error(`QA FAIL errors=${errors.length} warnings=${warnings.length}`);
    for (const error of errors) console.error(`ERROR ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`QA PASS errors=0 warnings=${warnings.length}`);
  }
}

main().catch((error) => {
  console.error(`FATAL ${error.stack ?? error.message}`);
  process.exitCode = 1;
});
