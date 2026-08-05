# Multilingual site maintenance

The public site contains 36 indexable HTML pages: 12 locales across the home,
`/work/`, and `/work/ai-systems/` route families. English uses the root paths.
Localized pages use `/ru/`, `/es/`, `/pt-br/`, `/de/`, `/fr/`, `/it/`, `/ja/`,
`/ko/`, `/zh-hans/`, `/zh-hant/`, and `/ar/`.

The translated HTML files are source content. Edit those files directly and
keep the same route structure, factual claims, offer price, and diagnostic cap
as the English pages. English-only resources must remain labeled as English.

After any content edit, run the postprocessor from the repository root with
Node 18 or newer:

```sh
node scripts/i18n/add-i18n-seo.mjs --site-root . --lastmod YYYY-MM-DD
node scripts/i18n/add-i18n-seo.mjs --site-root . --lastmod YYYY-MM-DD --validate-only
node scripts/i18n/validate-i18n-content.mjs --site-root .
```

The postprocessor owns the self-canonicals, reciprocal hreflang clusters,
same-route language switchers, shared multilingual CSS, and sitemap. It is
idempotent and requires all 36 HTML files before writing.

Both validators must pass before publishing. The content validator is
read-only and checks metadata, localized URLs, JSON-LD, local links, anchors,
offer invariants, technical class/id parity, placeholders, and prohibited
public-copy punctuation.
