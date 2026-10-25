import asyncio
import json
import re
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
                    print(f"[XHR/Fetch {res.status}] {req.method} {req.url}")
                    if any(k in req.url.lower() for k in ["fare", "search", "calendar", "price", "api", "graphql", "flight"]):
                        print(f"  Req post_data: {req.post_data[:200] if req.post_data else None}")
                        print(f"  Res body excerpt: {text[:300]}")
                except Exception as e:
                    print(f"[XHR/Fetch {res.status} Err] {req.url}: {e}")

        page.on('response', handle_response)

        print("--- Navigating to gotogate.in ---")
        try:
            await page.goto("https://www.gotogate.in/", wait_until="networkidle", timeout=30000)
        except Exception as e:
            print(f"Goto error: {e}")

        print(f"Page title: {await page.title()}")

        # Extract JS bundle URLs from page
        scripts = await page.eval_on_selector_all('script[src]', 'nodes => nodes.map(n => n.src)')
        print(f"Found {len(scripts)} script tags")
        for s in scripts:
            print(f" Script: {s}")

        await browser.close()

asyncio.run(run())
