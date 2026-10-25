import urllib.request
import re
import json

urls = [
    "https://in.gotogate.com/system/js/fire-engine.js",
    "https://in.gotogate.com/system/js/main.js",
    "https://in.gotogate.com/system/spa/ibeclient/static/js/runtime-main.38adcd73.js",
    "https://in.gotogate.com/system/spa/ibeclient/static/js/286.525d72e7.js",
    "https://in.gotogate.com/system/spa/ibeclient/static/js/main.fa139e95.js"
]

req_headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0'
}

for url in urls:
    print(f"\n--- Downloading {url} ---")
    try:
        req = urllib.request.Request(url, headers=req_headers)
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode('utf-8', errors='ignore')
            print(f"Size: {len(content)} bytes")
            
            # Find GraphQL operation names
            ops = set(re.findall(r'operationName["\']?\s*[:=]\s*["\']([^"\'\s]+)["\']', content))
            print(f"GraphQL operationNames: {ops}")

            # Find query / mutation keywords
            queries = set(re.findall(r'(?:query|mutation)\s+([A-Za-z0-9_]+)', content))
            print(f"GraphQL queries/mutations: {queries}")

            # Search for calendar, lowfare, fare, price, api
            matches = set()
            for kw in ['fare', 'calendar', 'lowfare', 'price', 'search', 'graphql', 'flight', 'api/']:
                m = re.findall(rf'.{{0,40}}{kw}.{{0,40}}', content, re.IGNORECASE)
                for item in m[:10]:
                    matches.add(item.strip().replace('\n', ' '))
            
            print(f"Keyword samples:")
            for sample in list(matches)[:20]:
                print(f"  {sample}")

    except Exception as e:
        print(f"Error: {e}")
