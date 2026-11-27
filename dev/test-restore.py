# Reject an idea, bring it back from the idea card, reject again, bring back from Decisions, then keep it.
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1400, "height": 950})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://localhost:4321/#brand"); pg.click("#loadSample")
    pg.click("nav button[data-view=research]"); pg.click("#runIdeas")
    pg.wait_for_selector("#ideasOut .idea", timeout=20000)
    card = "#ideasOut .idea >> nth=1"
    pg.click(f"{card} >> [data-act=reject-open]"); pg.fill(f"{card} >> .reject-form input", "Too similar to my Seneca post"); pg.click(f"{card} >> [data-act=reject]")
    pg.click(f"{card} >> [data-act=restore]"); pg.wait_for_timeout(200)
    print("after card restore, keep button visible:", pg.locator(f"{card} >> [data-act=keep]").count())
    pg.click(f"{card} >> [data-act=reject-open]"); pg.fill(f"{card} >> .reject-form input", "Still not right"); pg.click(f"{card} >> [data-act=reject]")
    pg.click("nav button[data-view=log]"); pg.click("#logOut [data-restore]"); pg.wait_for_timeout(200)
    pg.click("#logOut [data-keep]"); pg.wait_for_timeout(300)
    pg.screenshot(path="/tmp/screens/restore-log.png", full_page=True)
    print(pg.inner_text("#logOut").split("\n")[0])
    pg.click("#logFilter [data-f=restored]"); print("restored rows:", pg.locator("#logOut tbody tr").count())
    print("in plan:", pg.evaluate("JSON.parse(localStorage.getItem('lk2_plan')).map(x=>x.title)"))
    pg.click("nav button[data-view=research]"); print("card state:", pg.inner_text(f"{card} >> .idea-actions"))
    print("errors:", errs or "none"); b.close()
