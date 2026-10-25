import urllib.request
import re

url = "https://in.gotogate.com/system/spa/ibeclient/static/js/main.fa139e95.js"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    content = resp.read().decode('utf-8', errors='ignore')

matches = re.findall(r'query\s+(?:bestPricesPerPeriod|GetNearbyDatePrices|SearchOnResultPage|getBestPricesPerDay)[\s\S]*?(?="|\:\{kind)', content)
for m in matches:
    print("---------------------------------------")
    print(m)

