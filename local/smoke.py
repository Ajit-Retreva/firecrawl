"""Exercise the running API without a Firecrawl account or paid provider."""
import argparse
import base64
import json
import time
import urllib.request
import urllib.error

parser = argparse.ArgumentParser()
parser.add_argument('--ai', action='store_true')
args = parser.parse_args()
BASE = 'http://127.0.0.1:3002'

def request(path, data=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(BASE + path, data=body, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'{path}: HTTP {error.code}: {error.read().decode()}') from error
    assert result.get('success', True), result
    return result

for version in ['v1', 'v2']:
    result = request(f'/{version}/scrape', {'url': 'https://example.com', 'formats': ['markdown'], 'timeout': 60000})
    assert 'Example Domain' in result['data']['markdown'], result
    print(f'PASS {version} markdown scrape')

result = request('/v2/scrape', {
    'url': 'https://example.com', 'formats': ['rawHtml', {'type': 'screenshot', 'viewport': {'width': 640, 'height': 480}}],
    'actions': [{'type': 'executeJavascript', 'script': 'document.body.innerHTML="<h1>Local browser works</h1>"; return 42;'}, {'type': 'scrape'}],
    'timeout': 60000,
})['data']
assert 'Local browser works' in result['rawHtml'], result
assert base64.b64decode(result['screenshot'].split(',')[1])[1:4] == b'PNG'
assert result['actions']['javascriptReturns'][0]['value'] == 42
print('PASS screenshots and browser actions through public API')

search = request('/v2/search', {'query': 'example domain', 'limit': 3})
assert len(search['data']['web']) > 0, search
print('PASS local search')

mapped = request('/v2/map', {'url': 'https://docs.firecrawl.dev', 'limit': 5, 'sitemap': 'only'})
assert len(mapped['links']) > 0, mapped
print('PASS site mapping')

crawl = request('/v2/crawl', {'url': 'https://example.com', 'limit': 1, 'scrapeOptions': {'formats': ['markdown']}})
for _ in range(90):
    result = request('/v2/crawl/' + crawl['id'])
    if result['status'] == 'completed':
        assert len(result['data']) == 1, result
        print('PASS queued site crawl')
        break
    assert result['status'] != 'failed', result
    time.sleep(2)
else:
    raise RuntimeError('Crawl did not complete')

job = request('/v2/batch/scrape', {'urls': ['https://example.com', 'https://example.org'], 'formats': ['markdown']})
for _ in range(90):
    result = request('/v2/batch/scrape/' + job['id'])
    if result['status'] == 'completed':
        assert len(result['data']) == 2, result
        print('PASS queued batch scrape')
        break
    assert result['status'] != 'failed', result
    time.sleep(2)
else:
    raise RuntimeError('Batch scrape did not complete')

if args.ai:
    result = request('/v2/scrape', {
        'url': 'https://example.com', 'timeout': 120000,
        'formats': [{'type': 'json', 'prompt': 'Extract the page heading.', 'schema': {
            'type': 'object', 'properties': {'heading': {'type': 'string'}}, 'required': ['heading'],
        }}],
    })['data']
    assert 'Example Domain' in result['json']['heading'], result
    print('PASS structured extraction with local Ollama')
