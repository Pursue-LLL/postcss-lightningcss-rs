import test from 'ava';
import postcss from 'postcss';
import { postcssLightningcssPlugin, Features } from '../index.js';

test('Add vendor prefixes', async t => {
  const css = `.logo {
    background: image-set(url(logo.png) 2x, url(logo.png) 1x);
  }
  `;

  const result = await postcss([postcssLightningcssPlugin({
    include: Features.VendorPrefixes,
    targets: [">= .25%", "chrome 90"],
  })]).process(css, { from: undefined });

  const expectedCss = '.logo{background:-webkit-image-set(url(logo.png) 2x,url(logo.png) 1x);background:-moz-image-set(url(logo.png) 2x,url(logo.png) 1x);background:-o-image-set(url(logo.png) 2x,url(logo.png) 1x);background:image-set("logo.png" 2x,"logo.png" 1x)}';

  t.is(result.css, expectedCss);
});

test('Minify CSS', async t => {
  const css = 'body { color: blue; }';

  const result = await postcss([postcssLightningcssPlugin({
  })]).process(css, { from: undefined });

  const expectedCss = 'body{color:#00f}';

  t.is(result.css, expectedCss);
});

test('Nesting', async t => {
  const css = `
  .container {
  width: 100%;
  & > .child {
      color: blue;
  }
      .aaa {
      color: red;
  }
}
  `;

  const result = await postcss([postcssLightningcssPlugin({
    minify: true,
    targets: ['iOS >= 8'], // Requires compilation as nesting is not supported
  })]).process(css, { from: undefined });

  const expectedCss = '.container{width:100%}.container>.child{color:#00f}.container .aaa{color:red}';

  t.is(result.css, expectedCss);
});