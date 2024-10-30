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

  // 解析 CSS
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
              Err(e) => return Err(e), // 捕获并返回错误
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

  // 设置目标浏览器
  // 为了性能，每次调用transform时重用相同的targets对象，所以targets对象需要在外部构建好
  let targets = Targets {
    browsers: Some(Browsers::from(
      options
        .targets
        .as_ref()
        .unwrap_or(&TransformBrowsers::default()),
    )),
    // 基本类型的copy转换开销较低，可以transmute无损转换，但是由于lightningcss的targets的browser无法指定#[repr(C)]来确保内存布局一致，没有字段赋值的形式安全
    // browsers: unsafe { std::mem::transmute(options.targets.clone().unwrap_or_default()) },
    include: Features::from_bits_truncate(options.include.unwrap_or(0)),
    exclude: Features::from_bits_truncate(options.exclude.unwrap_or(0)),
  };

  // 压缩 CSS
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

  // 生成source_map
  let mut source_map = if options.source_map.unwrap_or_default() {
    let mut sm = SourceMap::new(project_root.unwrap_or("/"));
    sm.add_source(&filename);
    sm.set_source_content(0, css)
      .map_err(|e| CompileError::SourceMapError(e))?;
    Some(sm)
  } else {
    None
  };

  // 转化输出
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

  // 合并source_map（如果输入的 CSS 来自其他编译器，已有源映射文件的情况）
  let map = if let Some(mut source_map) = source_map {
    if let Some(input_source_map) = &options.input_source_map {
      if let Ok(mut sm) = SourceMap::from_json("/", input_source_map) {
        let _ = source_map.extends(&mut sm);
      }
    }

    // .ok()：Result 类型的方法，用于将 Result<T, E> 转换为 Option<T>
    source_map.to_json(None).ok()
  } else {
    None
  };

  Ok(TransformResult {
    code: output.code, // 返回处理后的css
    map,               // 返回json 字符串格式的source_map
    exports: output.exports,
    references: output.references,
    dependencies: output.dependencies,
  })
}
