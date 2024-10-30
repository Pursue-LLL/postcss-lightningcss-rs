import test from 'ava';
import postcss from 'postcss';
import { postcssLightningcssPlugin, Features } from '../index.js';

test('添加 vendor 前缀', async t => {
  const css = `.logo {
    background: image-set(url(logo.png) 2x, url(logo.png) 1x);
  }
  `;

  const result = await postcss([postcssLightningcssPlugin({
    features: [Features.VendorPrefixes],
    targets: [">= .25%", "chrome 90"],
  })]).process(css, { from: undefined });

  const expectedCss = '.logo{background:-webkit-image-set(url(logo.png) 2x,url(logo.png) 1x);background:image-set("logo.png" 2x,"logo.png" 1x)}';

  t.is(result.css, expectedCss);
});

test('压缩 CSS', async t => {
  const css = 'body { color: blue; }';

  const result = await postcss([postcssLightningcssPlugin({
    minify: true
  })]).process(css, { from: undefined });

  const expectedCss = 'body{color:#00f}';

  t.is(result.css, expectedCss);
});
