import json, re, subprocess, sys, time, urllib.parse, html, os
UA = 'portfolio-art-research/1.0 (michaljbodzianowski@gmail.com)'
OUT = sys.argv[1]
picks = {
  'cosmos-sky': 'Cloudy Day Cosmos (5052152240).jpg',
  'daisies-glow': 'Wild Daisies - Flickr - Deviations with Ray.jpg',
  'poppy-pale': 'IMG 6281-Papaver laestadianum.jpg',
  'blossom-sky': 'Magnolia blossom (Unsplash).jpg',
  'cottongrass-meadow': 'Cotton Grass (3309040096).jpg',
  'cottongrass-glow': 'Eriophorum angustifolium (7497599092).jpg',
  'lupine-green': 'Nootka Lupine (35817351762).jpg',
  'avens-white': 'Dryas octopetala 003.jpg',
  'cosmos-blush': 'White and Pink Cosmos.jpg',
}
def curl(url, binary=False):
    for n in range(6):
        r = subprocess.run(['curl', '-sL', '--max-time', '180', '-A', UA, url], capture_output=True)
        if r.returncode == 0 and len(r.stdout) > 500:
            return r.stdout
        time.sleep(5 * (n + 1))
    raise SystemExit('fail ' + url)
def strip(s): return html.unescape(re.sub(r'<[^>]+>', ' ', s or '')).strip()
meta = {}
for slug, f in picks.items():
    q = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'titles': 'File:' + f, 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata', 'iiurlwidth': 2400, 'format': 'json'})
    p = list(json.loads(curl(q))['query']['pages'].values())[0]
    ii = p['imageinfo'][0]
    m = ii['extmetadata']
    data = curl(ii['thumburl'])
    open(f'{OUT}/{slug}.jpg', 'wb').write(data)
    meta[slug] = {
        'title': f, 'commonsPage': ii['descriptionurl'], 'originalUrl': ii['url'].split('?')[0], 'originalSize': [ii['width'], ii['height']],
        'artist': strip(m.get('Artist', {}).get('value'))[:160], 'license': m.get('LicenseShortName', {}).get('value'),
        'licenseUrl': m.get('LicenseUrl', {}).get('value', ''), 'date': strip(m.get('DateTimeOriginal', {}).get('value'))[:40],
        'credit': strip(m.get('Credit', {}).get('value'))[:200], 'attributionRequired': m.get('AttributionRequired', {}).get('value'),
        'usage': strip(m.get('UsageTerms', {}).get('value'))[:120],
    }
    print(slug, meta[slug]['license'], meta[slug]['artist'])
    time.sleep(3)
json.dump(meta, open(f'{OUT}/_meta.json', 'w'), indent=1, ensure_ascii=False)
