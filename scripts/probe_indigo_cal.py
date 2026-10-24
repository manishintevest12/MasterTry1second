"""Quick cffi probe: IndiGo web token + fare calendar, Akasa availability."""
import json, sys
from curl_cffi import requests as cr

BASE = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Origin': 'https://www.goindigo.in', 'Referer': 'https://www.goindigo.in/',
    'Accept': 'application/json', 'Content-Type': 'application/json',
}

def token():
    r = cr.post('https://api-prod-session-skyplus6e.goindigo.in/v2/token/create',
                data=json.dumps({'strToken': '', 'subscriptionKey': '15faf8ddf1e8354e90e54fa098e8b1a8'}),
                headers={**BASE, 'User_key': '654a6a3cc4998e498e5c0c8ead072915'},
                impersonate='chrome', timeout=12)
    print('token status', r.status_code, r.text[:200])
    try:
        d = r.json()
        if isinstance(d, str):
            d = json.loads(d)
    except Exception:
        return None
    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k == 'token' and isinstance(v, str) and v.count('.') == 2:
                    return v
                rr = walk(v)
                if rr: return rr
        elif isinstance(o, list):
            for x in o:
                rr = walk(x)
                if rr: return rr
        return None
    return walk(d)

def calendar(tok, frm='IDR', to='DEL', dep='2026-10-28'):
    end = '2026-12-29'
    body = json.dumps({'startDate': f'{dep}T00:00:00', 'endDate': f'{end}T00:00:00',
                       'origin': frm, 'destination': to, 'currencyCode': 'INR',
                       'promoCode': '', 'lowestIn': 'M'})
    r = cr.post('https://api-prod-booking-skyplus6e.goindigo.in/v1/getfarecalendar',
                data=body, headers={**BASE, 'User_key': '15faf8ddf1e8354e90e54fa098e8b1a8',
                                    'Authorization': f'Bearer {tok}'},
                impersonate='chrome', timeout=15)
    print('cal status', r.status_code, r.text[:300])

if __name__ == '__main__':
    t = token()
    if t:
        print('token ok:', t[:30], '...')
        calendar(t)
    else:
        print('no token')
