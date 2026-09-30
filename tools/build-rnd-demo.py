"""Sinh rnd-workspace-demo.html (bản demo training R&D Workspace) từ rnd-workspace.html.

Chạy lại MỖI KHI rnd-workspace.html thay đổi, để bản demo luôn giống trang thật:
    python3 tools/build-rnd-demo.py

Bản demo:
  - không nạp MSAL / auth.js / graph.js → không đăng nhập, không gọi SharePoint;
  - FISG_CFG.USE_GRAPH = false, window.FISG_DEMO_AUTO = true;
  - dữ liệu mô phỏng: js/data/demo-funnel.js + lớp training js/data/demo-rnd.js (thanh demo, đổi vai, hướng dẫn, góp ý);
  - link Sales Funnel / nút quay lại trỏ sang salesfunnel-demo.html.
Deeplink giống trang thật: rnd-workspace-demo.html?open=RD-…&mode=&type=&ncc=&q=
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
SRC = os.path.join(ROOT, "rnd-workspace.html")
OUT = os.path.join(ROOT, "rnd-workspace-demo.html")

s = open(SRC, encoding="utf-8").read()

def sub(pattern, repl, count=1, flags=0):
    """Thay thế bắt buộc phải khớp — rnd-workspace.html đổi cấu trúc thì dừng lại để sửa script, không sinh file sai."""
    global s
    s2, n = re.subn(pattern, repl, s, count=count, flags=flags)
    if n == 0:
        sys.exit("[build-rnd-demo] Không tìm thấy mẫu trong rnd-workspace.html: " + pattern)
    s = s2

HEAD_NOTE = ("<!-- AUTO-GENERATED từ rnd-workspace.html bởi tools/build-rnd-demo.py — KHÔNG sửa tay.\n"
             "     Bản demo training R&D Workspace: dữ liệu mô phỏng, không đăng nhập, không kết nối SharePoint. -->\n")
sub(r"<!DOCTYPE html>\n", "<!DOCTYPE html>\n" + HEAD_NOTE)

# Tiêu đề + không cho máy tìm kiếm lập chỉ mục
sub(r'<title data-i18n="[^"]*">[^<]*</title>',
    '<title data-i18n="rdd.pageTitle">FI SAIGON — R&amp;D Workspace · Demo training</title>\n<meta name="robots" content="noindex">')

# Bỏ mọi thứ liên quan đăng nhập Microsoft 365
sub(r'<script src="js/lib/resume\.js[^"]*"></script>\n', "")
sub(r'<script src="https://cdn\.jsdelivr\.net/npm/@azure/msal-browser[^\n]*</script>\n', "")
sub(r'<script src="js/auth\.js[^"]*"></script>\n', "")
sub(r'<script src="js/graph\.js[^"]*"></script>\n', "")

# Màn hình đăng nhập: demo tự vào app
sub(r'<!-- ══════════ LOGIN ══════════ -->\n<div id="sfLogin">.*?\n</div>\n',
    '<!-- Bản demo training: không đăng nhập, không kết nối SharePoint -->\n<div id="sfLogin" hidden></div>\n', flags=re.S)

# Chế độ demo: tắt Graph, bật dữ liệu mô phỏng
sub(r'(<script src="js/sp-config\.js[^"]*"></script>\n)',
    r'\1<script>window.FISG_CFG.USE_GRAPH = false; window.FISG_DEMO_AUTO = true;</script>\n')

# CSS riêng của bản demo
sub(r'(<link rel="stylesheet" href="rnd-workspace\.css[^"]*">\n)', r'\1<link rel="stylesheet" href="rnd-demo.css?v=1">\n')
sub(r'<body class="sf-body rdw-page">', '<body class="sf-body rdw-page rnd-demo">')

# Nút quay lại → bản demo (link Sales Funnel trong popover hồ sơ do js/views/rnd-page.js tự chọn theo FISG_DEMO_AUTO)
sub(r'(<a class="sf-home" href=")index\.html(")', r'\1salesfunnel-demo.html\2')

# Dữ liệu mô phỏng + lớp training (nạp cuối cùng, sau mọi view)
sub(r"</body>", '<script src="js/data/demo-funnel.js?v=18"></script>\n'
                '<script src="js/data/demo-rnd.js?v=2"></script>\n</body>')

open(OUT, "w", encoding="utf-8").write(s)
print("[build-rnd-demo] đã ghi", os.path.relpath(OUT, ROOT), "·", len(s), "ký tự")
