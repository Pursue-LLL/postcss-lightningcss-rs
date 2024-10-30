# postcss-lightningcss-rs

`postcss-lightningcss-rs` is a PostCSS plugin that combines CSS compression and transformation using [lightningcss](https://lightningcss.dev/) to compile and minify your CSS.

> `lightningcss` is more than just a minifier; it can replace several PostCSS plugins such as `autoprefixer`.

This plugin is implemented based on the Rust version of [lightningcss](https://crates.io/crates/lightningcss), with the entire wrapping process written in Rust.

## Installation

```bash
yarn add -D postcss-lightningcss-rs
```

## Usage

```javascript
const postcss = require("postcss");
import { postcssLightningcssPlugin } from "postcss-lightningcss-rs";

postcss([postcssLightningcssPlugin(/* pluginOptions */)]);
```

## Options

```javascript
import { postcssLightningcssPlugin, Features } from "postcss-lightningcss-rs";

postcssLightningcss({
  // Enable minification (default: true)
  minify: true,

  // Mark unused symbols, which will be removed during minification
  unusedSymbols: ['foo', 'fade-in', '--color'],

  // Use a browserslist query to specify which browsers are supported and which features to compile
  targets: [">= .25%", "chrome 90"],
  // Always compile colors and CSS nesting even if the target supports them
  include: Features.Colors | Features.Nesting,
  // Do not add any vendor prefixes even if the target does not support them
  exclude: Features.VendorPrefixes,

  // Enable CSS modules for all files, default: false
  cssModules: true,

  // Individually enable various CSS draft syntaxes
  drafts: {
    // Enable CSS nesting (default: false)
    nesting: false,
    // Enable custom media queries (default: false)
    customMedia: false,
    // Enable deep selector combinator (default: false) to parse Vue/Angular >>> and /deep/ selector operators
    deepSelectorCombinator: false,
  },

  // Whether to ignore invalid rules and declarations instead of throwing an error. If enabled, warnings will be returned, and invalid rules or declarations will be omitted from the output code.
  errorRecovery: false,

  // Replace user action pseudo-classes with class names that can be applied with JavaScript.
  pseudoClasses: PseudoClasses,
});
```

### Feature flags

The `include` and `exclude` options allow you to explicitly enable or disable certain features. These options override the defaults set based on the provided browser targets. For example, you might want to compile only colors and use other tools for autoprefixing or other features. Or, you might want to use Lightning CSS to handle everything except vendor prefixes.

The `include` and `exclude` options are configured using the `Features` enum, which can be imported from lightningcss. Multiple flags can be combined using bitwise OR operations to enable or disable them.

```javascript
import { postcssLightningcssPlugin, Features } from 'postcss-lightningcss-rs';

let { code } = postcssLightningcssPlugin({
  // ...
  targets: [">= .25%", "chrome 90"],

  include: Features.Colors | Features.Nesting,
  exclude: Features.VendorPrefixes
});
```

[More flags](https://lightningcss.dev/transpilation.html#feature-flags)

### unusedSymbols

If you know certain class names, IDs, @keyframes rules, CSS variables, or other CSS identifiers are unused, you can use the `unusedSymbols` option to remove them.

```javascript
let { code } = postcssLightningcssPlugin({
  // ...
  minify: true,
  unusedSymbols: ['foo', 'fade-in', '--color']
});
```

With this configuration, the following CSS:

```css
:root {
  --color: red;
}

.foo {
  color: var(--color);
}

@keyframes fade-in {
  from { opacity: 0 }
  to { opacity: 1 }
}

.bar {
  color: green;
}
```

is compressed to:

```css
.bar{color:green}
```

### Pseudo class replacement

Lightning CSS supports replacing CSS pseudo-classes with regular CSS classes, such as :focus-visible, which can be manipulated with JavaScript.

```javascript
let { code, map } = transform({
  // ...
  pseudoClasses: {
    focusVisible: 'focus-visible'
  }
});
```

The above configuration will replace all occurrences of the :focus-visible pseudo-class with the .focus-visible class.

The following pseudo-classes can be configured in the same way:

- hover – corresponds to the :hover pseudo-class
- active – corresponds to the :active pseudo-class
- focus – corresponds to the :focus pseudo-class
- focusVisible – corresponds to the :focus-visible pseudo-class
- focusWithin – corresponds to the :focus-within pseudo-class

### CSS modules

Enable CSS modules

```javascript
postcssLightningcss({
  cssModules: true,
});
```

You can also combine this with [custom naming patterns](https://lightningcss.dev/css-modules.html#custom-naming-patterns):

```javascript
postcssLightningcss({
  cssModules: {
    pattern: "my-company-[name]-[hash]-[local]",
  },
});
```

[More configuration](https://lightningcss.dev/css-modules.html)

## PostCSS plugins that can be removed if you have `lightningcss`

| PostCSS Plugin                          | lightningcss option                      |
| --------------------------------------- | ---------------------------------------- |
| `autoprefixer`                          | Depends on targets configuration         |
| `postcss-clamp`                         | Depends on targets configuration         |
| `postcss-color-hex-alpha`               | Depends on targets configuration         |
| `postcss-color-hsl`                     | Depends on targets configuration         |
| `postcss-color-rgb`                     | Depends on targets configuration         |
| `postcss-color-function`                | Depends on targets configuration         |
| `postcss-color-rebeccapurple`           | Depends on targets configuration         |
| `postcss-custom-media`                  | `options.drafts.customMedia`             |
| `postcss-double-position-gradients`     | Depends on targets configuration         |
| `postcss-hwb-function`                  | Depends on targets configuration         |
| `postcss-lab-function`                  | Depends on targets configuration         |
| `postcss-logical`                       | Depends on targets configuration         |
| `postcss-media-minmax`                  | Depends on targets configuration         |
| `postcss-multi-value-display`           | Depends on targets configuration         |
| `postcss-nesting`                       | `options.drafts.nesting`                 |
| `postcss-normalize-display-values`      | Depends on targets configuration         |
| `postcss-oklab-function`                | Depends on targets configuration         |
| `postcss-overflow-shorthand`            | Depends on targets configuration         |
| `postcss-place`                         | Depends on targets configuration         |
| `postcss-progressive-custom-properties` | Depends on targets configuration         |
