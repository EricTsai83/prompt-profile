"""Optional PDF QA: uv run --with pymupdf python scripts/pdf-inspect.py.
Render every delivered page and check A4 geometry, nonblank text and text bounds.
"""
import json
from pathlib import Path
import pymupdf

root = Path('tmp/pdfs')
root.mkdir(parents=True, exist_ok=True)
results = []
for path in sorted([*Path('output/pdf').glob('*.pdf'), *root.glob('classic-*.pdf')]):
    doc = pymupdf.open(path)
    pages = []
    for stale in root.glob(f'{path.stem}-[0-9][0-9].png'):
        stale.unlink()
    old_contact = root / f'{path.stem}.pdf.png'
    if old_contact.exists():
        old_contact.unlink()
    # This fictional gallery records one Ship measurement. Its heading must travel with it.
    texts = [page.get_text() for page in doc]
    # These exports use the fixed fictional gallery, not arbitrary user profiles.
    assert len(doc) <= 10, (path, 'Pagination regression in the fictional report')
    method = 'How this was measured' if path.stem.endswith('-en') else '\u9019\u4efd\u5831\u544a\u600e\u9ebc\u91cf\u7684'
    assert texts[-1].find(method) > 100, (path, 'Methodology stranded on a sparse final page')
    measurement_pages = [i for i, text in enumerate(texts) if '144 PR' in text]
    if path.stem.endswith('-en') and measurement_pages:
        heading_pages = [i for i, text in enumerate(texts) if '\nShip\n' in '\n' + text]
        assert heading_pages == measurement_pages, (path, 'Ship heading separated from its data')
    if path.stem.endswith("-en"):
        progress_pages = [i for i, text in enumerate(texts) if "Since your last report" in text]
        assert all("16%" in texts[i] for i in progress_pages), (path, "Comparison heading separated from its data")
    for i, page in enumerate(doc):
        text = page.get_text()
        assert len(text.strip()) > 35, (path, i, 'blank page')
        assert abs(page.rect.width - 595.28) < 2 and abs(page.rect.height - 841.89) < 2
        for block in page.get_text('blocks'):
            assert block[0] >= 0 and block[1] >= 0 and block[2] <= page.rect.width + 1 and block[3] <= page.rect.height + 1, (path, i, block)
        target = root / f'{path.stem}-{i+1:02}.png'
        page.get_pixmap(matrix=pymupdf.Matrix(1, 1)).save(target)
        pages.append(str(target))
    sheet = pymupdf.open()
    contact = sheet.new_page(width=1192, height=((len(doc)+2)//3)*562)
    for i in range(len(doc)):
        contact.show_pdf_page(pymupdf.Rect((i%3)*397, (i//3)*562, (i%3+1)*397, (i//3+1)*562), doc, i)
    contact.get_pixmap().save(root / f'{path.stem}-contact.png')
    results.append({'pdf': str(path.resolve()), 'pages': len(doc), 'renders': pages})
(root / 'inventory.json').write_text(json.dumps(results, indent=2))
print(json.dumps(results, indent=2))
