/** The report: a `Profile` rendered as the HTML report, PNG cards and the library page. */
export { writeReport, type CjkFonts } from "./write.ts"
export { renderHtml } from "./html.ts"
export { renderLibrary } from "./library.ts"
export {
  CARD_PARTS,
  DEFAULT_RENDER_OPTIONS,
  EXCLUDE_GROUPS,
  isDefaultRender,
  LOOK_IDS,
  REPORT_PARTS,
  variantName,
  type CardPart,
  type LookId,
  type RenderOptions,
  type ReportPart,
} from "./looks.ts"
export { reportContents, type ReportContents } from "./visibility.ts"
export { isLimitedEvidence } from "./evidence.ts"
export { AVATAR_CHOICES, type AvatarChoice } from "./avatar.ts"
export { loadCjkFonts } from "./fonts.ts"
