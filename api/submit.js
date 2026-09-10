import worker from '../worker.js';

export const maxDuration = 30;

export async function POST(request) {
  // Vercel sets this header at its edge; use it instead of the Cloudflare header.
  const headers = new Headers(request.headers);
  headers.set('CF-Connecting-IP', request.headers.get('x-vercel-forwarded-for') || 'unknown');
  try {
    return await worker.fetch(new Request(request, { headers }), {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
    });
  } catch (error) {
    console.error('[submit] Unexpected failure', error.name);
    return Response.json({ ok: false, error: 'Unable to process your request.' }, { status: 500 });
  }
}
