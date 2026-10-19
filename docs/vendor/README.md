# Vendored libraries

Served from this site instead of a CDN, so the page only runs code from this repo (see the
Content-Security-Policy in life-os.html). `build_docs.py` copies this folder to `docs/vendor/`.

| File | Package | Source |
|---|---|---|
| `chart.umd.js` | chart.js 4.4.0 | `dist/chart.umd.js` from the npm tarball (sha512 matched the registry) |
| `pdfjs/pdf.min.mjs`, `pdfjs/pdf.worker.min.mjs` | pdfjs-dist 4.10.38 | `build/` of the devDependency (lockfile integrity) |

SHA-256 (check with `cd vendor && sha256sum -c` after pasting these into a file):

```
321e3a3fa98da4aaa957d10be57cbb514de0989eed8f9d726b5d05902cd01904  chart.umd.js
27fc2a057a00f92a4334ad06e17dbd7259912954e9fb7f76400bcca5fd190a9c  pdfjs/pdf.min.mjs
1baa1844c89c80a5b2797c916e75ab29254be46d8e9cb53cb6364d7aad84be36  pdfjs/pdf.worker.min.mjs
```

To update: `npm pack <package>@<version>`, compare `openssl dgst -sha512 -binary <tgz> | base64` with
`npm view <package>@<version> dist.integrity`, copy the same files here, update this table and the sums,
and bump `CACHE_NAME` in `sw.js`.
