const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createElement, isValidElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const wordpress = require('@wordpress/icons');
const { paramCase } = require('change-case');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build');
const packageRoot = path.dirname(require.resolve('@wordpress/icons/package.json'));
const readJson = async (filename) => JSON.parse(await fs.readFile(filename, 'utf8'));

async function build() {
    const [template, stylesheet, codepoints, dashiconsCss, manifest, wordpressPackage, dashiconsPackage] = await Promise.all([
        fs.readFile(path.join(root, 'src/index.html'), 'utf8'),
        fs.readFile(path.join(root, 'src/style.css'), 'utf8'),
        readJson(path.join(root, 'dashicons/codepoints.json')),
        fs.readFile(path.join(root, 'dashicons/icon-font/css/dashicons.css'), 'utf8'),
        readJson(path.join(packageRoot, 'src/manifest.json')),
        readJson(path.join(packageRoot, 'package.json')),
        readJson(path.join(root, 'dashicons/package.json')),
    ]);
    const marker = '/* ICON_CATALOGUE */ null';
    const buildMarker = '<!-- BUILD_DETAILS -->';
    const styleMarker = '<link rel="stylesheet" href="style.css">';
    assert.equal(template.split(marker).length, 2, 'Expected exactly one catalogue placeholder');
    assert.equal(template.split(buildMarker).length, 2, 'Expected exactly one build details placeholder');
    assert.equal(template.split(styleMarker).length, 2, 'Expected exactly one stylesheet link');
    const metadata = new Map(manifest.map((entry) => [entry.slug, entry]));
    const glyphRules = /\.dashicons-([a-z0-9-]+)::?before\s*\{\s*content:\s*["']\\([0-9a-f]+)["'];?\s*\}/gi;
    for (const [, name, hexadecimal] of dashiconsCss.matchAll(glyphRules)) {
        const codepoint = Number.parseInt(hexadecimal, 16);
        if (Object.hasOwn(codepoints, name)) {
            assert.equal(codepoint, codepoints[name], `Conflicting CSS codepoint: ${name}`);
        }
        codepoints[name] = codepoint;
    }
    const dashicons = Object.entries(codepoints).map(([name, codepoint]) => {
        assert(Number.isInteger(codepoint) && codepoint > 0 && codepoint <= 0x10ffff, `Invalid codepoint: ${name}`);
        return { name, codepoint };
    });
    const dashiconNames = new Set(dashicons.map((icon) => icon.name));
    const mappedNames = new Set();
    const icons = [];

    for (const [name, element] of Object.entries(wordpress)) {
        if (name === 'Icon') continue;
        assert(isValidElement(element), `Unexpected non-icon export: ${name}`);
        const slug = paramCase(name);
        const entry = metadata.get(slug);
        const replacements = (entry?.dashicons || []).map((value) => {
            assert(value.startsWith('dashicons-'), `Invalid Dashicons class: ${value}`);
            const dashicon = value.slice('dashicons-'.length);
            assert(dashiconNames.has(dashicon), `Unknown mapped Dashicon: ${value}`);
            assert(!mappedNames.has(dashicon), `Duplicate replacement for ${value}`);
            mappedNames.add(dashicon);
            return dashicon;
        });
        const svg = renderToStaticMarkup(createElement(wordpress.Icon, {
            icon: element, size: 24, fill: 'currentColor', 'aria-hidden': true, focusable: 'false',
        }));
        assert(svg.startsWith('<svg') && svg.endsWith('</svg>') && svg.includes('viewBox='), `Invalid SVG: ${name}`);
        icons.push({ name, slug, label: entry?.label || slug.replaceAll('-', ' '), keywords: entry?.keywords || [], replacements, svg });
    }

    assert(dashicons.length > 0 && icons.length > 0, 'Both libraries must contain icons');
    for (const entry of manifest) {
        if (entry.dashicons?.length) {
            assert(icons.some((icon) => icon.slug === entry.slug), `Mapped icon has no package export: ${entry.slug}`);
        }
    }
    const catalogue = {
        versions: { dashicons: dashiconsPackage.version, wordpress: wordpressPackage.version },
        dashicons, wordpress: icons,
    };
    const json = JSON.stringify(catalogue).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
    const builtAt = new Date();
    const formattedDate = new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium', timeStyle: 'long', timeZone: 'UTC',
    }).format(builtAt);
    const buildDetails = renderToStaticMarkup(createElement('span', null,
        `Built `,
        createElement('time', { dateTime: builtAt.toISOString() }, formattedDate),
        ` using `,
        `@wordpress/icons v${wordpressPackage.version}`
    ));
    const html = template.replace(marker, () => json)
        .replace(buildMarker, () => buildDetails)
        .replace(styleMarker, () => `<style>\n${stylesheet}\n</style>`);
    const assets = path.join(output, 'assets');
    await fs.mkdir(path.join(assets, 'dashicons/css'), { recursive: true });
    await fs.mkdir(path.join(assets, 'dashicons/fonts'), { recursive: true });
    await fs.mkdir(path.join(output, 'licenses'), { recursive: true });
    await Promise.all([
        fs.copyFile(path.join(root, 'dashicons/icon-font/css/dashicons.css'), path.join(assets, 'dashicons/css/dashicons.css')),
        ...['eot', 'ttf', 'woff2'].map((extension) => fs.copyFile(
            path.join(root, `dashicons/icon-font/fonts/dashicons.${extension}`),
            path.join(assets, `dashicons/fonts/dashicons.${extension}`),
        )),
        fs.copyFile(path.join(root, 'dashicons/LICENSE'), path.join(output, 'licenses/dashicons.txt')),
        fs.copyFile(path.join(packageRoot, 'LICENSE.md'), path.join(output, 'licenses/wordpress-icons.txt')),
    ]);
    await fs.writeFile(path.join(output, 'index.html'), html);
    await fs.writeFile(path.join(output, 'icons-version.json'), `${JSON.stringify({ wordpressIcons: wordpressPackage.version })}\n`);
    console.log(`Built ${dashicons.length} Dashicons and ${icons.length} WordPress icons (${mappedNames.size} mapped Dashicons).`);
    console.log('Open build/index.html in your browser.');
}

build().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});