import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { createDemoDatabase } from './support/demo-database.mjs';

// Only the external Supabase HTTP boundary is replaced. Requests exercise the
// actual Next.js routes, Supabase SDK, session signing and response cookies.
const fixture = createDemoDatabase();
const database = fixture.server;

let app;
let appUrl;
let output = '';
before(async () => {
  database.listen(0, '127.0.0.1');
  await once(database, 'listening');
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  appUrl = `http://127.0.0.1:${port}`;
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${database.address().port}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'local-test-service-key',
      SESSION_SECRET: 'local-test-session-secret-with-at-least-32-characters',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const record = chunk => { output = (output + chunk).slice(-12000); };
  app.stdout.on('data', record);
  app.stderr.on('data', record);
  const deadline = Date.now() + 90000;
  while (!output.includes('Ready in')) {
    if (app.exitCode !== null || Date.now() > deadline) throw new Error(`Next.js did not start: ${output}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}, { timeout: 100000 });

after(async () => {
  if (app && app.exitCode === null) {
    if (process.platform === 'win32') {
      await new Promise(resolve => spawn('taskkill', ['/pid', String(app.pid), '/T', '/F'], { stdio: 'ignore' }).on('exit', resolve));
    } else {
      app.kill('SIGTERM');
      await once(app, 'exit');
    }
  }
  database.closeAllConnections();
  await new Promise(resolve => database.close(resolve));
});

test('health reports an unavailable database instead of claiming the app is healthy', async () => {
  fixture.mode = 'offline';
  const response = await fetch(`${appUrl}/api/health`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).database, 'unavailable');
});

test('demo returns an actionable service error without creating a session when Supabase cannot be reached', async () => {
  fixture.mode = 'offline';
  const response = await fetch(`${appUrl}/api/seed`, { method: 'POST' });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, 'DEMO_UNAVAILABLE');
  assert.match(body.error, /database/i);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(body.details, undefined);
});

test('demo cannot report success or issue a session when job creation fails', async () => {
  fixture.mode = 'jobs-unavailable';
  const response = await fetch(`${appUrl}/api/seed`, { method: 'POST' });
  assert.equal(response.status, 503);
  assert.notEqual((await response.json()).success, true);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('a reachable database allows demo initialization and returns a signed HTTP-only session', async () => {
  fixture.mode = 'healthy';
  const health = await fetch(`${appUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).database, 'available');
  const response = await fetch(`${appUrl}/api/seed`, { method: 'POST' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.demo_user.email, 'sarah@demo.freelanceguard.app');
  assert.equal(body.jobs_created, 3);
  assert.match(response.headers.get('set-cookie'), /fg_session=.+;.*HttpOnly/i);
});

test('demo cannot report success or issue a session when chat initialization fails', async () => {
  fixture.mode = 'chat-unavailable';
  const response = await fetch(`${appUrl}/api/seed`, { method: 'POST' });
  assert.equal(response.status, 503);
  assert.notEqual((await response.json()).success, true);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('demo sessions can switch client to freelancer, submit work, and return to client approval', async () => {
  fixture.mode = 'healthy';
  const start = await fetch(`${appUrl}/api/seed`, { method: 'POST' });
  assert.equal(start.status, 200);
  const clientCookie = start.headers.get('set-cookie').split(';')[0];
  const job = fixture.tables.jobs.filter(row => row.status === 'in_progress').at(-1);

  const denied = await fetch(`${appUrl}/api/jobs/${job.id}/submit-deliverable`, {
    method: 'POST', headers: { cookie: clientCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ deliverableUrl: 'https://example.com/demo-result' }),
  });
  assert.equal(denied.status, 403, 'a client cannot submit work as the freelancer');

  const switchToFreelancer = await fetch(`${appUrl}/api/seed/switch`, { method: 'POST', headers: { cookie: clientCookie } });
  assert.equal(switchToFreelancer.status, 200);
  assert.equal((await switchToFreelancer.json()).user.email, 'minh@demo.freelanceguard.app');
  const freelancerCookie = switchToFreelancer.headers.get('set-cookie').split(';')[0];

  const mockSubmit = await fetch(`${appUrl}/api/contracts/mock-submit`, {
    method: 'POST', headers: { cookie: freelancerCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ onchainJobId: 0, deliverableHash: `0x${'a'.repeat(64)}` }),
  });
  assert.equal(mockSubmit.status, 410);
  assert.equal((await mockSubmit.json()).code, 'ROME_EXTENSION_REQUIRED');
  const submitted = await fetch(`${appUrl}/api/jobs/${job.id}/submit-deliverable`, {
    method: 'POST', headers: { cookie: freelancerCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ deliverableUrl: 'https://example.com/demo-result', deliverableNotes: 'Demo test result' }),
  });
  assert.equal(submitted.status, 200);
  assert.equal((await submitted.json()).status, 'submitted');

  const switchToClient = await fetch(`${appUrl}/api/seed/switch`, { method: 'POST', headers: { cookie: freelancerCookie } });
  assert.equal(switchToClient.status, 200);
  assert.equal((await switchToClient.json()).user.email, 'sarah@demo.freelanceguard.app');
  const returnedClientCookie = switchToClient.headers.get('set-cookie').split(';')[0];
  const mockApprove = await fetch(`${appUrl}/api/contracts/mock-approve`, {
    method: 'POST', headers: { cookie: returnedClientCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ onchainJobId: 0 }),
  });
  assert.equal(mockApprove.status, 410);
  assert.equal((await mockApprove.json()).code, 'ROME_EXTENSION_REQUIRED');
  const approved = await fetch(`${appUrl}/api/jobs/${job.id}/approve`, { method: 'POST', headers: { cookie: returnedClientCookie } });
  assert.equal(approved.status, 200);
  const approvedDemo = await approved.json();
  assert.equal(approvedDemo.status, 'approved');
  assert.equal(approvedDemo.chainSettlement, false);
  assert.equal(fixture.tables.jobs.find(row => row.id === job.id).status, 'approved');
});
