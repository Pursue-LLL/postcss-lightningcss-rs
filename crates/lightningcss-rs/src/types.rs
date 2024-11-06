#![deny(clippy::all)]

use lightningcss::css_modules::{
  CssModuleExports, CssModuleReferences, Pattern, PatternParseError,
};
use lightningcss::dependencies::Dependency;
use lightningcss::error::{Error, MinifyErrorKind, ParserError, PrinterErrorKind};
use lightningcss::printer::PseudoClasses;
use lightningcss::targets::Browsers;
use napi::{Env, JsUnknown};
use napi_derive::napi;
use parcel_sourcemap::SourceMapError;
use serde::Serialize;

#[derive(Debug)]
pub enum CompileError<'i> {
  ParseError(Error<ParserError<'i>>),
  MinifyError(Error<MinifyErrorKind>),
  PrinterError(Error<PrinterErrorKind>),
  PatternError(PatternParseError),
  SourceMapError(SourceMapError),
}

#[derive(Debug)]
#[napi]
pub enum CssModulesOption {
  Bool(bool),
  Config(CssModulesConfig),
}

#[napi(object)]
#[derive(Debug)]
pub struct AnalyzeDependenciesConfig {
  pub remove_imports: bool,
}

#[napi(object)]
#[derive(Debug)]
pub struct CssModulesConfig {
  pub pattern: Option<String>,
  pub container: Option<bool>,
  pub dashed_idents: Option<bool>,
  pub animation: Option<bool>,
  pub grid: Option<bool>,
  pub custom_idents: Option<bool>,
  pub pure: Option<bool>,
}

impl<'i> TryFrom<&'i CssModulesConfig> for lightningcss::css_modules::Config<'i> {
  type Error = CompileError<'i>;

  fn try_from(wrapper: &'i CssModulesConfig) -> Result<Self, Self::Error> {
    let pattern = if let Some(pattern) = &wrapper.pattern {
      match lightningcss::css_modules::Pattern::parse(pattern) {
        Ok(p) => p,
        Err(e) => return Err(CompileError::PatternError(e)),
      }
    } else {
      Pattern::default()
    };

    Ok(lightningcss::css_modules::Config {
      pattern,
      container: wrapper.container.unwrap_or(true),
      dashed_idents: wrapper.dashed_idents.unwrap_or_default(),
      animation: wrapper.animation.unwrap_or(true),
      grid: wrapper.grid.unwrap_or(true),
      custom_idents: wrapper.custom_idents.unwrap_or(true),
      pure: wrapper.pure.unwrap_or(false),
    })
  }
}

// 简单结构体可以使用#[napi(object)]，复杂的使用 serde 序列化 + into_js来简化每个字段的FromNapiValue转化
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransformResult {
  pub code: String,
  pub map: Option<String>,
  pub exports: Option<CssModuleExports>,
  pub references: Option<CssModuleReferences>,
  pub dependencies: Option<Vec<Dependency>>,
}

// 将TransformResult转换为JsUnknown
impl TransformResult {
  pub fn into_js(self, env: Env) -> napi::Result<JsUnknown> {
    let mut obj = env.create_object()?;
    let code = env.create_string(&self.code)?;
    obj.set_named_property("code", code)?;
    obj.set_named_property(
      "map",
      if let Some(map) = self.map {
        env.create_string(&map)?
      } else {
        env.create_string("")?
      },
    )?;
    obj.set_named_property("exports", env.to_js_value(&self.exports)?)?;
    obj.set_named_property("references", env.to_js_value(&self.references)?)?;
    obj.set_named_property("dependencies", env.to_js_value(&self.dependencies)?)?;
    Ok(obj.into_unknown())
  }
}

#[derive(Clone, Debug, Default)]
#[napi(object)]
pub struct DraftsOptions {
  pub nesting: Option<bool>,
  pub custom_media: Option<bool>,
  pub deep_selector_combinator: Option<bool>,
}

#[derive(Debug, Default)]
#[napi(object)]
pub struct OwnedPseudoClasses {
  pub hover: Option<String>,
  pub active: Option<String>,
  pub focus: Option<String>,
  pub focus_visible: Option<String>,
  pub focus_within: Option<String>,
}

impl<'a> Into<PseudoClasses<'a>> for &'a OwnedPseudoClasses {
  fn into(self) -> PseudoClasses<'a> {
    PseudoClasses {
      hover: self.hover.as_deref(),
      active: self.active.as_deref(),
      focus: self.focus.as_deref(),
      focus_visible: self.focus_visible.as_deref(),
      focus_within: self.focus_within.as_deref(),
    }
  }
}

#[napi(object)]
#[derive(Debug, Default)]
pub struct TransformBrowsers {
  pub android: Option<u32>,
  pub chrome: Option<u32>,
  pub edge: Option<u32>,
  pub firefox: Option<u32>,
  pub ie: Option<u32>,
  pub ios_saf: Option<u32>,
  pub opera: Option<u32>,
  pub safari: Option<u32>,
  pub samsung: Option<u32>,
}

impl From<&TransformBrowsers> for Browsers {
  fn from(browsers: &TransformBrowsers) -> Self {
    Browsers {
      android: browsers.android,
      chrome: browsers.chrome,
      edge: browsers.edge,
      firefox: browsers.firefox,
      ie: browsers.ie,
      ios_saf: browsers.ios_saf,
      opera: browsers.opera,
      safari: browsers.safari,
      samsung: browsers.samsung,
    }
  }
}

impl From<Browsers> for TransformBrowsers {
  fn from(browsers: Browsers) -> Self {
    TransformBrowsers {
      android: browsers.android,
      chrome: browsers.chrome,
      edge: browsers.edge,
      firefox: browsers.firefox,
      ie: browsers.ie,
      ios_saf: browsers.ios_saf,
      opera: browsers.opera,
      safari: browsers.safari,
      samsung: browsers.samsung,
    }
  }
}

#[derive(Debug, Default)]
#[napi(object)]
pub struct TransformOptions {
  pub minify: Option<bool>,
  pub targets: Option<TransformBrowsers>,
  pub include: Option<u32>,
  pub exclude: Option<u32>,
  pub unused_symbols: Option<Vec<String>>,
  pub source_map: Option<bool>,
  pub input_source_map: Option<String>,
  pub error_recovery: Option<bool>,
  pub project_root: Option<String>,
  pub filename: Option<String>,
  pub pseudo_classes: Option<OwnedPseudoClasses>,
  pub analyze_dependencies: Option<AnalyzeDependenciesConfig>,
  pub css_modules: Option<CssModulesOption>,
  pub drafts: Option<DraftsOptions>,
}

#[derive(Debug)]
#[napi]
pub enum SourceMapOption {
  Bool(bool),
  Inline,
  Hidden,
}

#[derive(Debug, Default)]
#[napi(object)]
pub struct PluginOptions {
  pub minify: Option<bool>,
  pub targets: Option<Vec<String>>,
  pub include: Option<u32>,
  pub exclude: Option<u32>,
  pub unused_symbols: Option<Vec<String>>,
  pub error_recovery: Option<bool>,
  pub pseudo_classes: Option<OwnedPseudoClasses>,
  pub analyze_dependencies: Option<AnalyzeDependenciesConfig>,
  // parse
  pub css_modules: Option<CssModulesOption>,
  pub drafts: Option<DraftsOptions>,
}
