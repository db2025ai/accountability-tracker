#!/usr/bin/env python3
"""Build docs/index.html by inlining CSS and JS into the HTML."""
import re

html = open('life-os.html', encoding='utf-8').read()
css = open('life-os.css', encoding='utf-8').read()
js = open('life-os.js', encoding='utf-8').read()

try:
    convex_js = open('convex-client.js', encoding='utf-8').read()
except FileNotFoundError:
    convex_js = ''

# Use str.replace instead of re.sub to avoid issues with backslashes in replacement
css_tag = f'<style>\n{css}\n</style>'
js_tag = f'<script>\n{js}\n</script>'
convex_tag = f'<script>\n{convex_js}\n</script>' if convex_js else ''

# Replace link tag
m = re.search(r'<link[^>]*href=["\']life-os\.css["\'][^>]*>', html)
if m:
    html = html[:m.start()] + css_tag + html[m.end():]

# Replace convex script tag
if convex_js:
    m = re.search(r'<script[^>]*src=["\']convex-client\.js["\'][^>]*></script>', html)
    if m:
        html = html[:m.start()] + convex_tag + html[m.end():]

# Replace main JS script tag
m = re.search(r'<script[^>]*src=["\']life-os\.js["\'][^>]*></script>', html)
if m:
    html = html[:m.start()] + js_tag + html[m.end():]

# Fix service worker path for GitHub Pages subpath
html = html.replace("navigator.serviceWorker.register('/sw.js')",
                    "navigator.serviceWorker.register('/accountability-tracker/sw.js')")

# Content-Security-Policy: allow only the inline scripts written above, by hash, so markup
# injected into the page can't run script (no 'unsafe-inline' in the published site)
import base64, hashlib
inline = re.findall(r'<script>(.*?)</script>', html, flags=re.S)
hashes = ' '.join("'sha256-%s'" % base64.b64encode(hashlib.sha256(body.encode('utf-8')).digest()).decode()
                  for body in inline)
policy = "script-src 'self' 'unsafe-inline';"
assert html.count(policy) == 1, "life-os.html's CSP should have script-src 'self' 'unsafe-inline'"
html = html.replace(policy, f"script-src 'self' {hashes};")

open('docs/index.html', 'w', encoding='utf-8').write(html)

# Copy manifest.json and sw.js into docs/ so GitHub Pages can serve them
import shutil, json
shutil.copy('sw.js', 'docs/sw.js')
# Libraries the page loads from this site (vendor/README.md)
shutil.copytree('vendor', 'docs/vendor', dirs_exist_ok=True)
manifest = json.load(open('manifest.json'))
json.dump(manifest, open('docs/manifest.json', 'w'), indent=2)

size = len(html)
print(f'Built docs/index.html ({size:,} bytes / {size//1024}KB)')
