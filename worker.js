const MAX_REQUESTS_PER_MINUTE = 5;
const MAX_BODY_SIZE = 16384;
const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 320;
const MAX_PHONE_LENGTH = 30;
const RATE_WINDOW_MS = 60000;
const UPSTREAM_TIMEOUT_MS = 10000;

const GHL_WEBHOOK = 'https://services.leadconnectorhq.com/hooks/crYlBaqVt0m5ax7I6F71/webhook-trigger/JBCePj5ZOlsgQs9EMLMr';
const SHEETS_WEBHOOK = 'https://script.google.com/macros/s/AKfycbx8O7SYhuHvKZmn7gSCI91KGGji5XTZ4_sZKWstOJVq5VKAhyEDDIY69plNHguMGxfv/exec';

// Where the form filler is sent to view their gift. Passed through to GoHighLevel
// so the thank-you email template can link to it, and returned to the page.
const GIFT_URL = 'https://portalsofawe.com/garymalkin-audiotracks/';

// Transactional gift email via Resend. RESEND_API_KEY is a Worker secret
// (wrangler secret put RESEND_API_KEY). EMAIL_FROM must be an address on a
// domain verified in the Resend dashboard.
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_FROM = 'Gary Malkin <gift@garymalkin.com>';
const EMAIL_SUBJECT = 'Your Gift of Sound has arrived';

const rateMap = new Map();

function pruneTimestamps(ts) {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  let i = 0;
  while (i < ts.length && ts[i] < cutoff) i++;
  return ts.slice(i);
}

function isRateLimited(ip) {
  let ts = rateMap.get(ip);
  if (!ts) {
    ts = [];
    rateMap.set(ip, ts);
  }
  const pruned = pruneTimestamps(ts);
  rateMap.set(ip, pruned);
  if (pruned.length >= MAX_REQUESTS_PER_MINUTE) return true;
  pruned.push(Date.now());
  return false;
}

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '');
}

function sanitize(str, maxLen) {
  if (typeof str !== 'string') return '';
  return stripHtml(str).trim().slice(0, maxLen);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function giftEmailText(firstName) {
  const name = firstName || 'friend';
  return `Dear ${name},

Thank you for being here. Your personal audio gift is ready — open it whenever you have a quiet moment to listen:

${GIFT_URL}

Featuring some of the world's most beloved voices in wisdom, healing, and transformation — set to soul-stirring music.

With warmth,
Gary Malkin
Portals of Awe`;
}

function giftEmailHtml(firstName) {
  const name = escapeHtml(firstName || 'friend');
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f1ea;font-family:Georgia,'Times New Roman',serif;color:#2b2b2b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e3dcc9;border-radius:6px;padding:40px 36px;">
            <tr><td align="center" style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#c9a84c;padding-bottom:20px;">A Gift of Sound</td></tr>
            <tr><td style="font-size:17px;line-height:1.6;">
              <p style="margin:0 0 16px;">Dear ${name},</p>
              <p style="margin:0 0 16px;">Thank you for being here. Your personal audio gift is ready &mdash; open it whenever you have a quiet moment to listen.</p>
            </td></tr>
            <tr><td align="center" style="padding:12px 0 24px;">
              <a href="${GIFT_URL}" style="display:inline-block;background:#c9a84c;color:#ffffff;text-decoration:none;font-size:15px;letter-spacing:1px;padding:14px 32px;border-radius:4px;">Open Your Gift</a>
            </td></tr>
            <tr><td style="font-size:15px;line-height:1.6;color:#555555;">
              <p style="margin:0 0 16px;">Featuring some of the world's most beloved voices in wisdom, healing, and transformation &mdash; set to soul-stirring music.</p>
              <p style="margin:0;">With warmth,<br/>Gary Malkin<br/><span style="color:#999999;">Portals of Awe</span></p>
            </td></tr>
            <tr><td style="padding-top:24px;font-size:12px;color:#aaaaaa;">If the button doesn't work, paste this link into your browser:<br/>${GIFT_URL}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendGiftEmail(env, firstName, email) {
  if (!env || !env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [email],
      subject: EMAIL_SUBJECT,
      html: giftEmailHtml(firstName),
      text: giftEmailText(firstName),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend HTTP ${res.status}`);
  }
  return res;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    if (request.headers.get('Content-Type') !== 'application/json') {
      return json({ error: 'Expected Content-Type: application/json' }, 415);
    }

    if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY_SIZE) {
      return json({ error: 'Payload too large' }, 413);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(ip)) {
      return json({ error: 'Too many requests. Please wait a moment and try again.' }, 429);
    }

    let body;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY_SIZE) {
        return json({ error: 'Payload too large' }, 413);
      }
      body = JSON.parse(text);
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    if (body == null || typeof body !== 'object') {
      return json({ error: 'Invalid body' }, 400);
    }

    const firstName = sanitize(body.firstName, MAX_NAME_LENGTH);
    const lastName = sanitize(body.lastName, MAX_NAME_LENGTH);
    const email = sanitize(body.email, MAX_EMAIL_LENGTH).toLowerCase();
    const phone = sanitize(body.phone, MAX_PHONE_LENGTH);

    if (!firstName || !email) {
      return json({ error: 'Name and email are required.' }, 400);
    }

    if (!isValidEmail(email)) {
      return json({ error: 'Please provide a valid email address.' }, 400);
    }

    const payload = {
      firstName,
      lastName,
      // Full name convenience field for CRMs that expect a single "name".
      name: [firstName, lastName].filter(Boolean).join(' '),
      email,
      phone,
      source: 'Year of Miracles Opt-In',
      // Tags let the GHL workflow segment these contacts and drop them into the
      // right pipeline stage. Adjust the tag names to match the GHL setup.
      tags: ['year-of-miracles-optin', 'gift-requested'],
      // Passed through so the GHL thank-you email template can reference it.
      giftUrl: GIFT_URL,
      submittedAt: new Date().toISOString(),
    };

    const results = await Promise.allSettled([
      fetch(GHL_WEBHOOK, {
        method: 'POST',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      fetch(SHEETS_WEBHOOK, {
        method: 'POST',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      sendGiftEmail(env, firstName, email),
    ]);

    const labels = ['GHL', 'Sheets', 'Email'];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        const log = r.value.ok ? console.log : console.error;
        log(`[submit] ${labels[i]} status=${r.value.status}`);
      } else {
        console.error(`[submit] ${labels[i]} failed: ${r.reason}`);
      }
    });

    const emailOk = results[2].status === 'fulfilled';
    const leadSaved = results.slice(0, 2).some(r => r.status === 'fulfilled' && r.value.ok);
    // Gift access remains available even when an integration is unavailable.
    return json({ ok: true, emailOk, leadSaved, giftUrl: GIFT_URL }, 200);
  },
};
