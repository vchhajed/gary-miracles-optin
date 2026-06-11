const GHL_WEBHOOK = 'https://services.leadconnectorhq.com/hooks/crYlBaqVt0m5ax7I6F71/webhook-trigger/JBCePj5ZOlsgQs9EMLMr';
const SHEETS_WEBHOOK = 'https://script.google.com/macros/s/AKfycbx8O7SYhuHvKZmn7gSCI91KGGji5XTZ4_sZKWstOJVq5VKAhyEDDIY69plNHguMGxfv/exec';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { firstName, lastName, email, phone } = body;

  if (!firstName || !email) {
    return json({ error: 'Missing required fields' }, 400);
  }

  const payload = {
    firstName,
    lastName: lastName || '',
    email,
    phone: phone || '',
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
      console.log(`[submit] ${target} responded with status ${r.value.status}`);
    } else {
      console.error(`[submit] ${target} failed: ${r.reason}`);
    }
  });

  return json({ ok: true }, 200);
}
