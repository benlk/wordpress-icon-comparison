# WordPress Icon Comparison

A comparison table for WordPress' old [Dashicons](https://developer.wordpress.org/resource/dashicons/) package and the new [`@wordpress/icons`](https://github.com/WordPress/gutenberg/blob/ba141c19777e67d6fe782db665e6d52b80a973e2/packages/icons/README.md) replacement.

Created because I saw [a Make blog post about the WordPress icon overhaul](https://make.wordpress.org/core/2026/11/05/svg-icons-in-the-admin-bar-and-menu-in-wordpress-7-2/) and wanted to have a way to visually compare the two icon sets.

## Comparison methods

Data sources:

- `@wordpress/icons`' [`src/manifest.json`](https://github.com/WordPress/gutenberg/blob/trunk/packages/icons/src/manifest.json)
- Dashicons' [`codepoints.json`](https://github.com/WordPress/dashicons/blob/master/codepoints.json)` matched against [`dashicons.css`](https://github.com/WordPress/dashicons/blob/master/icon-font/css/dashicons.css) to find icon names

Some Dashicon glyphs have multiple aliases; each alias is presented in table separately. 

The table displays:

- Unmatched icons on their own rows
- Shared rows for declared mappings from `src/manifest.json`
- Shared rows where there is a match between icons' slugs, but no declared mapping. Matches are made by removing the `dashicons-` prefix, and optionally the `editor-` prefix, from the Dashicons slug.

## Source And Output

Sources:

- [Dashicons](https://github.com/WordPress/dashicons) is loaded as a submodule. 
- [`@wordpress/icons`](https://www.npmjs.com/package/@wordpress/icons) is loaded via `npm`
- `src/index.html` contains the page markup and browser JavaScript.
- `src/style.css` contains the page styles, inlined into the generated HTML at build time.
- `scripts/build.cjs` renders package exports to SVG, embeds the catalogue and page styles, and copies the compiled Dashicons CSS and fonts. 

Outputs:

- `build/index.html` contains the generated catalogue and extracted SVG markup.
- `build/assets/dashicons/` preserves the font stylesheet's relative paths.
- `build/licenses/` contains the two dependencies' licenses.
- `build/icons-version.json` records the deployed `@wordpress/icons` version.

## Build

```sh
npm install
npm run build
```

Open `build/index.html`.

For deployment, set `SITE_URL` to the site's public base URL so the Open Graph image URL is absolute. The GitHub Pages workflow supplies this automatically. Local builds without `SITE_URL` use a relative image path. The build script does not clear `build/` or delete unrelated assets.

## Updates

This _should_ update automatically when a new `@wordpress/dashicons` release is published, within a week. [The GitHub Action](./.github/workflows/update-icons.yml) to build this site runs on Saturday mornings.

The build fails for missing assets, invalid or conflicting codepoints, unexpected package exports, invalid SVG output, or missing/duplicate declared mappings.

## AI Usage

Markup and functionality were primarily handled by GitHub Copilot. Concept, visual styles, wording, and overall approach were done by Ben Keith.