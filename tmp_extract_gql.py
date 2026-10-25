import urllib.request
import re

url = "https://in.gotogate.com/system/spa/ibeclient/static/js/main.fa139e95.js"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    content = resp.read().decode('utf-8', errors='ignore')

targets = ['getBestPricesPerDay', 'bestPricesPerPeriod', 'GetNearbyDatePrices', 'SearchOnResultPage']

for t in targets:
    print(f"\n=================== {t} ===================")
    matches = [m.start() for m in re.finditer(re.escape(t), content)]
    for idx in matches:
        start = max(0, idx - 100)
        end = min(len(content), idx + 1000)
        snippet = content[start:end]
        print(f"--- Match at {idx} ---")
        print(snippet)

