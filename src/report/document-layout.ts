/**
 * Shared reading rhythm, the last style layer: generated theme variables → base components →
 * variants → this. Component styles own color and illustration; this layer owns layout.
 */
export const documentLayoutStyle = `
html:root .page{padding:var(--space-8) var(--gutter) var(--space-12)}
html:root .report-view{line-height:1.75}
html:root .view-heading{margin:var(--space-8) 0 var(--space-6)}
html:root .view-heading p{max-width:var(--reading);margin-top:var(--space-2)}
html:root .hero{padding:var(--space-8)}
html[data-hero=editorial] .hero{padding:var(--space-8) 0}
html:root .hero .desc{max-width:var(--reading)}
html:root .hero h1{line-height:1.12}
html:root .identity-signatures{margin-top:var(--space-6);margin-bottom:0}
html[data-signatures=stacked] .identity-signatures{margin:0}
html:root .grid,html:root .overview-charts{gap:var(--space-6);margin:0 0 var(--space-8)}
html:root .panel{padding:var(--space-6);margin-bottom:0}
html:root .wide{margin-bottom:var(--space-6)}
html:root .grid>.panel,html:root .overview-charts>.panel{margin:0}
html:root section>h2,html:root .section-head h2{margin:var(--space-12) 0 var(--space-4);line-height:1.3}
html:root .panel-head{margin-bottom:var(--space-4)}
html:root .overview-bars{margin-top:var(--space-4);gap:var(--space-3)}
html:root .overview-charts .note,html:root .preference-map>.note{margin-top:var(--space-3)}
html:root .preference-map{margin:var(--space-8) 0}
html:root .preference-rows{gap:var(--space-6) var(--space-8);margin-top:var(--space-6)}
html:root .portrait{max-width:var(--reading);margin:var(--space-8) auto var(--space-12)}
html:root .portrait h2{margin-top:0}
html:root .portrait-intro{margin-top:var(--space-4);line-height:1.65}
html:root .portrait-chapter{margin-top:var(--space-8)}
html:root .portrait-chapter h3{margin-bottom:var(--space-3);line-height:1.4}
html:root .portrait-chapter>p{font-size:var(--text-base);line-height:1.8}
html:root .portrait-evidence blockquote{margin:var(--space-3) 0;padding:var(--space-2) var(--space-4)}
html:root .traits,html:root .improves,html:root .caps{gap:var(--space-6)}
html:root .trait,html:root .improve{padding:var(--space-6);border-radius:var(--radius-xs)}
html:root .dim-body{padding:0 var(--space-6) var(--space-6)}
html:root .dimension>summary{padding:var(--space-4) var(--space-6)}
html:root .about{margin-top:var(--space-12);padding:var(--space-6);line-height:1.75}
html:root .foot{margin-top:var(--space-6)}
@media(max-width:640px){html:root .page{padding:var(--space-4) 20px var(--space-8)}html:root .hero,html:root .panel,html:root .trait,html:root .improve{padding:var(--space-4)}html[data-hero=editorial] .hero{padding:var(--space-6) 0}html:root .grid{grid-template-columns:1fr}html:root .portrait-chapter>p{font-size:var(--text-base)}}
/* Open composition: statistics are a strip, comparisons share a field, prose follows rules. */
html:root :is(.sig,.panel,.trait,.dimension,.fact,.about,.minor,.improve,.cap,.cap-item,.signals li,.chg){background:transparent;border:0;border-radius:0;box-shadow:none}
html:root .sigs{background:transparent;border:0;border-radius:0;overflow:visible;gap:24px;border-block:1px solid var(--border);padding:18px 0}
html:root .sig{padding:0;min-width:0}
html:root .panel{padding:24px 0;border-top:1px solid var(--border)}
html:root .overview-charts{grid-template-columns:var(--overview-columns);gap:40px}
html:root .traits{grid-template-columns:1fr;gap:0}
html:root .trait{display:grid;grid-template-columns:minmax(160px,1fr) minmax(0,2fr);column-gap:32px;padding:24px 0;border-top:1px solid var(--border)}
html:root .trait>header{grid-column:1;grid-row:span 3;display:block}
html:root .trait>header .badge{display:inline-block;margin-top:8px}
html:root .trait>:not(header){grid-column:2}
html:root .trait blockquote{margin-top:12px}
html:root .dimension{border-top:1px solid var(--border)}
html:root .dimension>summary,html:root .dimension.static{padding:18px 0}
html:root .dim-body{padding:0 0 24px}
html:root .caps{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:32px 40px}
html:root .cap{padding:24px 0;border-top:2px solid var(--border)}
html:root .cap-item{padding:10px 0;border-top:1px solid var(--border)}
html:root .improves{gap:0;max-width:var(--reading)}
html:root .improve{padding:24px 0;border-top:1px solid var(--border)}
html:root .signals li{padding:12px 0;border-top:1px solid var(--border)}
html:root .chg{padding:10px 0;border-bottom:1px solid var(--border)}
html:root .improve-impact{margin-top:8px}
html:root .about{padding:24px 0;border-top:1px solid var(--border);max-width:var(--reading)}
html:root .panel{padding-top:var(--panel-top)}
@media(min-width:900px){html:root .report-view-detail .portrait{max-width:none;display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);column-gap:48px}html:root .portrait>h2,html:root .portrait>.portrait-intro{grid-column:1/-1;max-width:var(--reading)}html:root .portrait-chapter{grid-column:1;max-width:var(--reading)}html:root .portrait-preferences{grid-column:2;grid-row:3 / span 12;align-self:start;margin-top:32px;font-size:var(--text-sm)}}
@media(max-width:760px){html:root .caps,html:root .overview-charts{grid-template-columns:1fr}html:root .trait{display:block}html:root .trait>header{display:flex}html:root .trait>header .badge{margin-top:0}html:root .sigs{gap:20px}html:root .panel,html:root .trait,html:root .improve{padding:20px 0}}
@page{size:A4;margin:16mm 17mm 18mm}
@media print{
html:root body{font-size:10pt;line-height:1.5;background:var(--bg);color:var(--fg)}
html:root .page{max-width:none;padding:0;margin:0}
html:root .topbar,html:root .view-nav,html:root .page-turn,html:root .switch{display:none!important}
html:root .report-view{display:block!important;line-height:1.5}
html:root .report-view-detail{break-before:auto;max-width:none;margin:0}
html:root .hero{padding:5mm;border-radius:0;display:block;break-inside:auto;min-height:0}
html[data-hero=editorial] .hero{padding:0 0 5mm}
html:root .hero h1{font-size:25pt;line-height:1.15}
html:root .hero .tagline{font-size:13pt;line-height:1.45}
html:root .hero .desc{font-size:10pt;line-height:1.5}
html:root .identity-signatures{margin-top:4mm;gap:4mm;break-inside:auto}
html:root .identity-signatures article{padding:3mm 0;break-inside:avoid}
html:root .identity-signatures h2{font-size:10pt}
html:root .identity-signatures p{font-size:9pt;line-height:1.5}
html:root .view-heading{margin:6mm 0 4mm;break-inside:avoid;break-after:avoid}
html:root .view-heading h2,html:root section>h2,html:root .section-head h2{font-size:16pt;margin:6mm 0 3mm}
html:root h2,html:root h3,html:root h4,html:root summary{break-after:avoid}
p,li,blockquote{orphans:3;widows:3}
html:root .grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-bottom:4mm}
html:root .grid>.panel{break-inside:avoid}
html:root .overview-charts{margin-bottom:4mm}
html:root .overview-charts .overview-bars{margin-top:3mm;gap:2mm}
html:root .overview-charts .note{margin-top:2mm;line-height:1.4}
html:root .preference-map{margin:4mm 0}
html:root .preference-rows{margin-top:3mm;gap:3mm 5mm}
html:root .preference-rail{margin:12px 8px 8px}
html:root .measured{grid-template-columns:repeat(3,minmax(0,1fr))}
html:root .measured .panel{padding:3mm}
html:root .measured .donut{gap:8px;flex-wrap:wrap}
html:root .measured .donut svg{width:70px}
html:root .measured .legend{font-size:8pt}
html:root .measured .shares li{grid-template-columns:minmax(42px,1fr) 1fr 45px;font-size:8pt}
html:root .sigs{margin:4mm 0}
html:root .sig{padding:3mm}
html:root .hero .copy{max-width:none}
html:root .hero .graphic,html:root .hero-clock{display:none}
html:root .cap-lead,html:root .progress{break-inside:avoid}
html:root .cap-lead>*+*{margin-top:3mm}
html:root .dims{display:block;columns:2;column-gap:4mm}
html:root .dimension{display:inline-block;width:100%;position:relative}
html:root .dimension>summary{display:block}
html:root .dimension>summary::after{display:none}
html:root .dimension .dim-name{display:block;padding-right:60px;margin:0;font-size:7.5pt}
html:root .dimension .dim-main{display:block;margin-top:2mm;font-size:8.5pt;line-height:1.45}
html:root .dimension .badge{position:absolute;top:2mm;right:3mm;margin:0;font-size:7pt;padding:1px 4px}
html:root .about h2{font-size:12pt;margin:0 0 3mm}
html:root .dimension{margin-bottom:3mm;break-inside:avoid}
html:root .dimension>summary{padding:2mm 3mm}
html:root .dim-body{padding:0 3mm 2mm}
html:root .dim-body blockquote{font-size:8.5pt;line-height:1.4;padding:2px 8px}
html:root .about{border:0;border-radius:0;border-top:1px solid var(--border);padding:4mm 0;break-inside:avoid}

html:root .cols,html:root .stack{height:100px}
html:root .heat-c{height:14px}
html:root .cap p,html:root .trait p,html:root .dim-body p,html:root .improve p{font-size:9pt;line-height:1.5}
html:root .overview-bars li{font-size:9pt;gap:8px}
html:root .panel .note{font-size:8pt;line-height:1.5}
html:root .panel{padding:4mm;margin-bottom:4mm;border-radius:0;break-inside:auto}
html:root .overview-charts{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
html:root .overview-charts>.panel{margin-bottom:0;break-inside:avoid}
html:root .panel:has(.heat),html:root .panel:has(.cal),html:root .panel:has(.cols),html:root .panel:has(.stack){break-inside:avoid}
html:root .cap{display:block}
html:root .cap>*+*{margin-top:3mm}
html:root .portrait{display:block;max-width:none;margin:5mm 0}
html:root .portrait-intro{font-size:12pt;line-height:1.6}
html:root .portrait-chapter{margin-top:5mm;padding-top:0;break-inside:auto}
html:root .portrait-chapter h3{font-size:12pt}
html:root .portrait-chapter>p{font-size:10pt;line-height:1.6}
html:root .portrait-axis,html:root .cap,html:root .improve{break-inside:auto}
html:root .traits,html:root .caps,html:root .improves{display:block}
html:root .trait,html:root .cap,html:root .improve{display:block;margin-bottom:4mm;padding:3mm 0}
html:root blockquote,html:root .cap-item,html:root .preference-row,html:root svg{break-inside:avoid}
html:root blockquote{font-size:9pt;line-height:1.5}
html:root .about{margin-top:4mm;font-size:8.5pt;line-height:1.45;padding:3mm 0}
html:root .tip::after,html:root .tip::before{display:none!important}
html:root .tech-time{overflow:visible;font-size:8pt}
}
`
