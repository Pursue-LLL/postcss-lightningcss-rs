pub mod types;
pub mod util;

use lightningcss::{dependencies::DependencyOptions, targets::Features};
use parcel_sourcemap::SourceMap;
use types::{TransformBrowsers, TransformOptions};
use util::drafts_to_parser_flags;
use lightningcss::{
  stylesheet::{MinifyOptions, ParserOptions, PrinterOptions, StyleSheet},
  targets::{Browsers, Targets},
};

use crate::types::{CompileError, CssModulesOption, DraftsOptions, TransformResult};
pub fn transform_css<'i>(
  css: &'i str,
  options: &'i TransformOptions,
) -> Result<TransformResult, CompileError<'i>> {
  let filename = options.filename.clone().unwrap_or_default();
  let project_root = options.project_root.as_deref();

  // Parse CSS
  let mut stylesheet = StyleSheet::parse(
    css,
    ParserOptions {
      error_recovery: options.error_recovery.unwrap_or_default(),
      flags: drafts_to_parser_flags(options.drafts.as_ref().unwrap_or(&DraftsOptions::default())),
      css_modules: if let Some(css_modules) = &options.css_modules {
        match css_modules {
          CssModulesOption::Bool(true) => Some(lightningcss::css_modules::Config::default()),
          CssModulesOption::Bool(false) => None,
          CssModulesOption::Config(c) => {
            match c.try_into() {
              Ok(config) => Some(config),
              Err(e) => return Err(e), // Capture and return error
            }
          }
        }
      } else {
        None
      },
      filename: filename.clone(),
      source_index: 0,
      ..ParserOptions::default()
    },
  )
  .map_err(|e| CompileError::ParseError(e))?;

  // Set target browsers
  // For performance, reuse the same targets object for each transform call, so targets object needs to be built externally
  let targets = Targets {
    browsers: Some(Browsers::from(
      options
        .targets
        .as_ref()
        .unwrap_or(&TransformBrowsers::default()),
    )),
    // Basic type copy conversion has low overhead, can use transmute for lossless conversion, but since lightningcss's targets browser cannot specify #[repr(C)] to ensure memory layout consistency, field assignment form is safer
    // browsers: unsafe { std::mem::transmute(options.targets.clone().unwrap_or_default()) },
    include: Features::from_bits_truncate(options.include.unwrap_or(0)),
    exclude: Features::from_bits_truncate(options.exclude.unwrap_or(0)),
  };

  // Minify CSS
  stylesheet
    .minify(MinifyOptions {
      targets,
      unused_symbols: options
        .unused_symbols
        .clone()
        .unwrap_or_default()
        .into_iter()
        .collect(),
    })
    .map_err(|e| CompileError::MinifyError(e))?;

  // Generate source map
  let mut source_map = if options.source_map.unwrap_or_default() {
    let mut sm = SourceMap::new(project_root.unwrap_or("/"));
    sm.add_source(&filename);
    sm.set_source_content(0, css)
      .map_err(|e| CompileError::SourceMapError(e))?;
    Some(sm)
  } else {
    None
  };

  // Transform output
  let output = stylesheet
    .to_css(PrinterOptions {
      minify: options.minify.unwrap_or(true),
      source_map: source_map.as_mut(),
      project_root,
      targets,
      pseudo_classes: options.pseudo_classes.as_ref().map(|pc| pc.into()),
      analyze_dependencies: if let Some(d) = &options.analyze_dependencies {
        Some(DependencyOptions {
          remove_imports: d.remove_imports,
        })
      } else {
        None
      },
      ..PrinterOptions::default()
    })
    .map_err(|e| CompileError::PrinterError(e))?;

  // Merge source map (if input CSS comes from other compilers with existing source map)
  let map = if let Some(mut source_map) = source_map {
    if let Some(input_source_map) = &options.input_source_map {
      if let Ok(mut sm) = SourceMap::from_json("/", input_source_map) {
        let _ = source_map.extends(&mut sm);
      }
    }

    // .ok(): Result type method to convert Result<T, E> to Option<T>
    source_map.to_json(None).ok()
  } else {
    None
  };

  Ok(TransformResult {
    code: output.code, // Return processed CSS
    map,              // Return source map in JSON string format
    exports: output.exports,
    references: output.references,
    dependencies: output.dependencies,
  })
}
