# Drives the whole interface in a headless browser against dev/server.mjs and saves screenshots.
# Usage: node dev/server.mjs &  then  python3 dev/test-ui.py
import sys
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else "dev/screens"
import os; os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 900})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and "fonts" not in m.text else None)
    pg.goto("http://localhost:4321/")
    pg.wait_for_timeout(400)
    pg.screenshot(path=f"{OUT}/1-studio-empty.png", full_page=True)

    pg.click("nav button[data-view=brand]")
    pg.click("#loadSample")
    pg.wait_for_timeout(300)
    pg.screenshot(path=f"{OUT}/2-brand.png", full_page=True)

    pg.click("nav button[data-view=research]")
    pg.click("#focusChips .chip >> nth=0")
    pg.click("#runIdeas")
    pg.wait_for_timeout(2600)
    pg.screenshot(path=f"{OUT}/3-research-live.png", full_page=False)
    pg.wait_for_selector("#ideasOut .idea", timeout=20000)
    pg.click("#ideasOut .idea >> nth=0 >> .idea-top")
    pg.click("#ideasOut .idea >> nth=0 >> [data-act=keep]")
    pg.click("#ideasOut .idea >> nth=1 >> [data-act=reject-open]")
    pg.fill("#ideasOut .idea >> nth=1 >> .reject-form input", "Too close to a post I already made")
    pg.click("#ideasOut .idea >> nth=1 >> [data-act=reject]")
    pg.wait_for_timeout(300)
    pg.screenshot(path=f"{OUT}/4-research-done.png", full_page=True)

    pg.click("nav button[data-view=remix]")
    pg.fill("#refCreator", "@othercreator")
    pg.fill("#refDesc", "Contrarian talking-head reel arguing Nietzsche would hate modern self-help, with a story about quitting a corporate job.")
    pg.fill("#refLiked", "The contrarian hook")
    pg.click("#runRemix")
    pg.wait_for_selector("#remixOut .idea", timeout=20000)
    pg.click("#remixOut [data-act=keep]")
    pg.wait_for_timeout(300)
    pg.screenshot(path=f"{OUT}/5-remix.png", full_page=True)

    pg.click("nav button[data-view=plan]")
    pg.click(".plan-card >> nth=0 >> [data-move='1']")
    pg.wait_for_timeout(200)
    pg.screenshot(path=f"{OUT}/6-plan.png", full_page=True)

    pg.click("nav button[data-view=log]")
    pg.screenshot(path=f"{OUT}/7-decisions.png", full_page=True)
    log_text = pg.inner_text("#logOut")

    pg.click("nav button[data-view=home]")
    pg.wait_for_timeout(200)
    pg.screenshot(path=f"{OUT}/8-studio-filled.png", full_page=True)

    pg.click("nav button[data-view=how]")
    pg.screenshot(path=f"{OUT}/9-how.png", full_page=True)

    pg.reload(); pg.wait_for_timeout(400)
    persisted = pg.input_value("[name=niche]")
    ideas_after_reload = pg.locator("#ideasOut .idea").count()

    m = b.new_page(viewport={"width": 390, "height": 844})
    m.goto("http://localhost:4321/#research"); m.wait_for_timeout(500)
    m.screenshot(path=f"{OUT}/10-mobile.png", full_page=False)

    print("decision log:", " | ".join(log_text.splitlines()[:4]))
    print("profile persisted:", bool(persisted), "| ideas restored after reload:", ideas_after_reload)
    print("errors:", errors or "none")
    b.close()
