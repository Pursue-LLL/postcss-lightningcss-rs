#![allow(deprecated)]
#![deny(clippy::all)]
#[cfg(target_os = "macos")]
#[global_allocator]
static GLOBAL: jemallocator::Jemalloc = jemallocator::Jemalloc;

use lightningcss::targets::Browsers;
use lightningcss_rs::transform_css;
use napi::bindgen_prelude::{Function, FunctionCallContext};
use napi::{Env, JsFunction, JsObject, JsUnknown, Result};
use napi_derive::napi;
use lightningcss_rs::types::{PluginOptions, TransformOptions};

#[napi]
/**
 * Transform CSS with general API
 */
pub fn transform(css: String, options: TransformOptions, env: Env) -> napi::Result<JsUnknown> {
  let res = transform_css(&css, &options);
  match res {
    Ok(r) => r.into_js(env),
    Err(e) => Err(napi::Error::from_reason(format!("{:?}", e))),
  }
}

#[allow(dead_code)]
#[napi]
/**
 * Export PostCSS plugin object
 */
fn postcss_lightningcss_plugin(options: PluginOptions, env: Env) -> Result<JsObject> {
  let mut plugin = env.create_object()?;

  // Use browserslist's from_browserslist method to convert targets from JS browserslist format to LightningCSS format
  // Convert only once when creating plugin, targets object can be reused later
  let targets = options.targets.unwrap_or_default();
  let targets = Browsers::from_browserslist(targets)
    .map_err(|e| napi::Error::from_reason(format!("{:?}", e)))?;

  // Convert PluginOptions to TransformOptions
  let lightningcss_options = TransformOptions {
    // Convert targets from crate to TransformOptions targets
    targets: match targets {
      Some(t) => Some(t.into()),
      None => None,
    }, // Equivalent to targets.map(Into::into)
    css_modules: options.css_modules,
    drafts: options.drafts,
    minify: options.minify,
    unused_symbols: options.unused_symbols,
    error_recovery: options.error_recovery,
    pseudo_classes: options.pseudo_classes,
    analyze_dependencies: options.analyze_dependencies,
    include: options.include,
    exclude: options.exclude,
    // NOTE: PostCSS already supports sourcemap, no need to implement again
    source_map: None,
    input_source_map: None,
    project_root: None,
    filename: None,
  };
  // Set plugin name
  plugin.set("postcssPlugin", "postcss-lightningcss")?;

  // OnceExit listener function (executes once for each file)
  let once_exit: Function<'_, JsUnknown, ()> = env.create_function_from_closure(
    "OnceExit",
    move |ctx: FunctionCallContext| -> Result<()> {
      // Get PostCSS parameters
      let (root, res): (JsObject, JsObject) = ctx.args()?;
      let mut result: JsObject = res.get_named_property("result")?;
      let postcss: JsFunction = res.get_named_property("postcss")?;
      let postcss_obj = postcss.coerce_to_object()?;

      // Call toResult method to get CSS processed by PostCSS
      let css = root
        .get_named_property::<JsFunction>("toResult")?
        .call::<JsUnknown>(Some(&root), &[])?
        .coerce_to_object()?
        .get_named_property::<String>("css")?;

      // Get transform_css result
      let transformed = transform_css(&css, &lightningcss_options)
        .map_err(|e| napi::Error::from_reason(format!("{:?}", e)))?;

      let css_code = env.create_string(&transformed.code)?;

      let mut parse_options = env.create_object()?;
      parse_options.set(
        "from",
        result
          .get_named_property::<String>("opts.from")
          .unwrap_or_default(),
      )?;

      // Call PostCSS parse method with css and parse_options, assign result to result.root
      result.set_named_property(
        "root",
        postcss_obj
          .get_named_property::<JsFunction>("parse")?
          .call::<JsUnknown>(
            None,
            &[css_code.into_unknown(), parse_options.into_unknown()],
          )?,
      )?;

      Ok(())
    },
  )?;
  plugin.set("OnceExit", once_exit)?;

  // Return plugin object
  Ok(plugin)
}

#[napi]
pub enum Features {
  Nesting = 1,
  NotSelectorList = 2,
  DirSelector = 4,
  LangSelectorList = 8,
  IsSelector = 16,
  TextDecorationThicknessPercent = 32,
  MediaIntervalSyntax = 64,
  MediaRangeSyntax = 128,
  CustomMediaQueries = 256,
  ClampFunction = 512,
  ColorFunction = 1024,
  OklabColors = 2048,
  LabColors = 4096,
  P3Colors = 8192,
  HexAlphaColors = 16384,
  SpaceSeparatedColorNotation = 32768,
  FontFamilySystemUi = 65536,
  DoublePositionGradients = 131072,
  VendorPrefixes = 262144,
  LogicalProperties = 524288,
  Selectors = 31,
  MediaQueries = 448,
  Colors = 64512,
}
