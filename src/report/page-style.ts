import type { Language } from "../domain/index.ts"

export const BASE_STYLE = `
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:var(--text-base)/1.6 var(--font-body)}
.page{max-width:var(--page);margin:0 auto;padding:20px 20px 56px}
h1,h2,h3{line-height:1.2;margin:0}
p{margin:0}
.topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:6px 0 18px;border-bottom:var(--topbar-rule)}
.brand{font-weight:700;letter-spacing:-.01em}
.switch{display:flex;gap:2px;padding:3px;border:1px solid var(--border);border-radius:999px;background:var(--card)}
.switch label{padding:4px 12px;border-radius:999px;font-size:var(--text-sm);cursor:pointer;color:var(--muted);transition:background-color var(--motion-fast) var(--ease-out),color var(--motion-fast) var(--ease-out)}
.lang-input{position:absolute;opacity:0;pointer-events:none}
.hero{position:relative;overflow:hidden;border-radius:var(--hero-radius);padding:36px 40px;border:var(--hero-border);border-top:var(--hero-top);border-bottom:var(--hero-bottom);background:var(--id-bg);color:var(--id-fg)}
.hero .split{position:absolute;right:0;top:0;bottom:0;width:34%;background:var(--id-split)}
.hero .copy{position:relative;max-width:60%}
.hero h1{font-family:var(--title-font);font-weight:var(--title-weight);font-size:var(--title-size);letter-spacing:var(--title-tracking);max-width:var(--title-measure);margin-bottom:12px}
.hero .tagline{font-size:var(--text-xl);line-height:1.45;color:var(--id-muted);display:block}
.hero .desc{margin-top:8px;color:var(--id-muted);font-size:var(--text-md)}
.hero .report-facts{margin:18px 0 0;display:flex;flex-wrap:wrap;gap:10px 28px;font-size:var(--text-sm)}.hero .report-facts dt{font-size:var(--text-2xs);letter-spacing:.06em;text-transform:uppercase;color:var(--id-muted)}.hero .report-facts dd{margin:2px 0 0;font-weight:600;font-variant-numeric:tabular-nums}
.hero:has(.hero-clock){min-height:270px}
.hero-clock{position:absolute;right:32px;top:50%;transform:translateY(-50%);width:min(28%,210px)}
.hero .chrono{margin-top:14px;font-size:var(--text-sm);font-weight:600;color:var(--id-fg)}
.hero .graphic{position:absolute;right:36px;top:28px;bottom:28px;height:calc(100% - 56px);width:auto;max-width:30%;object-fit:contain}
.sigs{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
.sig,.panel,.trait,.dimension,.fact,.about,.minor{background:var(--card);border:1px solid var(--border);border-radius:var(--radius-xl)}
.sig{position:relative;padding:16px 18px;outline:none;transition:border-color var(--motion-fast) var(--ease-out)}
.sig b{display:block;font-size:var(--text-2xl);letter-spacing:-.02em;line-height:1.15}
.sig>span{color:var(--muted);font-size:var(--text-xs)}
.sig:hover,.sig:focus{border-color:var(--accent)}
.grid{display:grid;gap:12px;margin-bottom:12px}
.g-2{grid-template-columns:2fr 1fr}
.g-3{grid-template-columns:repeat(3,1fr)}
.g-2r{grid-template-columns:1fr 1.6fr}
.wide{margin-bottom:12px}
.panel-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
.panel-head h2{margin-bottom:0}.panel-head .note{margin-top:0}
.panel{padding:18px 20px}
.panel h3{font-size:var(--text-md);margin-bottom:10px}
.panel .note{color:var(--muted);font-size:var(--text-xs);margin-top:6px}
.axis{fill:var(--muted);font-size:var(--text-2xs)}
.donut{display:flex;align-items:center;gap:16px}
.donut svg{width:112px;flex:none}
.track{fill:none;stroke:var(--empty);stroke-width:14}
.seg{fill:none;stroke-width:14;stroke:var(--accent)}
.s1{stroke-opacity:.55}.s2{stroke-opacity:.25}
.donut-value{fill:var(--fg);font-size:var(--text-xl);font-weight:700}
.legend,.shares,.evidence,.facts{list-style:none;margin:0;padding:0}
.legend li{display:flex;align-items:center;gap:8px;font-size:var(--text-sm);margin:4px 0}
.legend b{margin-left:auto;padding-left:10px}
.dot{width:10px;height:10px;border-radius:50%;background:var(--accent);flex:none}
.dot.s1{opacity:.55}.dot.s2{opacity:.25}
.shares li{display:grid;grid-template-columns:84px 1fr 38px;align-items:center;gap:8px;font-size:var(--text-sm);margin:7px 0}
.share-track{height:8px;border-radius:999px;background:var(--empty);overflow:hidden}
.share-fill{display:block;height:100%;background:var(--accent);border-radius:999px}
.shares b{text-align:right;font-size:var(--text-xs)}
.sub{color:var(--muted);font-size:var(--text-xs);margin-top:12px}
.rings{display:flex;gap:14px;flex-wrap:wrap}
.ring{display:flex;align-items:center;gap:8px}
.ring svg{width:52px}
.ring b{display:block;font-size:var(--text-lg)}
.ring div>span{font-size:var(--text-xs);color:var(--muted)}
.length{margin-top:14px}
.length .shares li{grid-template-columns:84px 1fr 78px}
details summary{cursor:pointer}
section>h2{font-size:var(--text-xl);margin:36px 0 14px}
section .panel{margin-bottom:12px}
.traits{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.trait{padding:18px 20px}
.trait header{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:6px}
.trait h3{font-size:var(--text-lg)}
.trait p{font-size:var(--text-md);color:var(--muted)}
.meter{display:flex;align-items:center;gap:3px;flex:none}
.meter i{width:14px;height:6px;border-radius:3px;background:var(--empty)}
.meter i.on{background:var(--accent)}
.meter-label{font-size:var(--text-2xs);color:var(--muted);margin-left:6px;white-space:nowrap}
.trait details{margin-top:8px}
.lead-quote{margin-top:12px}
.support{margin-top:10px;font-size:var(--text-xs);color:var(--muted)}
.sub-h{font-size:var(--text-md);color:var(--muted);margin:22px 0 10px}
.minors{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}
.minor{padding:12px 16px}
.minor-head{display:flex;justify-content:space-between;gap:10px;align-items:center}
.minor p{font-size:var(--text-sm);color:var(--muted);margin-top:4px}
.minor details{margin-top:6px}
.trait summary,.dim-body summary{font-size:var(--text-sm);color:var(--accent)}
.evidence li{margin:8px 0 0}
blockquote{margin:0;padding:6px 12px;border-left:3px solid var(--accent);color:var(--muted);font-size:var(--text-sm);white-space:pre-wrap;overflow-wrap:anywhere}
.dims{display:grid;gap:8px}
.dimension>summary{display:flex;align-items:center;gap:12px;padding:14px 18px;list-style:none}
.dimension>summary::-webkit-details-marker{display:none}
.dimension>summary::after{content:"+";margin-left:12px;color:var(--muted);font-size:var(--text-lg);line-height:1}
.dimension[open]>summary::after{content:"–"}
.dim-name{font-size:var(--text-xs);font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.04em;min-width:120px}
.dim-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.dim-title{font-weight:600}
.dim-summary{font-size:var(--text-sm);color:var(--muted);font-weight:400}
.dimension.static{display:flex;align-items:center;gap:12px;padding:14px 18px}
.badge{font-size:var(--text-xs);padding:2px 10px;border-radius:999px;background:var(--accent-soft);color:var(--accent);white-space:nowrap}
.badge.warn{background:transparent;border:1px solid var(--warn);color:var(--warn)}
.dim-body{padding:0 18px 16px}
.dim-body p{font-size:var(--text-md)}
.warning{color:var(--warn);font-size:var(--text-sm);margin-top:8px}
.section-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
.section-head h2{font-size:var(--text-xl);margin:36px 0 14px}
.improves{display:grid;gap:12px}
.improve{background:var(--card);border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:var(--radius-xl);padding:18px 20px}
.improve header{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.improve-n{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--accent-soft);color:var(--accent);font-size:var(--text-xs);font-weight:700;flex:none}
.improve h3{font-size:var(--text-lg)}
.improve-pattern{font-size:var(--text-md)}
.improve-impact{font-size:var(--text-sm);color:var(--muted);margin-top:4px}
.improve-tip{font-size:var(--text-md);font-weight:600;margin-top:8px}
.rewrite{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
.rw-label{display:block;font-size:var(--text-2xs);font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:4px}
.rw-after{margin:0;padding:8px 12px;border-radius:var(--radius-sm);background:var(--accent-soft);font-size:var(--text-sm);white-space:pre-wrap;overflow-wrap:anywhere}
.signals{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
.signals li{background:var(--card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:12px 16px;display:flex;flex-direction:column;gap:4px}
.signals b{font-size:var(--text-md)}.signals span{font-size:var(--text-sm);color:var(--muted)}
.changes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px}
.chg{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--card);font-size:var(--text-sm)}
.chg b{font-variant-numeric:tabular-nums}.chg i{font-style:normal;font-size:var(--text-xs);color:var(--muted);min-width:3em;text-align:right}
.chg.good i{color:var(--positive)}.chg.bad i{color:var(--warn)}
.last-tips{margin-top:10px;font-size:var(--text-sm);color:var(--muted)}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.fact{padding:16px 18px;font-size:var(--text-md)}
.about{margin-top:36px;padding:14px 18px;font-size:var(--text-sm);color:var(--muted)}
.measured{margin-top:14px}
.measured .panel{background:var(--bg)}
.foot{margin-top:28px;text-align:center;font-size:var(--text-xs);color:var(--muted)}
.about summary{color:var(--fg);font-weight:600}
.about p{margin-top:8px}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
@keyframes fade-in{from{opacity:0}}
@keyframes view-in{from{opacity:0;transform:translateY(4px)}}
@media (prefers-reduced-motion:reduce){*,::before,::after{animation:none!important;transition:none!important}}
@media (max-width:1000px){.g-3{grid-template-columns:repeat(2,1fr)}.g-2r{grid-template-columns:1fr}}
@media (max-width:760px){
.hero{padding:26px 22px}.hero .copy{max-width:none}.hero .split{display:none}
.hero:has(.hero-clock){min-height:270px}
.hero-clock{position:absolute;right:32px;top:50%;transform:translateY(-50%);width:min(28%,210px)}
.hero .chrono{margin-top:14px;font-size:var(--text-sm);font-weight:600;color:var(--id-fg)}
.hero .graphic{position:static;display:block;height:auto;width:62%;max-width:none;margin:18px 0 0 auto}
.hero:has(.hero-clock){min-height:0}
.hero-clock{position:static;transform:none;width:70%;margin:18px auto 0}
.sigs{grid-template-columns:repeat(2,1fr)}.rewrite{grid-template-columns:1fr}.g-2,.g-3,.g-2r{grid-template-columns:1fr}
.dim-name{min-width:0;flex-basis:100%}.dimension>summary,.dimension.static{flex-wrap:wrap;gap:6px 12px}
}
`

/** Show only the selected language; style the selected switch button. */
export const languageStyle = (langs: ReadonlyArray<Language>): string =>
  langs.length < 2
    ? ""
    : [
        ".page [data-l]{display:none}",
        ...langs.map(
          (l) =>
            `#lang-${l}:checked~.page [data-l="${l}"]{display:revert}` +
            `#lang-${l}:checked~.page label[for="lang-${l}"]{background:var(--accent);color:var(--on-accent)}` +
            `#lang-${l}:focus-visible~.page label[for="lang-${l}"]{outline:3px solid var(--accent);outline-offset:2px}`,
        ),
      ].join("\n")
