import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, Server } from 'node:http';
import { spawn, ChildProcess } from 'node:child_process';

let fixture: Server;
let child: ChildProcess;
let target: string;
const endpoint = 'http://127.0.0.1:3097';
before(async () => {
  fixture = createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(`<html><body><h1>Local fixture</h1><input id="name"><button onclick="document.querySelector('h1').textContent=document.querySelector('input').value">Apply</button><div style="height:1800px">Long page</div></body></html>`);
  });
  await new Promise<void>(resolve => fixture.listen(0, '127.0.0.1', resolve));
  target = `http://127.0.0.1:${(fixture.address() as any).port}`;
  child = spawn(process.execPath, ['dist/api.js'], {
    env: { ...process.env, PORT: '3097', ALLOW_LOCAL_WEBHOOKS: 'true', MAX_CONCURRENT_PAGES: '1' },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${endpoint}/health`).then(r => r.ok).catch(() => false)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Browser service did not start');
});
after(async () => {
  child?.kill('SIGINT');
  await new Promise<void>(resolve => fixture?.close(() => resolve()));
});
const scrape = (body: object) => fetch(`${endpoint}/scrape`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: target, ...body }),
});
test('actions change extracted HTML and return real screenshots, JavaScript and PDF', async () => {
  const response = await scrape({
    screenshot: { fullPage: true, viewport: { width: 640, height: 480 } },
    actions: [
      { type: 'click', selector: '#name' }, { type: 'write', text: 'Updated locally' },
      { type: 'click', selector: 'button' }, { type: 'wait', selector: 'h1' },
      { type: 'press', key: 'Tab' }, { type: 'scroll', direction: 'down' },
      { type: 'scrape' }, { type: 'screenshot', quality: 75 },
      { type: 'executeJavascript', script: 'return document.querySelector("h1").textContent' },
      { type: 'pdf', format: 'A4' },
    ],
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.match(data.content, /<h1>Updated locally<\/h1>/);
  const png = Buffer.from(data.screenshot.split(',')[1], 'base64');
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 640);
  assert.ok(png.readUInt32BE(20) > 480);
  assert.match(data.actions.screenshots[0], /^data:image\/jpeg;base64,/);
  assert.match(data.actions.scrapes[0].html, /Updated locally/);
  assert.equal(data.actions.javascriptReturns[0].value, 'Updated locally');
  assert.equal(Buffer.from(data.actions.pdfs[0].split(',')[1], 'base64').subarray(0, 4).toString(), '%PDF');
});
test('failed action releases browser capacity for the next scrape', async () => {
  const response = await scrape({ timeout: 300, actions: [{ type: 'click', selector: '#missing' }] });
  assert.equal(response.status, 500);
  const next = await scrape({});
  assert.equal(next.status, 200);
  assert.match((await next.json()).content, /Local fixture/);
});
test('rejects unknown actions instead of silently ignoring them', async () => {
  const response = await scrape({ actions: [{ type: 'unknown' }] });
  assert.equal(response.status, 400);
});
test('a never-resolving page script cannot hold browser capacity indefinitely', async () => {
  const response = await scrape({ timeout: 300, actions: [{ type: 'executeJavascript', script: 'return new Promise(() => {})' }] });
  assert.equal(response.status, 500);
  assert.equal((await scrape({})).status, 200);
});
