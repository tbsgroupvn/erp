"""
Generate professional PDF from SYSTEM_DOCUMENTATION.md
Step 1: Convert MD → HTML with styling
Step 2: Use Chrome headless --print-to-pdf
"""

import markdown
import subprocess
import tempfile
from pathlib import Path
import re
import os

DOCS_DIR = Path(__file__).parent
MD_FILE = DOCS_DIR / "SYSTEM_DOCUMENTATION.md"
PDF_FILE = DOCS_DIR / "SYSTEM_DOCUMENTATION.pdf"
HTML_FILE = DOCS_DIR / "SYSTEM_DOCUMENTATION.html"

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

CSS = r"""
@page {
    size: A4;
    margin: 18mm 15mm 20mm 15mm;
}

body {
    font-family: 'Segoe UI', 'Noto Sans', Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.6;
    color: #1a1a1a;
    max-width: 100%;
}

/* Cover page */
.cover {
    page-break-after: always;
    text-align: center;
    padding-top: 140px;
    min-height: 90vh;
}
.cover h1 {
    font-size: 32pt;
    font-weight: 700;
    color: #1e3a5f;
    margin-bottom: 8px;
    letter-spacing: 1.5px;
}
.cover .subtitle {
    font-size: 13pt;
    color: #666;
    margin-bottom: 50px;
    font-weight: 300;
}
.cover .logo-line {
    width: 100px;
    height: 4px;
    background: linear-gradient(90deg, #1e3a5f, #3498db);
    margin: 25px auto;
    border-radius: 2px;
}
.cover .meta {
    font-size: 10.5pt;
    color: #555;
    margin-top: 80px;
    line-height: 2.2;
    text-align: center;
}
.cover .meta strong {
    color: #1e3a5f;
    display: inline-block;
    width: 140px;
    text-align: right;
    margin-right: 10px;
}
.cover .badge-row {
    margin-top: 50px;
    display: flex;
    justify-content: center;
    gap: 15px;
    flex-wrap: wrap;
}
.cover .badge {
    display: inline-block;
    background: #1e3a5f;
    color: white;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 9pt;
    font-weight: 500;
}

/* TOC */
.toc-section {
    page-break-after: always;
}
.toc-section h2 {
    color: #1e3a5f;
    font-size: 18pt;
    border-bottom: 3px solid #1e3a5f;
    padding-bottom: 8px;
    margin-bottom: 20px;
}
.toc-section ul {
    list-style: none;
    padding-left: 0;
}
.toc-section > ul > li {
    border-bottom: 1px dotted #ccc;
    padding: 6px 0;
    font-size: 11pt;
}
.toc-section > ul > li > ul > li {
    padding: 3px 0 3px 25px;
    font-size: 10pt;
    border: none;
    color: #555;
}
.toc-section a {
    color: #1e3a5f;
    text-decoration: none;
}

/* Headings */
h1 {
    font-size: 22pt;
    color: #1e3a5f;
    margin-top: 40px;
    margin-bottom: 15px;
    page-break-after: avoid;
    border-bottom: 3px solid #1e3a5f;
    padding-bottom: 8px;
    page-break-before: always;
}

h2 {
    font-size: 16pt;
    color: #1e3a5f;
    margin-top: 30px;
    margin-bottom: 12px;
    page-break-after: avoid;
    border-bottom: 1.5px solid #d0d8e0;
    padding-bottom: 6px;
}

h3 {
    font-size: 13pt;
    color: #2c3e50;
    margin-top: 22px;
    margin-bottom: 8px;
    page-break-after: avoid;
}

h4 {
    font-size: 11pt;
    color: #34495e;
    margin-top: 16px;
    margin-bottom: 6px;
    page-break-after: avoid;
    font-weight: 600;
}

/* First h1 no page break */
body > h1:first-of-type,
.content > h1:first-of-type {
    page-break-before: avoid;
}

/* Tables */
table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 16px 0;
    font-size: 8.5pt;
    page-break-inside: auto;
    border: 1px solid #d0d8e0;
}
thead {
    display: table-header-group;
}
tr {
    page-break-inside: avoid;
}
th {
    background-color: #1e3a5f;
    color: white;
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
    font-size: 8.5pt;
    border: 1px solid #16304d;
}
td {
    padding: 5px 10px;
    border: 1px solid #dde2e8;
    vertical-align: top;
}
tr:nth-child(even) td {
    background-color: #f7f9fb;
}

/* Code blocks */
pre {
    background-color: #f5f7f9;
    border: 1px solid #d0d8e0;
    border-left: 4px solid #3498db;
    padding: 12px 16px;
    font-family: 'Cascadia Code', 'Consolas', 'Courier New', monospace;
    font-size: 8pt;
    line-height: 1.5;
    overflow-wrap: break-word;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 8px 0 14px 0;
    border-radius: 4px;
    page-break-inside: avoid;
}

code {
    background-color: #edf0f4;
    padding: 1px 5px;
    border-radius: 3px;
    font-family: 'Cascadia Code', 'Consolas', 'Courier New', monospace;
    font-size: 8.5pt;
    color: #c0392b;
}
pre code {
    background: none;
    padding: 0;
    color: inherit;
    font-size: inherit;
}

/* Lists */
ul, ol {
    padding-left: 24px;
    margin: 6px 0;
}
li {
    margin-bottom: 3px;
}
li > ul, li > ol {
    margin-top: 2px;
}

/* Blockquotes */
blockquote {
    border-left: 4px solid #3498db;
    margin: 12px 0;
    padding: 10px 18px;
    background: #eef6fd;
    color: #333;
    border-radius: 0 6px 6px 0;
}
blockquote p {
    margin: 4px 0;
    font-style: italic;
}

/* Horizontal rules */
hr {
    border: none;
    border-top: 2px solid #e0e4e8;
    margin: 25px 0;
}

/* Strong */
strong {
    color: #1a1a1a;
    font-weight: 600;
}

/* Links */
a {
    color: #2980b9;
    text-decoration: none;
}

/* Details/Summary */
details {
    margin: 10px 0;
    border: 1px solid #d0d8e0;
    border-radius: 6px;
    padding: 12px 16px;
    background: #fafbfc;
}
details[open] {
    padding-bottom: 4px;
}
summary {
    font-weight: 600;
    color: #1e3a5f;
    cursor: pointer;
    font-size: 11pt;
    margin-bottom: 10px;
}

/* Prevent orphans/widows */
p {
    orphans: 3;
    widows: 3;
    margin: 5px 0;
}

/* Footer area */
.doc-footer {
    margin-top: 40px;
    padding-top: 15px;
    border-top: 2px solid #1e3a5f;
    text-align: center;
    font-size: 9pt;
    color: #888;
}
"""


def create_cover_page():
    return """
<div class="cover">
    <div class="logo-line"></div>
    <h1 style="page-break-before:avoid; border:none;">TÀI LIỆU HỆ THỐNG ERP</h1>
    <div class="subtitle">Tài liệu kỹ thuật &amp; Hướng dẫn vận hành toàn diện</div>
    <div class="logo-line"></div>

    <div class="meta">
        <strong>Phiên bản:</strong> 3.0<br>
        <strong>Ngày cập nhật:</strong> 24/02/2026<br>
        <strong>Loại tài liệu:</strong> Nội bộ &mdash; Chuyển giao hệ thống<br>
        <strong>Kiến trúc:</strong> NestJS + Next.js 14 + PostgreSQL + Redis<br>
    </div>

    <div class="badge-row">
        <span class="badge">65+ Phân hệ</span>
        <span class="badge">95+ Mô hình</span>
        <span class="badge">7 Máy trạng thái</span>
        <span class="badge">22 Vai trò</span>
        <span class="badge">350+ Điểm cuối API</span>
    </div>
</div>
"""


def create_toc(md_text):
    """Generate a table of contents from headings."""
    toc_items = []
    for match in re.finditer(r'^(#{1,3})\s+(.+)$', md_text, re.MULTILINE):
        level = len(match.group(1))
        title = match.group(2).strip()
        # Skip non-content headings
        if title in ('TÀI LIỆU HỆ THỐNG ERP', 'MỤC LỤC'):
            continue
        indent = '  ' * (level - 1)
        toc_items.append(f'{indent}- {title}')

    toc_md = '\n'.join(toc_items[:60])  # Limit to avoid too-long TOC
    return f'''<div class="toc-section">
<h2 style="page-break-before:avoid;">MỤC LỤC</h2>

{markdown.markdown(toc_md)}
</div>
'''


def process_markdown(md_text):
    """Pre-process markdown for better PDF output."""
    # Remove the first title (cover page has it)
    md_text = re.sub(r'^# TÀI LIỆU HỆ THỐNG ERP\s*\n', '', md_text, count=1)
    # Remove version blockquote
    md_text = re.sub(r'^>\s*Phiên bản:.*?\n\n', '', md_text, flags=re.MULTILINE)
    # Remove original TOC section
    md_text = re.sub(r'^---\s*\n\s*## MỤC LỤC.*?(?=\n---)', '', md_text, flags=re.DOTALL)
    # Fix the first --- after cover removal
    md_text = re.sub(r'^\s*---\s*\n\s*---', '---', md_text)
    return md_text


def main():
    print("[1/4] Reading markdown...")
    md_text = MD_FILE.read_text(encoding='utf-8')

    raw_md = md_text  # Keep for TOC generation

    print("[2/4] Processing markdown to HTML...")
    md_text = process_markdown(md_text)

    extensions = [
        'markdown.extensions.tables',
        'markdown.extensions.fenced_code',
        'markdown.extensions.sane_lists',
    ]
    md_converter = markdown.Markdown(extensions=extensions)
    html_body = md_converter.convert(md_text)

    # Force all <details> open for PDF
    html_body = html_body.replace('<details>', '<details open>')

    cover = create_cover_page()
    toc = create_toc(raw_md)

    full_html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <title>TÀI LIỆU HỆ THỐNG ERP</title>
    <style>{CSS}</style>
</head>
<body>
    {cover}
    {toc}
    <div class="content">
    {html_body}
    </div>
    <div class="doc-footer">
        TÀI LIỆU HỆ THỐNG ERP &mdash; v3.0 &mdash; 24/02/2026 &mdash; Tạo tự động từ phân tích mã nguồn
    </div>
</body>
</html>
"""

    # Write HTML file
    HTML_FILE.write_text(full_html, encoding='utf-8')
    print(f"    HTML saved: {HTML_FILE}")

    print("[3/4] Generating PDF via Chrome headless...")
    cmd = [
        CHROME_PATH,
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--run-all-compositor-stages-before-draw',
        '--print-to-pdf=' + str(PDF_FILE),
        '--print-to-pdf-no-header',
        '--no-pdf-header-footer',
        str(HTML_FILE.as_uri()),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        print(f"Chrome stderr: {result.stderr}")

    print("[4/4] Verifying output...")
    if PDF_FILE.exists():
        file_size = PDF_FILE.stat().st_size / (1024 * 1024)
        print(f"    PDF: {PDF_FILE}")
        print(f"    Size: {file_size:.1f} MB")
        print("    Done!")
    else:
        print("    ERROR: PDF file not created!")
        print(f"    Chrome stdout: {result.stdout}")
        print(f"    Chrome stderr: {result.stderr}")


if __name__ == '__main__':
    main()
