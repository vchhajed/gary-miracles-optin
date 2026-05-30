const GHL_WEBHOOK = 'https://services.leadconnectorhq.com/hooks/crYlBaqVt0m5ax7I6F71/webhook-trigger/JBCePj5ZOlsgQs9EMLMr';
const SHEETS_WEBHOOK = 'https://script.google.com/macros/s/AKfycbx8O7SYhuHvKZmn7gSCI91KGGji5XTZ4_sZKWstOJVq5VKAhyEDDIY69plNHguMGxfv/exec';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { firstName, lastName, email, phone } = req.body;

  if (!firstName || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const payload = {
    firstName,
    lastName: lastName || '',
    email,
    phone: phone || '',
    source: 'Year of Miracles Opt-In',
  };

  await Promise.allSettled([
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

  return res.status(200).json({ ok: true });
}
