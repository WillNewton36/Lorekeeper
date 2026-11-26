# Uploads a Meta Business Suite style export on the Brand page and checks what Lorekeeper reads.
# Usage: node dev/server.mjs &  then  python3 dev/test-upload.py path/to/export.csv
import sys
from playwright.sync_api import sync_playwright
path = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1400, "height": 1000})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://localhost:4321/#brand"); pg.wait_for_timeout(300)
    pg.set_input_files("#postsFile", path); pg.wait_for_timeout(700)
    print(pg.input_value("[name=posts]"))
    print("---"); print(pg.inner_text("#postsPreview")); print("toast:", pg.inner_text("#toast"))
    pg.screenshot(path="/tmp/upload.png", full_page=True)
    print("errors:", errs or "none"); b.close()
