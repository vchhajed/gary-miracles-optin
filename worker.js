export default {
  async fetch(request) {
    const GHL_WEBHOOK = 'https://services.leadconnectorhq.com/hooks/crYlBaqVt0m5ax7I6F71/webhook-trigger/JBCePj5ZOlsgQs9EMLMr';
    const SHEETS_WEBHOOK = 'https://script.google.com/macros/s/AKfycbx8O7SYhuHvKZmn7gSCI91KGGji5XTZ4_sZKWstOJVq5VKAhyEDDIY69plNHguMGxfv/exec';

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
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { firstName, lastName, email, phone } = body;

    if (!firstName || !email) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
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

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
