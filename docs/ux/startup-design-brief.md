# Share-first profile design revision

Status: research prototype, not a production renderer. The previous Editorial / Evidence
Notebook / Share Poster presentation was rejected by the owner as dated and insufficiently
shareable. Retain those captures as historical evidence, not the recommended direction.

## Design process

Reference: [Anthropic's official frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md),
read on 2026-10-24. It is not installed as a local skill. Apply its two-pass process: define
an intentional visual system, critique it against this brief, then build and inspect captures.
The visual assets below are original HTML/CSS and activity-data graphics, not copied products.

## Brief

The audience is a developer who wants a recognizable personal artifact from their prompt
history. The first impression should be "I would post this", followed by "show me the evidence".
A useful profile needs both an expressive public surface and a credible private report.
Use the same synthetic profile, numbers, and evidence across all directions.

## Compact token systems

| Direction  | Palette                                                                                  | Typography                                                               | Layout and memorable element                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Signal     | Cobalt `#3155F5`, chalk `#F5F7FF`, ink `#14204C`, citron `#E0F59A`, periwinkle `#BFCBFF` | Bricolage Grotesque, heavy display; bundled Inter for reading            | Left-aligned oversized identity; a rhythmic stack of bars from the 24-hour histogram; a bright, assertive share card |
| Afterhours | Midnight `#10243A`, glacier `#BCEBFF`, lilac `#B9B3FF`, cloud `#EAF4FB`, steel `#8CA8BC` | Bricolage Grotesque with open, slower display spacing; Inter for reading | Left-aligned identity beside a radial activity trace; quiet data and a distinctive night-session mood                |
| Studio     | Coral `#FF654B`, rose `#FFD5DD`, paper `#FFFFFF`, ink `#252323`, faded coral `#FFF0ED`   | Bricolage Grotesque, compact display; Inter for reading                  | An asymmetric composition with oversized type and a folded conversation shape; a playful personal-brand card         |

All fonts are local. Bricolage Grotesque is licensed under the bundled SIL OFL; the source is
[Google Fonts](https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque). Inter uses the
existing licensed report assets. The new font is a research asset and is not added to the npm
package or the production PNG renderer by this revision.

## Layout concept

```text
Desktop report                         Share card (1200 × 630)
brand                       preview    brand                    activity graphic
            direction selector
[ recognizable identity | rhythm ]    oversized archetype
short, specific supporting line        short description

reading summary       evidence         trait labels
one activity chart                     two chosen metrics              brand
```

On mobile, keep the identity first, move the activity graphic after it, and preserve comfortable
reading text. The landscape card scales as one composition; the report itself reflows. A user
must be able to distinguish a reduced card preview from a readable mobile report.

## First-pass critique and changes

- The rejected three-column tiles made all choices feel like documentation samples. Use a
  full-scale report preview with an immediate share-card preview; compare one direction at a time.
- A neon-on-black terminal kit would be another default. Signal instead uses a cobalt surface;
  Afterhours uses a measured activity orbit on navy rather than generic glow effects.
- A serif editorial route would repeat the rejected aesthetic. Use one expressive sans display
  face, and keep dense reading text quiet.
- A gradient, badge, or large number alone is not a recognizable identity. Give each direction
  one signature form rooted in the product: the prompt rhythm, the activity orbit, or a
  conversation fold. Do not add decoration to every section.
- Keep titles, numeric statistics, confidence and evidence consistent. No fabricated personality
  scores, percentile rankings, model results, or quotes appear in the share card.

## Sharing hypotheses to validate

1. People recognize themselves through the archetype and traits before reading the numeric stats.
2. A full-size, accurate share preview creates more confidence than a tiny generic thumbnail.
3. Choosing a visual identity feels lighter than editing a dozen design settings.
4. Quiet privacy controls for traits, statistics and the activity graphic make sharing feel safer.
5. The private report should reward curiosity with evidence rather than copy the share card's density.

Measure stated willingness to share and an actual choice to export during user sessions; neither
is established by polished screenshots. Preserve the UX plan's factual and privacy gates.
