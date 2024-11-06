use crate::types::DraftsOptions;
use lightningcss::stylesheet::ParserFlags;

pub fn drafts_to_parser_flags(drafts: &DraftsOptions) -> ParserFlags {
  let mut flags = ParserFlags::empty();
  if drafts.nesting.unwrap_or(false) {
    flags |= ParserFlags::NESTING;
  }
  if drafts.custom_media.unwrap_or(false) {
    flags |= ParserFlags::CUSTOM_MEDIA;
  }
  if drafts.deep_selector_combinator.unwrap_or(false) {
    flags |= ParserFlags::DEEP_SELECTOR_COMBINATOR;
  }
  flags
}
