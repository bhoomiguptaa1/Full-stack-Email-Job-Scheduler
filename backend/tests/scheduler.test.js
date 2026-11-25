const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { app } = require('../dist/index');
const { prisma, connectDB, disconnectDB } = require('../dist/config/db');
const { redisConnection, disconnectRedis } = require('../dist/config/redis');
const { initElasticsearch } = require('../dist/config/elasticsearch');
const { createEmailWorker } = require('../dist/workers/email.worker');
const { emailQueue } = require('../dist/queues/email.queue');
const { toSafeUser, stripHtml, normalizeEmail } = require('../dist/utils/sanitize');
const {
  getHourWindow,
  consumeSenderHourlyQuota,
  getSenderHourlyUsage,
} = require('../dist/services/rateLimiter.service');

let server;
let baseUrl = '';
let worker;
const createdUserIds = [];

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

test.before(async () => {
  await connectDB();
  await initElasticsearch();
  worker = createEmailWorker();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

test.after(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  }
  if (worker) await worker.close().catch(() => {});
  await emailQueue.close().catch(() => {});
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectRedis().catch(() => {});
  await disconnectDB().catch(() => {});
});

test('Unit: sanitize helpers strip sensitive fields and HTML safely', () => {
  assert.equal(normalizeEmail('  Alice@Example.COM '), 'alice@example.com');
  assert.equal(stripHtml('<p>Hello <b>World</b></p>'), 'Hello World');

  const safe = toSafeUser({
    id: 'u-1',
    email: 'a@b.com',
    name: 'Alice',
    avatarUrl: null,
    role: 'USER',
    googleId: 'g-1',
    slackId: null,
    slackAccessToken: 'xoxb-secret',
    slackTeamName: null,
    slackChannelId: null,
    slackNotificationsEnabled: false,
    passwordHash: 'bcrypt-hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  assert.equal('passwordHash' in safe, false);
  assert.equal('slackAccessToken' in safe, false);
  assert.equal(safe.googleConnected, true);
  assert.equal(safe.slackConnected, true);

  const disconnected = toSafeUser({
    id: 'u-2',
    email: 'b@c.com',
    name: null,
    avatarUrl: null,
    role: 'USER',
    googleId: null,
    slackId: null,
    slackAccessToken: null,
    slackTeamName: null,
    slackChannelId: null,
    slackNotificationsEnabled: false,
    passwordHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert.equal(disconnected.googleConnected, false);
  assert.equal(disconnected.slackConnected, false);
});

test('RateLimiter: atomic Redis Lua script enforces hourly limit under concurrency', async () => {
  const senderKey = `test-sender-${Date.now()}`;
  const { windowKey } = getHourWindow();
  const redisKey = `reachinbox:sender_quota:${senderKey}:${windowKey}`;
  await redisConnection.del(redisKey);

  const results = await Promise.all(
    Array.from({ length: 6 }, () => consumeSenderHourlyQuota(senderKey, 3))
  );

  const allowedCount = results.filter((r) => r.allowed).length;
  const blockedCount = results.filter((r) => !r.allowed).length;

  assert.equal(allowedCount, 3);
  assert.equal(blockedCount, 3);

  const usage = await getSenderHourlyUsage(senderKey, 3);
  assert.equal(usage.sentThisHour, 3);
  assert.equal(usage.remaining, 0);

  await redisConnection.del(redisKey);
});

test('Integration: health, auth, senders, idempotency, reschedule, cancel, delivery, search, stats', async () => {
  // 1. Health endpoint
  const health = await request('GET', '/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.json.dependencies.postgres, 'connected');
  assert.equal(health.json.dependencies.redis, 'connected');

  // 2. Auth guard on protected routes
  const unauth = await request('GET', '/api/jobs');
  assert.equal(unauth.status, 401);

  // 3. Register & Login
  const testEmail = `test-${Date.now()}@reachinbox.test`;
  const reg = await request('POST', '/api/auth/register', {
    email: testEmail,
    password: 'StrongPassword123!',
    name: 'Test Runner',
  });
  assert.equal(reg.status, 201);
  assert.ok(reg.json.token);
  assert.equal('passwordHash' in reg.json.user, false);
  createdUserIds.push(reg.json.user.id);

  const login = await request('POST', '/api/auth/login', {
    email: testEmail,
    password: 'StrongPassword123!',
  });
  assert.equal(login.status, 200);
  const token = login.json.token;

  // Second isolated user for cross-tenant isolation test
  const otherReg = await request('POST', '/api/auth/register', {
    email: `other-${Date.now()}@reachinbox.test`,
    password: 'StrongPassword123!',
    name: 'Other User',
  });
  assert.equal(otherReg.status, 201);
  createdUserIds.push(otherReg.json.user.id);

  // 4. Senders CRUD
  const sendersRes = await request('GET', '/api/senders', null, token);
  assert.equal(sendersRes.status, 200);
  assert.ok(sendersRes.json.data.length >= 1);
  const defaultSender = sendersRes.json.data[0];

  const updateSender = await request(
    'PATCH',
    `/api/senders/${defaultSender.id}`,
    { hourlyLimit: 25 },
    token
  );
  assert.equal(updateSender.status, 200);
  assert.equal(updateSender.json.data.hourlyLimit, 25);

  // 5. Schedule future job with idempotency key
  const idempKey = `idemp-${Date.now()}`;
  const futureSchedule = await request(
    'POST',
    '/api/jobs/schedule',
    {
      recipientEmail: 'future@example.com',
      subject: 'Future Scheduled Verification',
      body: '<p>Scheduled body</p>',
      delaySeconds: 120,
      senderId: defaultSender.id,
      idempotencyKey: idempKey,
    },
    token
  );
  assert.equal(futureSchedule.status, 201);
  const futureJobId = futureSchedule.json.job.id;

  // Duplicate idempotent request returns same job
  const dupSchedule = await request(
    'POST',
    '/api/jobs/schedule',
    {
      recipientEmail: 'future@example.com',
      subject: 'Future Scheduled Verification',
      body: '<p>Scheduled body</p>',
      delaySeconds: 120,
      senderId: defaultSender.id,
      idempotencyKey: idempKey,
    },
    token
  );
  assert.equal(dupSchedule.status, 200);
  assert.equal(dupSchedule.json.deduplicated, true);
  assert.equal(dupSchedule.json.job.id, futureJobId);

  // 6. Reschedule and cancel
  const rescheduled = await request(
    'PATCH',
    `/api/jobs/${futureJobId}/reschedule`,
    { delaySeconds: 300 },
    token
  );
  assert.equal(rescheduled.status, 200);
  assert.equal(rescheduled.json.data.status, 'SCHEDULED');

  const cancelled = await request('DELETE', `/api/jobs/${futureJobId}`, null, token);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.json.data.status, 'CANCELLED');

  // 7. Immediate job delivery via BullMQ worker + Nodemailer/Ethereal
  const uniqueSubject = `Immediate Delivery ${Date.now()}`;
  const immediate = await request(
    'POST',
    '/api/jobs/schedule',
    {
      recipientEmail: 'recipient@example.com',
      subject: uniqueSubject,
      body: '<p>Hello from ReachInbox automated test</p>',
      delaySeconds: 0,
      senderId: defaultSender.id,
    },
    token
  );
  assert.equal(immediate.status, 201);
  const immediateId = immediate.json.job.id;

  let deliveredJob = null;
  for (let i = 0; i < 30; i++) {
    const detail = await request('GET', `/api/jobs/${immediateId}`, null, token);
    if (detail.status === 200 && detail.json.data.status === 'COMPLETED') {
      deliveredJob = detail.json.data;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  assert.ok(deliveredJob, 'Immediate job should complete within 15 seconds');
  assert.ok(deliveredJob.sentAt);
  assert.ok(deliveredJob.logs.some((l) => l.event === 'COMPLETED'));

  // 8. Search & tenant isolation
  await new Promise((r) => setTimeout(r, 1200)); // allow ES refresh
  const searchOwn = await request(
    'GET',
    `/api/jobs/search?q=${encodeURIComponent(uniqueSubject)}`,
    null,
    token
  );
  assert.equal(searchOwn.status, 200);
  assert.ok(searchOwn.json.data.length >= 1);

  const searchOther = await request(
    'GET',
    `/api/jobs/search?q=${encodeURIComponent(uniqueSubject)}`,
    null,
    otherReg.json.token
  );
  assert.equal(searchOther.status, 200);
  assert.equal(searchOther.json.data.length, 0);

  // 9. Dashboard stats
  const stats = await request('GET', '/api/dashboard/stats', null, token);
  assert.equal(stats.status, 200);
  assert.equal(stats.json.data.summary.completed, 1);
  assert.equal(stats.json.data.summary.cancelled, 1);
  assert.equal(stats.json.data.queue.connected, true);
});
