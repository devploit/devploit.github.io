# Cloudflare response headers

`security-headers-rule.json` is the rule body for a zone-level Response Header
Transform Rule in the `http_response_headers_transform` phase.

Apply it only after reviewing existing response-header rules in Cloudflare. Add
it with the Rulesets API's single-rule `POST` operation so existing rules are
preserved, or reproduce the same `Set static` values in the dashboard under
Rules > Transform Rules > Response Header Transform Rules.

After deployment, verify both `/` and `/cves.html` with:

```sh
curl -sSI https://devploit.dev/ | rg -i 'content-security-policy|strict-transport-security|x-content-type-options|x-frame-options|referrer-policy|permissions-policy|cross-origin-opener-policy'
curl -sSI https://devploit.dev/cves.html | rg -i 'content-security-policy|strict-transport-security|x-content-type-options|x-frame-options|referrer-policy|permissions-policy|cross-origin-opener-policy'
```

The repository-level CSP meta tags are a fallback. The Cloudflare response
header is authoritative and adds `frame-ancestors`, which cannot be enforced by
a CSP meta tag.
