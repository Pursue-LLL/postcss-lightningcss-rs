[English](./README.md)

# @gogors/postcss-lightningcss-rs

`postcss-lightningcss-rs` 是一个`postcss`的集css压缩、转换为一身的插件，该插件使用 [lightningcss](https://lightningcss.dev/) 来编译和压缩你的 CSS。

> `lightningcss` 不仅仅是一个压缩工具，它还可以替代多个 PostCSS 插件，例如 `autoprefixer`。

该插件基于 Rust 版的 [lightningcss](https://crates.io/crates/lightningcss) 实现，封装过程完全使用 Rust 编写。

## 安装

```bash
yarn add -D @gogors/postcss-lightningcss-rs
```

## 使用方法

```javascript
const postcss = require("postcss");
import { postcssLightningcssPlugin } from "@gogors/postcss-lightningcss-rs";

postcss([postcssLightningcssPlugin(/* pluginOptions */)];
```

## 选项

```javascript
import { postcssLightningcssPlugin, Features } from "@gogors/postcss-lightningcss-rs";

postcssLightningcss({
  // 启用压缩（默认：true）
  minify: true,

  // 标记未使用的符号，会在压缩时移除
  unusedSymbols: ['foo', 'fade-in', '--color'],

  // 使用 browserslist 查询来指定支持哪些浏览器，以及要编译哪些特性
  targets: [">= .25%", "chrome 90"],
    // 即使目标支持，始终编译简化颜色和 CSS 嵌套。
  include: Features.Colors | Features.Nesting,
  // 即使目标不支持，也不要添加任何供应商前缀。
  exclude: Features.VendorPrefixes

  // true 启用所有文件的 CSS 模块，默认：false
  cssModules: true,

  // 单独启用各种css草案语法
  drafts: {
    // 启用自定义媒体查询（默认：false）
    customMedia: false,
    // 启用深选择器组合器（默认：false） 启用解析 Vue/Angular >>> 和 /deep/ 选择器运算符。
    deepSelectorCombinator: false,
  },

  // 是否忽略无效的规则和声明，而不是报错。启用后，将返回警告，并将无效的规则或声明从输出代码中省略。
  errorRecovery: false,

  // 用 JavaScript 可以应用的类名替换用户操作伪类。
  pseudoClasses: PseudoClasses,

});
```

### Feature flags

include 和 exclude 选项允许明确开启或关闭某些功能。*这些选项会覆盖基于提供的浏览器目标设置的默认值*。例如，你可能只想编译颜色，并使用其他工具处理自动前缀或其他功能。或者，你可能想使用 Lightning CSS 处理除供应商前缀之外的所有内容。

include 和 exclude 选项使用 Features 枚举进行配置，可以从 lightningcss 导入。可以将多个标志进行位或操作以打开或关闭。

```javascript
import { postcssLightningcssPlugin, Features } from '@gogors/postcss-lightningcss-rs';

let { code } = postcssLightningcssPlugin({
  // ...
  targets: [">= .25%", "chrome 90"],
  include: Features.Colors | Features.Nesting,
  exclude: Features.VendorPrefixes
});
```

[更多 features flags](https://lightningcss.dev/transpilation.html#feature-flags)

### unusedSymbols

如果知道某些类名、ID、 @keyframes 规则、CSS 变量或其他 CSS 标识符未使用，可以使用 unusedSymbols 选项来删除它们。

```javascript
let { code } = postcssLightningcssPlugin({
  // ...
  minify: true,
  unusedSymbols: ['foo', 'fade-in', '--color']
});
```

使用此配置，以下 CSS：

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

压缩为:

```css
.bar{color:green}
```

### Pseudo class replacement

Lightning CSS 支持用普通 CSS 类替换 CSS 伪类，如 :focus-visible ，这些类可以使用 JavaScript 操作。

```javascript
let { code, map } = transform({
  // ...
  pseudoClasses: {
    focusVisible: 'focus-visible'
  }
});
```

以上配置将会替换所有选择器中的 :focus-visible 伪类为 .focus-visible 类。

以下伪类可以按照上述方式配置：

- hover – 对应于 :hover 伪类
- active – 对应于 :active 伪类
- focus – 对应于 :focus 伪类
- focusVisible – 对应于 :focus-visible 伪类
- focusWithin – 对应于 :focus-within 伪类

### CSS modules

启用 CSS 模块

```javascript
postcssLightningcss({
  cssModules: true,
});
```

还可以将其与[自定义命名模式](https://lightningcss.dev/css-modules.html#custom-naming-patterns)结合使用：

```javascript
postcssLightningcss({
  cssModules: {
    pattern: "my-company-[name]-[hash]-[local]",
  },
});
```

[更多配置](https://lightningcss.dev/css-modules.html)

## 使用该插件后可以移除的 PostCSS 插件

| PostCSS 插件                           | lightningcss 选项                       |
| -------------------------------------- | --------------------------------------- |
| `autoprefixer`                         | 取决于targets配置                        |
| `postcss-clamp`                        | 取决于targets配置                        |
| `postcss-color-hex-alpha`              | 取决于targets配置                        |
| `postcss-color-hsl`                    | 取决于targets配置                        |
| `postcss-color-rgb`                    | 取决于targets配置                        |
| `postcss-color-function`               | 取决于targets配置                        |
| `postcss-color-rebeccapurple`          | 取决于targets配置                        |
| `postcss-custom-media`                 | `options.drafts.customMedia` |
| `postcss-double-position-gradients`    | 取决于targets配置                        |
| `postcss-hwb-function`                 | 取决于targets配置                        |
| `postcss-lab-function`                 | 取决于targets配置                        |
| `postcss-logical`                      | 取决于targets配置 (1)                    |
| `postcss-media-minmax`                 | 取决于targets配置                        |
| `postcss-multi-value-display`          | 取决于targets配置                        |
| `postcss-nesting`                      | 取决于targets配置                              |
| `postcss-normalize-display-values`     | 取决于targets配置                        |
| `postcss-oklab-function`               | 取决于targets配置                        |
| `postcss-overflow-shorthand`           | 取决于targets配置                        |
| `postcss-place`                        | 取决于targets配置                        |
| `postcss-progressive-custom-properties`| 取决于targets配置 (2)                    |
