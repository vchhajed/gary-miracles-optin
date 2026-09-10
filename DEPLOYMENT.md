# Vercel gift email setup

Status (2026-09-11): Vercel preview built successfully and rejects empty submissions correctly. Resend domain is verified and a production test email was delivered. Gift destination: https://portalsofawe.com/garymalkin-audiotracks/. Legacy /gifts paths redirect there. Google Sheets timed out during the test and needs follow-up.

## DNS

GoDaddy nameservers: ns67.domaincontrol.com and ns68.domaincontrol.com. Website and Resend records are saved with TTL 600 seconds. Earlier resolver caches may retain old records until their previous TTL expires.

- A @: 216.198.79.1
- CNAME www: cf75af117550099f.vercel-dns-017.com.

| Type | Name | Content | Priority |
| --- | --- | --- | --- |
| TXT | resend._domainkey | p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCgPNhw6SzSfEfrBd8h6lY9I7TdFX9LsV+P6lPz/T0QwEbd4WAsIi9CG9lyIc0yD4NjUEjZxJI3gS+IYe4YVSd4qELMV9BV8cGK2dkK5PuNjLb4x+moNoXqwT5rB4FOPdeBfmlkkrhw6J/zw2L20YhkfV8nkkDZ1fObg/c11KjNqwIDAQAB | — |
| MX | send | feedback-smtp.ap-northeast-1.amazonses.com | 10 |
| TXT | send | v=spf1 include:amazonses.com ~all | — |

Resend domain: https://resend.com/domains/0eef619a-2dbe-4662-9061-0ed17f114a24
Sending enabled, receiving disabled. Existing DMARC was preserved.

## Deployment

Project: gary-miracles-optin, scope vaibhavs-projects-a2cb3ce8.
Node 24. The production RESEND_API_KEY is stored as a sensitive Vercel environment variable. Never commit credentials or environment files.

The frontend posts to /api/submit. api/submit.js adapts the existing worker handler to a Vercel Function. The build copies only index.html into public; server code is not published as static content. Cloudflare deployment is no longer needed for this implementation.

1. Confirm Resend domain is Verified and update GIFT_URL plus frontend fallback to the actual gift destination.
2. Run npm test and npm run build.
3. Deploy production with npx vercel deploy --prod --yes.
4. Submit a test form and confirm emailOk true, Sheets storage, and Resend delivery status. API acceptance does not prove inbox placement.
5. Keep the GitHub production branch aligned with the deployed source.

Preview: https://gary-miracles-optin-ikiaxrmfa-vaibhavs-projects-a2cb3ce8.vercel.app
Authenticated empty POST test returned the expected validation error.

## Behavior

Resend sends independently of GHL and Sheets. Each upstream request has a ten-second timeout. HTTP failures are logged without upstream response bodies. The JSON response includes emailOk and leadSaved. The page only claims an email is on its way when emailOk is explicitly true.

Six regression tests cover GHL 422, missing/rejected Resend credentials, failed lead sinks, and frontend success/failure/legacy messages. Tests send no real emails.
