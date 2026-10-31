import { roleCode, type Profile } from "../domain/index.ts"
/** Original abstract collaboration symbols, with no face, body or inferred human likeness. */
export const AVATAR_ART_VERSION = 1
export const AVATAR_STUDIES = ["planner", "explorer", "coordinator", "verifier", "neutral"] as const
export type AvatarStudy = (typeof AVATAR_STUDIES)[number]
const ink = "#293b43"
const paper = "#f5efe2"
const jade = "#659b91"
const warm = "#dfb06d"
const rose = "#ce8977"
const outline = `stroke="${ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`

/** One abstract composition per action, with geometric arrangements rather than accessories. */
export const avatarSvg = (
  requested: string,
  pose = 0,
): {
  readonly svg: string
  readonly id: string
  readonly width: number
  readonly height: number
  readonly kind: AvatarStudy
} => {
  const study = (AVATAR_STUDIES as ReadonlyArray<string>).includes(requested)
    ? (requested as AvatarStudy)
    : "neutral"
  const v = Math.max(0, Math.min(3, Math.floor(Number.isFinite(pose) ? pose : 0)))
  const cells = [
    `<path d="M111 133h37v28h39v37h34" fill="none" ${outline}/><rect x="95" y="118" width="34" height="29" rx="7" fill="${jade}" ${outline}/><rect x="168" y="149" width="35" height="30" rx="7" fill="${warm}" ${outline}/><circle cx="218" cy="200" r="15" fill="${rose}" ${outline}/>`,
    `<path d="M112 133h83m-42 0v67m0 0h43" fill="none" ${outline}/><rect x="96" y="118" width="31" height="31" rx="7" fill="${jade}" ${outline}/><rect x="179" y="118" width="31" height="31" rx="7" fill="${warm}" ${outline}/><rect x="137" y="184" width="31" height="31" rx="7" fill="${rose}" ${outline}/>`,
    `<path d="M109 137L155 180L209 135" fill="none" ${outline}/><circle cx="108" cy="135" r="15" fill="${jade}" ${outline}/><rect x="139" y="166" width="32" height="30" rx="7" fill="${warm}" ${outline}/><circle cx="211" cy="134" r="15" fill="${rose}" ${outline}/>`,
    `<path d="M110 133h97m-97 38h97m-97 38h57" ${outline}/><circle cx="103" cy="133" r="8" fill="${jade}" ${outline}/><circle cx="103" cy="171" r="8" fill="${warm}" ${outline}/><circle cx="103" cy="209" r="8" fill="${rose}" ${outline}/>`,
  ][v]!
  const planner = `<g transform="rotate(${[-7, 5, -3, 8][v]} 160 165)"><path d="M83 79h129l30 32v142H83Z" fill="${paper}" ${outline}/><path d="M212 79v33h30" fill="${warm}" ${outline}/><path d="M99 94h71" ${outline}/>${cells}</g><path d="M69 252h93" stroke="${jade}" stroke-width="9" stroke-linecap="round"/>`
  const orbitalExplorer = `<g transform="rotate(${[-9, 7, 16, -16][v]} 160 160)"><circle cx="158" cy="160" r="${[83, 76, 86, 78][v]}" fill="${paper}" ${outline}/><ellipse cx="159" cy="162" rx="112" ry="43" fill="none" stroke="${jade}" stroke-width="9"/><path d="M107 119Q168 82 209 135M118 202Q166 223 204 191" fill="none" ${outline}/><circle cx="219" cy="139" r="22" fill="${warm}" ${outline}/><circle cx="77" cy="185" r="13" fill="${rose}" ${outline}/><circle cx="146" cy="148" r="7" fill="${jade}"/><circle cx="177" cy="179" r="5" fill="${rose}"/></g>`
  const arrangements = [
    [
      [76, 177],
      [159, 110],
      [242, 177],
    ],
    [
      [94, 105],
      [159, 210],
      [228, 105],
    ],
    [
      [87, 117],
      [227, 150],
      [108, 224],
    ],
    [
      [88, 208],
      [151, 104],
      [229, 208],
    ],
  ] as const
  const points = arrangements[v]!
  const coordinator = `<path d="M${points[0][0]} ${points[0][1]}Q160 160 ${points[1][0]} ${points[1][1]}Q170 170 ${points[2][0]} ${points[2][1]}" fill="none" stroke="${jade}" stroke-width="18" stroke-linecap="round"/><circle cx="${points[0][0]}" cy="${points[0][1]}" r="34" fill="${paper}" ${outline}/><rect x="${points[1][0] - 34}" y="${points[1][1] - 34}" width="68" height="68" rx="19" fill="${warm}" ${outline}/><path d="M${points[2][0]} ${points[2][1] - 38}l35 63h-70Z" fill="${rose}" ${outline}/><path d="M${points[0][0] - 9} ${points[0][1]}h18M${points[1][0] - 9} ${points[1][1]}h18" ${outline}/>`
  const squareVerifier = `<g transform="rotate(${[-7, 6, -13, 12][v]} 160 160)"><rect x="92" y="89" width="155" height="151" rx="25" fill="${jade}" ${outline}/><rect x="69" y="66" width="155" height="151" rx="25" fill="${paper}" ${outline}/><path d="M104 142l30 30 58-66" fill="none" stroke="${jade}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><path d="M91 83h30m83 0v30M91 200h30m83 0v-30" fill="none" ${outline}/><circle cx="238" cy="233" r="20" fill="${warm}" ${outline}/></g><path d="M75 260h72" stroke="${rose}" stroke-width="8" stroke-linecap="round"/>`
  const explorer = [
    orbitalExplorer,
    `<path d="M94 79L217 86L258 193L158 254L68 183Z" fill="${paper}" ${outline}/><path d="M90 183Q124 94 219 117M121 218Q186 232 235 169" fill="none" stroke="${jade}" stroke-width="9" stroke-linecap="round"/><circle cx="216" cy="112" r="24" fill="${warm}" ${outline}/><circle cx="101" cy="197" r="13" fill="${rose}" ${outline}/><path d="M155 127v46l29 16" fill="none" ${outline}/>`,
    `<circle cx="127" cy="155" r="73" fill="${paper}" ${outline}/><circle cx="206" cy="171" r="57" fill="${jade}" ${outline}/><path d="M104 183L148 105L197 185Z" fill="${warm}" ${outline}/><path d="M72 216Q161 271 250 209" fill="none" ${outline}/><circle cx="241" cy="115" r="14" fill="${rose}" ${outline}/>`,
    `<path d="M78 168a83 83 0 1 1 164 20" fill="none" stroke="${jade}" stroke-width="21" stroke-linecap="round"/><path d="M243 168a83 83 0 1 1-163-21" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/><circle cx="160" cy="164" r="52" fill="${paper}" ${outline}/><path d="M142 185L168 123L191 185Z" fill="${warm}" ${outline}/><circle cx="86" cy="121" r="17" fill="${rose}" ${outline}/><circle cx="241" cy="214" r="13" fill="${warm}" ${outline}/>`,
  ][v]!
  const verifier = [
    squareVerifier,
    `<circle cx="160" cy="160" r="91" fill="${paper}" ${outline}/><circle cx="160" cy="160" r="70" fill="none" stroke="${jade}" stroke-width="12"/><path d="M122 161l27 28 53-61" fill="none" ${outline}/><rect x="211" y="215" width="42" height="42" rx="12" fill="${warm}" ${outline}/><path d="M83 89h26" stroke="${rose}" stroke-width="9" stroke-linecap="round"/>`,
    `<g transform="rotate(-5 160 160)"><rect x="56" y="100" width="208" height="127" rx="24" fill="${paper}" ${outline}/><path d="M148 104v119" stroke="${ink}" stroke-width="4"/><path d="M80 158l19 20 34-42" fill="none" stroke="${jade}" stroke-width="13" stroke-linecap="round"/><rect x="169" y="124" width="69" height="14" rx="7" fill="${warm}"/><path d="M171 162h58m-58 25h39" ${outline}/></g><path d="M86 245h68" stroke="${rose}" stroke-width="8" stroke-linecap="round"/>`,
    `<path d="M159 53L265 160L159 266L54 160Z" fill="${jade}" ${outline}/><path d="M159 73L245 160L159 246L74 160Z" fill="${paper}" ${outline}/><path d="M117 159l28 30 59-66" fill="none" ${outline}/><circle cx="237" cy="230" r="18" fill="${warm}" ${outline}/><path d="M72 86h31" stroke="${rose}" stroke-width="8" stroke-linecap="round"/>`,
  ][v]!
  const neutral = `<g transform="rotate(-9 160 160)"><rect x="69" y="83" width="123" height="143" rx="30" fill="${paper}" ${outline}/><circle cx="201" cy="169" r="68" fill="${jade}" ${outline}/><path d="M143 130a62 62 0 0 1 0 79" fill="none" stroke="${paper}" stroke-width="12" stroke-linecap="round"/><path d="M91 123h30m-30 25h21" ${outline}/><circle cx="219" cy="107" r="18" fill="${warm}" ${outline}/><rect x="94" y="231" width="43" height="18" rx="9" fill="${rose}" ${outline}/></g>`
  const compositions = { planner, explorer, coordinator, verifier, neutral }
  return {
    kind: study,
    id: `geometric-v${AVATAR_ART_VERSION}-${study}-${v}`,
    width: 320,
    height: 320,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" fill="none"><ellipse cx="160" cy="279" rx="112" ry="11" fill="${jade}" fill-opacity=".16"/>${compositions[study]}</svg>`,
  }
}

/** Portrait composition for a wide report hero; the compact symbol remains unchanged. */
export const avatarPortrait = (compact: ReturnType<typeof avatarSvg>) => {
  const body = compact.svg.replace(/^<svg[^>]*>/u, "").replace(/<\/svg>$/u, "")
  const base =
    compact.kind === "explorer"
      ? `<path d="M95 407Q160 364 225 407Q160 452 95 407Z" fill="${paper}" ${outline}/><circle cx="160" cy="407" r="15" fill="${warm}" ${outline}/>`
      : compact.kind === "coordinator"
        ? `<path d="M98 399h124" stroke="${jade}" stroke-width="12"/><circle cx="98" cy="399" r="17" fill="${paper}" ${outline}/><rect x="145" y="382" width="34" height="34" rx="8" fill="${warm}" ${outline}/><circle cx="222" cy="399" r="17" fill="${rose}" ${outline}/>`
        : `<path d="M86 389l124-9 20 43-124 9Z" fill="${paper}" ${outline}/><path d="M113 404l80-6m-72 20 49-4" stroke="${jade}" stroke-width="6" stroke-linecap="round"/>`
  return {
    ...compact,
    id: `${compact.id}-portrait-v1`,
    height: 480,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 480" fill="none"><path d="M114 83Q145 23 205 48Q265 75 235 139M104 305Q60 365 112 393" fill="none" stroke="${jade}" stroke-width="7" stroke-linecap="round"/><circle cx="205" cy="48" r="22" fill="${warm}" ${outline}/><rect x="79" y="65" width="46" height="20" rx="10" transform="rotate(-15 102 75)" fill="${rose}" ${outline}/><g transform="translate(0 65)">${body}</g>${base}</svg>`,
  }
}

export const AVATAR_CHOICES = [
  "auto",
  "planner",
  "explorer",
  "coordinator",
  "verifier",
  "neutral",
  "none",
] as const
export type AvatarChoice = (typeof AVATAR_CHOICES)[number]

/** User choices change only the visual. Until a role resolves, auto selects the neutral asset. */
export const avatarFor = (
  profile: Profile,
  choice: AvatarChoice = "auto",
): ReturnType<typeof avatarSvg> | null => {
  if (choice === "none") return null
  if (choice !== "auto") return avatarSvg(choice)
  const code = profile.portrait ? roleCode(profile.portrait.axes) : null
  const art = ROLE_ART.find(([key]) => key === code)
  return art ? avatarSvg(art[1], art[2]) : avatarSvg("neutral")
}

export const avatarStyle = `
html:root .hero .role-avatar img{display:block;width:100%;height:auto}
html:root .hero:has(.role-avatar)>.report-facts{grid-column:1/-1;grid-row:2;margin:0;padding-top:16px;border-top:1px solid var(--border)}

html:root .hero:has(.role-avatar){display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,26%);gap:20px;align-items:center}
html:root .hero:has(.role-avatar) .copy{max-width:none;min-width:0}
html:root .hero .graphic.role-avatar{display:block;position:static;grid-column:2;grid-row:1;width:100%;max-width:230px;height:auto;aspect-ratio:2/3;transform:none;margin:0;justify-self:end}
html:root .hero:has(.role-avatar) .identity-signatures{grid-column:1/-1;grid-row:3}
@media(max-width:760px){
html:root .hero:has(.role-avatar){grid-template-columns:minmax(0,1fr) clamp(64px,18vw,120px);gap:12px 16px;align-items:center}
html:root .hero:has(.role-avatar) .copy{display:contents}
html:root .hero:has(.role-avatar) .copy>h1{grid-column:1;grid-row:1;font-size:clamp(var(--text-2xl),4.8vw,calc(var(--text-2xl)*1.4));max-width:none;margin:0;overflow-wrap:anywhere}
html:root .hero:has(.role-avatar) .copy>:not(h1){grid-column:1/-1;margin-top:0}
html:root .hero .graphic.role-avatar{grid-column:2;grid-row:1;width:100%;max-width:120px;height:auto;aspect-ratio:1;margin:0;align-self:center}
html:root .hero:has(.role-avatar)>.report-facts{grid-row:auto}
html:root .hero:has(.role-avatar) .identity-signatures{grid-row:auto}
}
@media(max-width:380px){html:root .hero:has(.role-avatar) .copy>h1{font-size:calc(var(--text-base)*1.6)}}

`

/** Version-1 role mapping; retain these IDs when future art versions are introduced. */
export const ROLE_ART = [
  ["FSDC", "planner", 0],
  ["FSDR", "verifier", 1],
  ["FSLC", "planner", 2],
  ["FSLR", "coordinator", 1],
  ["FBDC", "verifier", 0],
  ["FBDR", "planner", 3],
  ["FBLC", "coordinator", 0],
  ["FBLR", "coordinator", 2],
  ["ESDC", "explorer", 0],
  ["ESDR", "explorer", 1],
  ["ESLC", "verifier", 2],
  ["ESLR", "explorer", 2],
  ["EBDC", "verifier", 3],
  ["EBDR", "coordinator", 3],
  ["EBLC", "planner", 1],
  ["EBLR", "explorer", 3],
] as const satisfies ReadonlyArray<readonly [string, AvatarStudy, number]>
