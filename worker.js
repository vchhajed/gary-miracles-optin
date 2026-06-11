const MAX_REQUESTS_PER_MINUTE = 5;
const MAX_BODY_SIZE = 16384;
const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 320;
const MAX_PHONE_LENGTH = 30;
const RATE_WINDOW_MS = 60000;

const GHL_WEBHOOK = 'https://services.leadconnectorhq.com/hooks/crYlBaqVt0m5ax7I6F71/webhook-trigger/JBCePj5ZOlsgQs9EMLMr';
const SHEETS_WEBHOOK = 'https://script.google.com/macros/s/AKfycbx8O7SYhuHvKZmn7gSCI91KGGji5XTZ4_sZKWstOJVq5VKAhyEDDIY69plNHguMGxfv/exec';

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

export default {
  async fetch(request) {
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
      email,
      phone,
      source: 'Year of Miracles Opt-In',
    };

    const results = await Promise.allSettled([
      fetch(GHL_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      fetch(SHEETS_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    ]);

    results.forEach((r, i) => {
      const target = i === 0 ? 'GHL' : 'Sheets';
      if (r.status === 'fulfilled') {
        console.log(`[submit] ${target} status=${r.value.status}`);
      } else {
        console.error(`[submit] ${target} failed: ${r.reason}`);
      }
    });

    return json({ ok: true }, 200);
  },
};
