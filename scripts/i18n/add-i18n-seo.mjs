#!/usr/bin/env node

/**
 * Idempotent multilingual SEO postprocessor for alekseibalchunas.com.
 *
 * Expected input: 36 already translated HTML files covering 12 locales and
 * three route families. This script does not translate or create page copy.
 * It updates only managed SEO/switcher blocks, html lang/dir, the shared
 * i18n stylesheet copied into the site root, and sitemap.xml.
 *
 * Built-in Node modules only. Run with Node 18 or newer.
 */

import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SITE_ROOT = path.join(SCRIPT_DIR, 'site');
const STYLE_SOURCE = path.join(SCRIPT_DIR, 'i18n-style.css');

const HEAD_START = '<!-- i18n-seo:start -->';
const HEAD_END = '<!-- i18n-seo:end -->';
const SWITCHER_START = '<!-- i18n-switcher:start -->';
const SWITCHER_END = '<!-- i18n-switcher:end -->';

const LOCALES = [
  {
    key: 'en',
    slug: '',
    htmlLang: 'en',
    hreflang: 'en',
    languageName: 'English',
    selectorLabel: 'Language',
  },
  {
    key: 'ru',
    slug: 'ru',
    htmlLang: 'ru',
    hreflang: 'ru',
    languageName: 'Русский',
    selectorLabel: 'Язык',
  },
  {
    key: 'es',
    slug: 'es',
    htmlLang: 'es-ES',
    hreflang: 'es-ES',
    languageName: 'Español',
    selectorLabel: 'Idioma',
  },
  {
    key: 'pt-br',
    slug: 'pt-br',
    htmlLang: 'pt-BR',
    hreflang: 'pt-BR',
    languageName: 'Português (Brasil)',
    selectorLabel: 'Idioma',
  },
  {
    key: 'de',
    slug: 'de',
    htmlLang: 'de',
    hreflang: 'de',
    languageName: 'Deutsch',
    selectorLabel: 'Sprache',
  },
  {
    key: 'fr',
    slug: 'fr',
    htmlLang: 'fr',
    hreflang: 'fr',
    languageName: 'Français',
    selectorLabel: 'Langue',
  },
  {
    key: 'it',
    slug: 'it',
    htmlLang: 'it',
    hreflang: 'it',
    languageName: 'Italiano',
    selectorLabel: 'Lingua',
  },
  {
    key: 'ja',
    slug: 'ja',
    htmlLang: 'ja',
    hreflang: 'ja',
    languageName: '日本語',
    selectorLabel: '言語',
  },
  {
    key: 'ko',
    slug: 'ko',
    htmlLang: 'ko',
    hreflang: 'ko',
    languageName: '한국어',
    selectorLabel: '언어',
  },
  {
    key: 'zh-hans',
    slug: 'zh-hans',
    htmlLang: 'zh-Hans',
    hreflang: 'zh-Hans',
    languageName: '简体中文',
    selectorLabel: '语言',
  },
  {
    key: 'zh-hant',
    slug: 'zh-hant',
    htmlLang: 'zh-Hant',
    hreflang: 'zh-Hant',
    languageName: '繁體中文',
    selectorLabel: '語言',
  },
  {
    key: 'ar',
    slug: 'ar',
    htmlLang: 'ar',
    hreflang: 'ar',
    languageName: 'العربية',
    selectorLabel: 'اللغة',
    rtl: true,
  },
];

const ROUTES = [
  { key: 'home', segments: [] },
  { key: 'work', segments: ['work'] },
  { key: 'ai-systems', segments: ['work', 'ai-systems'] },
];

function printUsage() {
  console.log(`Usage:
  node add-i18n-seo.mjs [--site-root PATH] [--origin URL] [--lastmod YYYY-MM-DD]
  node add-i18n-seo.mjs [--site-root PATH] [--origin URL] [--lastmod YYYY-MM-DD] --validate-only

Defaults:
  --site-root ${DEFAULT_SITE_ROOT}
  --origin    https://alekseibalchunas.com

The normal run requires all 36 HTML files before it writes anything.`);
}

function parseArgs(argv) {
  const options = {
    siteRoot: DEFAULT_SITE_ROOT,
    origin: 'https://alekseibalchunas.com',
    lastmod: null,
    validateOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--site-root') {
      const value = argv[index + 1];
      if (!value) throw new Error('--site-root requires a path');
      options.siteRoot = path.resolve(value);
      index += 1;
    } else if (arg === '--origin') {
      const value = argv[index + 1];
      if (!value) throw new Error('--origin requires a URL');
      options.origin = value.replace(/\/+$/, '');
      index += 1;
    } else if (arg === '--validate-only') {
      options.validateOnly = true;
    } else if (arg === '--lastmod') {
      const value = argv[index + 1];
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error('--lastmod requires YYYY-MM-DD');
      }
      options.lastmod = value;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  const parsedOrigin = new URL(options.origin);
  if (!['http:', 'https:'].includes(parsedOrigin.protocol)) {
    throw new Error('--origin must use http or https');
  }
  options.origin = parsedOrigin.origin + parsedOrigin.pathname.replace(/\/+$/, '');
  return options;
}

function routeSuffix(route) {
  return route.segments.length > 0 ? `${route.segments.join('/')}/` : '';
}

function localePrefix(locale) {
  return locale.slug ? `${locale.slug}/` : '';
}

function publicPath(locale, route) {
  return `/${localePrefix(locale)}${routeSuffix(route)}`;
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
      href: publicPath(locale, route),
    })),
  );
}

function duplicates(values) {
  const seen = new Set();
  const duplicateValues = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicateValues.add(value);
    seen.add(value);
  }
  return [...duplicateValues];
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
  const found = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await walkHtml(fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      found.push(fullPath);
    }
  }
  return found.sort();
}

async function preflight(siteRoot, pages) {
  const missing = [];
  for (const page of pages) {
    if (!(await exists(page.file))) missing.push(page.file);
  }

  const allHtml = await walkHtml(siteRoot);
  const expectedSet = new Set(pages.map((page) => path.resolve(page.file)));
  const unexpected = allHtml.filter((file) => !expectedSet.has(path.resolve(file)));
  const duplicateFiles = duplicates(pages.map((page) => path.resolve(page.file)));
  const duplicateUrls = duplicates(pages.map((page) => page.url));

  console.log(
    `PREFLIGHT expected=36 found=${pages.length - missing.length} missing=${missing.length} ` +
      `duplicates=${duplicateFiles.length + duplicateUrls.length} unexpected_html=${unexpected.length}`,
  );

  for (const file of missing) console.error(`MISSING ${file}`);
  for (const file of duplicateFiles) console.error(`DUPLICATE_FILE ${file}`);
  for (const url of duplicateUrls) console.error(`DUPLICATE_URL ${url}`);
  for (const file of unexpected) console.log(`UNEXPECTED_HTML ${file}`);

  return {
    ok: missing.length === 0 && duplicateFiles.length === 0 && duplicateUrls.length === 0,
    missing,
    unexpected,
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", '&apos;');
}

function getAttribute(tag, attribute) {
  const escapedName = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(
    new RegExp(`\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
  );
  return match ? match[1] ?? match[2] ?? match[3] ?? '' : null;
}

function relTokens(tag) {
  return (getAttribute(tag, 'rel') ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function removeManagedBlock(html, start, end) {
  const escapedStart = start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(
    new RegExp(`\\s*${escapedStart}[\\s\\S]*?${escapedEnd}\\s*`, 'gi'),
    '\n',
  );
}

function removeConflictingLinks(html) {
  return html.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = relTokens(tag);
    const href = getAttribute(tag, 'href');
    const isCanonical = rel.includes('canonical');
    const isHreflangAlternate = rel.includes('alternate') && getAttribute(tag, 'hreflang') !== null;
    const isManagedStylesheet =
      rel.includes('stylesheet') &&
      href !== null &&
      /(?:^|\/)i18n-style\.css(?:[?#].*)?$/i.test(href);
    return isCanonical || isHreflangAlternate || isManagedStylesheet ? '' : tag;
  });
}

function updateHtmlElement(html, locale) {
  if (!/<html\b[^>]*>/i.test(html)) {
    throw new Error('Missing <html> element');
  }
  return html.replace(/<html\b([^>]*)>/i, (_full, rawAttributes) => {
    const remaining = rawAttributes
      .replace(/\s+(?:lang|dir)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .trim();
    const attributes = [
      `lang="${escapeHtml(locale.htmlLang)}"`,
      locale.rtl ? 'dir="rtl"' : '',
      remaining,
    ].filter(Boolean);
    return `<html ${attributes.join(' ')}>`;
  });
}

function alternateCluster(origin, route) {
  const links = LOCALES.map(
    (locale) =>
      `<link rel="alternate" hreflang="${escapeHtml(locale.hreflang)}" href="${escapeHtml(
        publicUrl(origin, locale, route),
      )}">`,
  );
  links.push(
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(
      publicUrl(origin, LOCALES[0], route),
    )}">`,
  );
  return links;
}

function headBlock(origin, locale, route) {
  return [
    HEAD_START,
    `<link rel="canonical" href="${escapeHtml(publicUrl(origin, locale, route))}">`,
    '<link rel="stylesheet" href="/i18n-style.css">',
    ...alternateCluster(origin, route),
    HEAD_END,
  ].join('\n');
}

function languageSwitcher(currentLocale, route) {
  const links = LOCALES.map((locale) => {
    const active = locale.key === currentLocale.key;
    return [
      '      <li class="language-switcher__item">',
      `        <a class="language-switcher__link${active ? ' is-active' : ''}" ` +
        `href="${escapeHtml(publicPath(locale, route))}" ` +
        `hreflang="${escapeHtml(locale.hreflang)}" lang="${escapeHtml(locale.htmlLang)}" ` +
        `dir="auto"${active ? ' aria-current="page"' : ''}>${escapeHtml(
          locale.languageName,
        )}</a>`,
      '      </li>',
    ].join('\n');
  });

  return [
    SWITCHER_START,
    `<aside class="language-switcher" aria-label="${escapeHtml(currentLocale.selectorLabel)}">`,
    '  <div class="language-switcher__inner">',
    `    <span class="language-switcher__label">${escapeHtml(
      currentLocale.selectorLabel,
    )}</span>`,
    '    <ul class="language-switcher__list">',
    ...links,
    '    </ul>',
    '  </div>',
    '</aside>',
    SWITCHER_END,
  ].join('\n');
}

function insertBeforeClosingHead(html, block) {
  if (!/<\/head>/i.test(html)) throw new Error('Missing </head>');
  return html.replace(/\s*<\/head>/i, `\n${block}\n</head>`);
}

function insertSwitcher(html, block) {
  if (/<footer\b/i.test(html)) {
    return html.replace(/\s*<footer\b/i, `\n\n${block}\n\n<footer`);
  }
  if (!/<\/body>/i.test(html)) throw new Error('Missing </body>');
  return html.replace(/\s*<\/body>/i, `\n\n${block}\n</body>`);
}

function transformHtml(source, origin, locale, route) {
  let html = source;
  html = removeManagedBlock(html, HEAD_START, HEAD_END);
  html = removeManagedBlock(html, SWITCHER_START, SWITCHER_END);
  html = removeConflictingLinks(html);
  html = updateHtmlElement(html, locale);
  html = insertBeforeClosingHead(html, headBlock(origin, locale, route));
  html = insertSwitcher(html, languageSwitcher(locale, route));
  return html.endsWith('\n') ? html : `${html}\n`;
}

async function atomicWrite(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.i18n-tmp`;
  await writeFile(temporary, content, 'utf8');
  await rename(temporary, file);
}

function buildSitemap(origin, lastmod) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];

  for (const route of ROUTES) {
    const alternates = LOCALES.map((locale) => ({
      hreflang: locale.hreflang,
      href: publicUrl(origin, locale, route),
    }));
    alternates.push({
      hreflang: 'x-default',
      href: publicUrl(origin, LOCALES[0], route),
    });

    for (const locale of LOCALES) {
      lines.push('  <url>');
      lines.push(`    <loc>${escapeXml(publicUrl(origin, locale, route))}</loc>`);
      if (lastmod) lines.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
      for (const alternate of alternates) {
        lines.push(
          `    <xhtml:link rel="alternate" hreflang="${escapeXml(
            alternate.hreflang,
          )}" href="${escapeXml(alternate.href)}" />`,
        );
      }
      lines.push('  </url>');
    }
  }

  lines.push('</urlset>');
  return `${lines.join('\n')}\n`;
}

function linkTags(html) {
  return html.match(/<link\b[^>]*>/gi) ?? [];
}

function countLiteral(source, literal) {
  return source.split(literal).length - 1;
}

function expectedAlternateMap(origin, route) {
  const map = new Map(
    LOCALES.map((locale) => [locale.hreflang, publicUrl(origin, locale, route)]),
  );
  map.set('x-default', publicUrl(origin, LOCALES[0], route));
  return map;
}

function checkMap(actualEntries, expected, context, errors) {
  const actual = new Map();
  const codes = [];
  for (const [code, href] of actualEntries) {
    codes.push(code);
    if (!actual.has(code)) actual.set(code, href);
  }

  for (const code of duplicates(codes)) {
    errors.push(`${context}: duplicate hreflang ${code}`);
  }
  for (const [code, href] of expected) {
    if (!actual.has(code)) {
      errors.push(`${context}: missing hreflang ${code}`);
    } else if (actual.get(code) !== href) {
      errors.push(`${context}: hreflang ${code} expected ${href}, got ${actual.get(code)}`);
    }
  }
  for (const code of actual.keys()) {
    if (!expected.has(code)) errors.push(`${context}: unexpected hreflang ${code}`);
  }
}

async function validatePages(pages, origin) {
  const errors = [];
  const metrics = {
    pages: 0,
    canonicalLinks: 0,
    canonicalMissing: 0,
    canonicalDuplicatePages: 0,
    canonicalMismatch: 0,
    alternateLinks: 0,
    alternateMissing: 0,
    alternateDuplicatePages: 0,
    switcherLinks: 0,
    switcherMissing: 0,
    switcherDuplicatePages: 0,
    langMismatch: 0,
    rtlMismatch: 0,
    styleMissing: 0,
  };

  for (const page of pages) {
    const html = await readFile(page.file, 'utf8');
    metrics.pages += 1;

    if (countLiteral(html, HEAD_START) !== 1 || countLiteral(html, HEAD_END) !== 1) {
      errors.push(`${page.file}: managed head markers must occur exactly once`);
    }
    if (
      countLiteral(html, SWITCHER_START) !== 1 ||
      countLiteral(html, SWITCHER_END) !== 1
    ) {
      errors.push(`${page.file}: switcher markers must occur exactly once`);
    }

    const links = linkTags(html);
    const canonical = links.filter((tag) => relTokens(tag).includes('canonical'));
    metrics.canonicalLinks += canonical.length;
    if (canonical.length === 0) metrics.canonicalMissing += 1;
    if (canonical.length > 1) metrics.canonicalDuplicatePages += 1;
    if (canonical.length !== 1) {
      errors.push(`${page.file}: expected one canonical, got ${canonical.length}`);
    } else if (getAttribute(canonical[0], 'href') !== page.url) {
      metrics.canonicalMismatch += 1;
      errors.push(
        `${page.file}: canonical expected ${page.url}, got ${getAttribute(canonical[0], 'href')}`,
      );
    }

    const alternates = links.filter(
      (tag) => relTokens(tag).includes('alternate') && getAttribute(tag, 'hreflang') !== null,
    );
    metrics.alternateLinks += alternates.length;
    const alternateEntries = alternates.map((tag) => [
      getAttribute(tag, 'hreflang'),
      getAttribute(tag, 'href'),
    ]);
    const alternateCodes = alternateEntries.map(([code]) => code);
    const expectedAlternates = expectedAlternateMap(origin, page.route);
    const missingCount = [...expectedAlternates.keys()].filter(
      (code) => !alternateCodes.includes(code),
    ).length;
    metrics.alternateMissing += missingCount;
    if (duplicates(alternateCodes).length > 0) metrics.alternateDuplicatePages += 1;
    checkMap(alternateEntries, expectedAlternates, `${page.file} head`, errors);

    const switcherMatch = html.match(
      /<!-- i18n-switcher:start -->([\s\S]*?)<!-- i18n-switcher:end -->/i,
    );
    if (!switcherMatch) {
      metrics.switcherMissing += LOCALES.length;
      errors.push(`${page.file}: missing language switcher block`);
    } else {
      const anchors = switcherMatch[1].match(/<a\b[^>]*>/gi) ?? [];
      metrics.switcherLinks += anchors.length;
      const hrefs = anchors.map((tag) => getAttribute(tag, 'href'));
      const expectedHrefs = LOCALES.map((locale) => publicPath(locale, page.route));
      metrics.switcherMissing += expectedHrefs.filter((href) => !hrefs.includes(href)).length;
      if (duplicates(hrefs).length > 0) metrics.switcherDuplicatePages += 1;
      if (anchors.length !== LOCALES.length) {
        errors.push(`${page.file}: expected 12 switcher links, got ${anchors.length}`);
      }
      for (const href of expectedHrefs) {
        if (!hrefs.includes(href)) errors.push(`${page.file}: switcher missing ${href}`);
      }
      for (const href of duplicates(hrefs)) {
        errors.push(`${page.file}: switcher duplicate ${href}`);
      }
      const currentLinks = anchors.filter(
        (tag) => getAttribute(tag, 'aria-current') === 'page',
      );
      if (
        currentLinks.length !== 1 ||
        getAttribute(currentLinks[0] ?? '', 'href') !== page.href
      ) {
        errors.push(`${page.file}: switcher must mark only ${page.href} as current`);
      }
    }

    const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? '';
    if (getAttribute(htmlTag, 'lang') !== page.locale.htmlLang) {
      metrics.langMismatch += 1;
      errors.push(
        `${page.file}: html lang expected ${page.locale.htmlLang}, got ${getAttribute(
          htmlTag,
          'lang',
        )}`,
      );
    }
    const actualDir = getAttribute(htmlTag, 'dir');
    if ((page.locale.rtl && actualDir !== 'rtl') || (!page.locale.rtl && actualDir !== null)) {
      metrics.rtlMismatch += 1;
      errors.push(`${page.file}: unexpected html dir=${actualDir}`);
    }

    const styles = links.filter(
      (tag) =>
        relTokens(tag).includes('stylesheet') &&
        getAttribute(tag, 'href') === '/i18n-style.css',
    );
    if (styles.length !== 1) {
      metrics.styleMissing += styles.length === 0 ? 1 : 0;
      errors.push(`${page.file}: expected one /i18n-style.css link, got ${styles.length}`);
    }
  }

  console.log(
    `VALIDATION pages count=${metrics.pages} missing=${36 - metrics.pages} duplicates=0`,
  );
  console.log(
    `VALIDATION canonical count=${metrics.canonicalLinks} missing=${metrics.canonicalMissing} ` +
      `duplicate_pages=${metrics.canonicalDuplicatePages} mismatch=${metrics.canonicalMismatch}`,
  );
  console.log(
    `VALIDATION hreflang count=${metrics.alternateLinks} missing=${metrics.alternateMissing} ` +
      `duplicate_pages=${metrics.alternateDuplicatePages}`,
  );
  console.log(
    `VALIDATION switcher count=${metrics.switcherLinks} missing=${metrics.switcherMissing} ` +
      `duplicate_pages=${metrics.switcherDuplicatePages}`,
  );
  console.log(
    `VALIDATION html lang_mismatch=${metrics.langMismatch} rtl_mismatch=${metrics.rtlMismatch} ` +
      `style_missing=${metrics.styleMissing}`,
  );

  return { errors, metrics };
}

function validateSitemap(source, pages, origin) {
  const errors = [];
  const blocks = source.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  const locs = [];
  let alternateCount = 0;
  let missingAlternates = 0;
  let duplicateAlternatePages = 0;

  if (!source.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"')) {
    errors.push('sitemap.xml: missing xmlns:xhtml');
  }

  const pageByUrl = new Map(pages.map((page) => [page.url, page]));
  for (const block of blocks) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/i)?.[1] ?? null;
    if (!loc) {
      errors.push('sitemap.xml: url block missing loc');
      continue;
    }
    locs.push(loc);
    const page = pageByUrl.get(loc);
    if (!page) {
      errors.push(`sitemap.xml: unexpected loc ${loc}`);
      continue;
    }

    const tags = block.match(/<xhtml:link\b[^>]*\/>/gi) ?? [];
    alternateCount += tags.length;
    const entries = tags.map((tag) => [
      getAttribute(tag, 'hreflang'),
      getAttribute(tag, 'href'),
    ]);
    const codes = entries.map(([code]) => code);
    const expected = expectedAlternateMap(origin, page.route);
    missingAlternates += [...expected.keys()].filter((code) => !codes.includes(code)).length;
    if (duplicates(codes).length > 0) duplicateAlternatePages += 1;
    checkMap(entries, expected, `sitemap.xml ${loc}`, errors);
  }

  const expectedUrls = pages.map((page) => page.url);
  for (const url of expectedUrls) {
    if (!locs.includes(url)) errors.push(`sitemap.xml: missing loc ${url}`);
  }
  for (const url of duplicates(locs)) errors.push(`sitemap.xml: duplicate loc ${url}`);
  if (blocks.length !== 36) {
    errors.push(`sitemap.xml: expected 36 url blocks, got ${blocks.length}`);
  }

  console.log(
    `VALIDATION sitemap urls=${blocks.length} missing=${expectedUrls.filter(
      (url) => !locs.includes(url),
    ).length} duplicates=${duplicates(locs).length} alternates=${alternateCount} ` +
      `alternate_missing=${missingAlternates} alternate_duplicate_pages=${duplicateAlternatePages}`,
  );
  return errors;
}

async function processSite(options, pages) {
  const transformed = [];
  for (const page of pages) {
    const source = await readFile(page.file, 'utf8');
    transformed.push({
      ...page,
      html: transformHtml(source, options.origin, page.locale, page.route),
    });
  }

  if (!(await exists(STYLE_SOURCE))) {
    throw new Error(`Missing shared stylesheet source: ${STYLE_SOURCE}`);
  }

  for (const page of transformed) {
    await atomicWrite(page.file, page.html);
  }
  await copyFile(STYLE_SOURCE, path.join(options.siteRoot, 'i18n-style.css'));
  await atomicWrite(
    path.join(options.siteRoot, 'sitemap.xml'),
    buildSitemap(options.origin, options.lastmod),
  );
  console.log(`WRITE pages=${transformed.length} stylesheet=1 sitemap=1`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pages = expectedPages(options.siteRoot, options.origin);
  const preflightResult = await preflight(options.siteRoot, pages);
  if (!preflightResult.ok) {
    console.error('PREFLIGHT FAIL: no files were changed');
    process.exitCode = 1;
    return;
  }

  if (!options.validateOnly) {
    await processSite(options, pages);
  } else {
    console.log('VALIDATE_ONLY no files changed');
  }

  const pageValidation = await validatePages(pages, options.origin);
  const sitemapFile = path.join(options.siteRoot, 'sitemap.xml');
  const sitemapErrors = (await exists(sitemapFile))
    ? validateSitemap(await readFile(sitemapFile, 'utf8'), pages, options.origin)
    : [`${sitemapFile}: missing sitemap.xml`];
  const styleFile = path.join(options.siteRoot, 'i18n-style.css');
  const styleErrors = (await exists(styleFile)) ? [] : [`${styleFile}: missing stylesheet`];
  const errors = [...pageValidation.errors, ...sitemapErrors, ...styleErrors];

  if (errors.length > 0) {
    console.error(`VALIDATION FAIL errors=${errors.length}`);
    for (const error of errors) console.error(`ERROR ${error}`);
    process.exitCode = 1;
  } else {
    console.log('VALIDATION PASS errors=0');
  }
}

main().catch((error) => {
  console.error(`FATAL ${error.stack ?? error.message}`);
  process.exitCode = 1;
});
