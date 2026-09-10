# Vercel gift email setup

Status (2026-09-11): Deployed on Vercel. The opt-in form is served at `/gifts/`. The site root `/` 307-redirects to https://portalsofawe.com/GaryMalkin/. Resend is verified and sending correctly in production. Gift destination (the "View Your Gift" button after opt-in): https://portalsofawe.com/garymalkin-audiotracks/. Google Sheets timed out during an earlier test and still needs follow-up.

## DNS

Registrar delegation for garymalkin.com is GoDaddy (ns67.domaincontrol.com, ns68.domaincontrol.com), confirmed by whois. Zone records have TTL 600 seconds.

A stale Cloudflare zone (alan.ns.cloudflare.com, amanda.ns.cloudflare.com) from a previous setup is still cached by some resolvers and will be until the old NS delegation TTL expires (up to ~48h from the cutover). While cached it serves the old records: apex A to Cloudflare proxy IPs, `www` CNAME to a Netlify site (curious-manatee-8e4f97.netlify.app), Google Workspace MX, and the apex SPF / google-site-verification TXT.

### Records that must be in the GoDaddy zone

Website + Resend (already present):

| Type | Name | Content | Priority |
| --- | --- | --- | --- |
| A | @ | 216.198.79.1 | — |
| CNAME | www | cf75af117550099f.vercel-dns-017.com. | — |
| TXT | resend._domainkey | p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCgPNhw6SzSfEfrBd8h6lY9I7TdFX9LsV+P6lPz/T0QwEbd4WAsIi9CG9lyIc0yD4NjUEjZxJI3gS+IYe4YVSd4qELMV9BV8cGK2dkK5PuNjLb4x+moNoXqwT5rB4FOPdeBfmlkkrhw6J/zw2L20YhkfV8nkkDZ1fObg/c11KjNqwIDAQAB | — |
| MX | send | feedback-smtp.ap-northeast-1.amazonses.com | 10 |
| TXT | send | v=spf1 include:amazonses.com ~all | — |
| TXT | _dmarc | v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net; | — |

Mail + verification (present in the stale Cloudflare zone, MISSING from GoDaddy — inbound mail to @garymalkin.com breaks once the Cloudflare cache expires unless these are added):

| Type | Name | Content | Priority |
| --- | --- | --- | --- |
| MX | @ | aspmx.l.google.com | 1 |
| MX | @ | alt1.aspmx.l.google.com | 5 |
| MX | @ | alt2.aspmx.l.google.com | 5 |
| MX | @ | alt3.aspmx.l.google.com | 10 |
| MX | @ | alt4.aspmx.l.google.com | 10 |
| TXT | @ | v=spf1 include:dc-aa8e722993._spfm.garymalkin.com ~all | — |
| TXT | @ | google-site-verification=H7H8ubBSTK_Xdad8212sE3W1Jub-cibyHWQfJK8jMEE | — |
| TXT | @ | D9758849 | — |

The SPF include points to `dc-aa8e722993._spfm.garymalkin.com`, whose TXT is not visible externally. Do not hand-copy record by record: in the Cloudflare dashboard, open the garymalkin.com zone, DNS > Records > Export, and reconcile the full zone file into GoDaddy. Keep the Vercel apex/www and Resend records above; drop the Netlify `www` records and the Cloudflare-proxy apex IPs.

### After propagation

Once the GoDaddy zone is complete and verified, remove/disable the garymalkin.com zone in Cloudflare, and detach www.garymalkin.com from the Netlify curious-manatee site. The old Cloudflare Worker square-frog-3b99.harshoswal711.workers.dev is unused and can be deleted.

Resend domain: https://resend.com/domains/0eef619a-2dbe-4662-9061-0ed17f114a24
Sending enabled, receiving disabled. Existing DMARC was preserved.

## Deployment

Project: gary-miracles-optin, scope vaibhavs-projects-a2cb3ce8. Node 24. The production RESEND_API_KEY is stored as a sensitive Vercel environment variable. Never commit credentials or environment files.

The frontend posts to /api/submit. api/submit.js adapts the worker handler to a Vercel Function. `npm run build` copies index.html to public/index.html and public/gifts/index.html; server code is not published as static content. vercel.json 307-redirects `/` to https://portalsofawe.com/GaryMalkin/, so the form is reached at `/gifts/` (the root static file is a harmless fallback if that redirect is ever removed). Cloudflare deployment is no longer needed for this implementation.

Vercel domains: garymalkin.com is primary (production), www.garymalkin.com 307-redirects to it.

1. Run npm test and npm run build.
2. Deploy: push to main (auto-deploys via the GitHub integration) or npx vercel deploy --prod --yes.
3. Load https://garymalkin.com/gifts/ and confirm the opt-in form renders; confirm https://garymalkin.com/ redirects to https://portalsofawe.com/GaryMalkin/.
4. Submit a test form and confirm emailOk true, Sheets storage, and Resend delivery. API acceptance does not prove inbox placement.
5. Keep the GitHub production branch aligned with the deployed source.

## Behavior

Resend sends independently of GHL and Sheets. Each upstream request has a ten-second timeout. HTTP failures are logged without upstream response bodies. The JSON response includes emailOk and leadSaved. The page only claims an email is on its way when emailOk is explicitly true; otherwise it tells the visitor to use the on-page gift link.

Six regression tests cover GHL 422, missing/rejected Resend credentials, failed lead sinks, and frontend success/failure messaging. Tests send no real emails.
