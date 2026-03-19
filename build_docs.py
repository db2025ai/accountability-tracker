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

open('docs/index.html', 'w', encoding='utf-8').write(html)
size = len(html)
print(f'Built docs/index.html ({size:,} bytes / {size//1024}KB)')
