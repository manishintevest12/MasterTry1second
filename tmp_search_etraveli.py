import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path='/usr/bin/google-chrome',
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            viewport={'width': 1280, 'height': 800}
        )
        page = await context.new_page()

        async def handle_response(res):
            req = res.request
            if req.resource_type in ['xhr', 'fetch']:
                try:
                    text = await res.text()
                    print(f"\n[XHR/Fetch {res.status}] {req.method} {req.url}")
                    if req.post_data:
                        print(f"  POST data: {req.post_data[:500]}")
                    print(f"  Response excerpt: {text[:500]}")
                except Exception as e:
                    pass

        page.on('response', handle_response)

        print("--- Navigating to in.gotogate.com ---")
        await page.goto("https://in.gotogate.com/", wait_until="networkidle", timeout=30000)

        # Accept cookie banner if present
        try:
            accept_btn = page.locator("#onetrust-accept-btn-handler")
            if await accept_btn.is_visible():
                await accept_btn.click()
                print("Accepted cookie banner")
        except Exception as e:
            print("No cookie banner or error:", e)

        # Print page HTML or form inputs
        inputs = await page.eval_on_selector_all('input', 'nodes => nodes.map(n => ({id: n.id, name: n.name, placeholder: n.placeholder, value: n.value}))')
        print("Inputs:", inputs)

        # Let's see if there are buttons or search elements
        buttons = await page.eval_on_selector_all('button', 'nodes => nodes.map(n => ({text: n.innerText, id: n.id, type: n.type}))')
        print("Buttons:", buttons[:10])

        await browser.close()

asyncio.run(run())
