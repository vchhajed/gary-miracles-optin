import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('./worker.js', import.meta.url), 'utf8');
const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');

async function submit({ ghl = 422, sheets = 200, resend = 200, key = true } = {}) {
  const calls = [];
  const context = vm.createContext({
    Response, Request, AbortSignal,
    console: { log() {}, error() {} },
    fetch: async (url, options) => {
      calls.push({ url, options });
      const status = url.includes('resend.com') ? resend : url.includes('google.com') ? sheets : ghl;
      return new Response('{}', { status });
    },
  });
  const worker = vm.runInContext(source.replace('export default', 'globalThis.worker ='), context);
  const response = await worker.fetch(new Request('https://worker.example', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName: 'Test', lastName: 'User', email: 'test@example.com' }),
  }), key ? { RESEND_API_KEY: 'test-only' } : {});
  return { response, data: await response.json(), calls };
}

test('GHL billing failure does not block Resend or Sheets', async () => {
  const { response, data, calls } = await submit();
  assert.equal(response.status, 200);
  assert.equal(data.emailOk, true);
  assert.equal(data.leadSaved, true);
  const email = calls.find(call => call.url.includes('resend.com'));
  assert.equal(JSON.parse(email.options.body).to[0], 'test@example.com');
  assert.ok(calls.every(call => call.options.signal));
});

test('missing key preserves gift access and reports email failure', async () => {
  const { response, data, calls } = await submit({ key: false });
  assert.equal(response.status, 200);
  assert.equal(data.emailOk, false);
  assert.equal(data.leadSaved, true);
  assert.equal(calls.length, 2);
  assert.equal(data.giftUrl, 'https://portalsofawe.com/garymalkin-audiotracks/');
});

test('upstream HTTP errors are not reported as email or lead success', async () => {
  const { data } = await submit({ sheets: 500, resend: 403 });
  assert.equal(data.emailOk, false);
  assert.equal(data.leadSaved, false);
});

for (const emailOk of [true, false, undefined]) {
  test(`form shows truthful email status for emailOk=${emailOk}`, async () => {
    let handler;
    const elements = Object.fromEntries(['optinForm', 'submitBtn', 'errorMsg', 'successState', 'finePrint', 'giftLink', 'successMessage', 'firstName', 'lastName', 'email', 'phone'].map(id => [id, {
      value: id === 'email' ? 'test@example.com' : 'Test', style: {},
      classList: { add() {} }, addEventListener(event, callback) { handler = callback; },
    }]));
    const context = vm.createContext({
      document: { getElementById: id => elements[id] },
      fetch: async () => new Response(JSON.stringify({ ok: true, emailOk })),
      setTimeout: callback => callback(), console,
    });
    const script = html.slice(html.indexOf("  const GIFT_URL ="), html.lastIndexOf('</script>'));
    vm.runInContext(script, context);
    await handler({ preventDefault() {} });
    assert.equal(elements.optinForm.style.display, 'none');
    assert.equal(elements.successState.style.display, 'flex');
    assert.equal(elements.successMessage.textContent.includes('on its way'), emailOk === true);
    assert.equal(elements.giftLink.href, 'https://portalsofawe.com/garymalkin-audiotracks/');
  });
}
