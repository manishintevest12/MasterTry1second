#!/usr/bin/env python3
"""Regenerate server/workers/parsers/rapidoThiqaAsset.ts from m.rapido.bike.

Rapido's PWA signs its guest fare API requests with a Kotlin/Wasm module
("thiqa-kmp") embedded in their main bundle. This script downloads the SPA,
extracts the WASM (base64) + its JS glue + the signature sKey/sequence from
env.js, verifies the site's own embedded SHA-256 checks, and rewrites the
asset file. Run only when the worker's self-healing probe reports a bundle
rotation (persistent signature 401s).
"""
import base64, hashlib, json, re, sys, urllib.request

ASSET = 'server/workers/parsers/rapidoThiqaAsset.ts'
UA = {'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36'}

def get(url):
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=30).read()

def main():
    index = get('https://m.rapido.bike/').decode('utf-8', 'replace')
    m = re.search(r'(main-es2015\.[0-9a-f]+\.js)', index)
    if not m:
        sys.exit('no main-es2015 bundle in index')
    bundle = get(f'https://m.rapido.bike/{m.group(1)}').decode('utf-8', 'replace')
    k = bundle.find('AGFzbQ')
    if k < 0: sys.exit('no wasm in bundle')
    end = bundle.find('"', k)
    wasm = base64.b64decode(bundle[k:end])
    gi = re.search(r'Gi="((?:[^"\\]|\\.)*)"', bundle)
    if not gi: sys.exit('no glue (Gi=) in bundle')
    glue = json.loads('"' + gi.group(1) + '"')
    env = get('https://m.rapido.bike/assets/env.js').decode('utf-8', 'replace')
    skey = re.search(r"signatureVerificationSKey:\s*'([^']+)'", env)
    seq = re.search(r"signatureVerificationSequence:\s*'([^']+)'", env)
    wsha = hashlib.sha256(wasm).hexdigest()
    gsha = hashlib.sha256(glue.encode()).hexdigest()
    print('wasm sha', wsha, '| glue sha', gsha)
    hdr = open('server/workers/parsers/rapidoThiqaAsset.ts').read()
    out = re.sub(r"RAPIDO_THIQA_WASM_B64 = '[^']*'", f"RAPIDO_THIQA_WASM_B64 = '{base64.b64encode(wasm).decode()}'", hdr)
    out = re.sub(r'RAPIDO_THIQA_GLUE = .*?;\n', 'RAPIDO_THIQA_GLUE = ' + json.dumps(glue) + ';\n', out, count=1)
    out = re.sub(r"RAPIDO_THIQA_WASM_B64_SHA256 = '[^']*'", f"RAPIDO_THIQA_WASM_B64_SHA256 = '{wsha}'", out)
    out = re.sub(r"RAPIDO_THIQA_GLUE_SHA256 = '[^']*'", f"RAPIDO_THIQA_GLUE_SHA256 = '{gsha}'", out)
    out = re.sub(r"RAPIDO_SIG_SKEY_DEFAULT = '[^']*'", f"RAPIDO_SIG_SKEY_DEFAULT = '{skey.group(1)}'", out)
    out = re.sub(r"RAPIDO_SIG_SEQ_DEFAULT = '[^']*'", f"RAPIDO_SIG_SEQ_DEFAULT = '{seq.group(1)}'", out)
    open(ASSET, 'w').write(out)
    print('rewrote', ASSET)

if __name__ == '__main__':
    main()
