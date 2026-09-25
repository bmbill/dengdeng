/* 燈燈悅心 — 推播 Worker
 *
 * 做的事只有一件：到了每個人自己設定的時間，推一則提醒。
 *
 * 不做「今天還沒供燈才提醒」。伺服器上只有公開過的燈，沒公開的那幾則
 * 從來沒離開過手機——要判斷「今天記了沒」就一定會判錯，
 * 而「你今天還沒記喔」對一個其實已經記了的人來說是很煩的。
 * 所以文案一律寫成問句，不管記了沒讀起來都對。
 *
 * 部署：
 *   wrangler kv namespace create SUBS      把 id 填進 wrangler.toml
 *   curl .../generate-vapid                產金鑰
 *   wrangler secret put VAPID_PRIVATE_JWK  貼私鑰（JSON 整串）
 *   公鑰填進 wrangler.toml 的 VAPID_PUBLIC，以及 src/config.js
 */

import { sendPush, generateVapidKeys } from './webpush.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });

// 提醒的句子。刻意都是問句或邀請，不是催促——
// 這個 app 的重點是讓人想記，不是讓人怕漏。
const LINES = [
  { title: '今天的燈', body: '有沒有一件小事，值得記下來？' },
  { title: '燈童', body: '天黑了，要不要來點一盞？' },
  { title: '今天的燈', body: '一句就夠了。' },
  { title: '掃地的', body: '今天掃到什麼好事沒有？' },
  { title: '今天的燈', body: '想想今天誰幫了你。' },
  { title: '寺裡的貓', body: '喵。你今天還沒來。' },
  { title: '今天的燈', body: '記一則，燈就亮了。' },
  { title: '池裡的蓮', body: '一天一盞，慢慢就是一片。' },
];

function getVapid(env) {
  return {
    publicKey: env.VAPID_PUBLIC,
    privateKeyJwk: JSON.parse(env.VAPID_PRIVATE_JWK),
    subject: env.VAPID_SUBJECT || 'mailto:admin@example.com',
  };
}

/** endpoint 很長，拿它的雜湊當 KV 的 key。 */
async function keyOf(endpoint) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 這個人在他自己的時區裡，現在是不是剛好到了設定的時間。
 *
 * 比對的是「當地的時鐘」而不是算出下一次的 UTC 時刻：後者要處理
 * 日光節約、時區資料更新、以及「錯過一次就永遠往後推」這些麻煩事。
 * cron 每 10 分鐘掃一次，只要當地時間落在設定時間之後的 10 分鐘內就推，
 * 再用 lastSent 擋掉同一天推第二次。
 */
function dueNow(prefs, state, nowMs) {
  const tz = prefs.tz || 'Asia/Taipei';
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(nowMs));
  const get = (t) => f.find((p) => p.type === t).value;
  const today = `${get('year')}-${get('month')}-${get('day')}`;
  if (state.lastSent === today) return null;

  const [hh, mm] = String(prefs.time || '21:00').split(':').map(Number);
  const nowMin = +get('hour') * 60 + +get('minute');
  const wantMin = hh * 60 + mm;
  // 只往後看 10 分鐘。看太寬的話，白天才第一次訂閱的人會馬上收到一則。
  if (nowMin < wantMin || nowMin >= wantMin + 10) return null;
  return today;
}

async function handleSubscribe(req, env) {
  const { subscription, prefs } = await req.json();
  if (!subscription?.endpoint || !subscription?.keys) {
    return json({ error: 'subscription 不完整' }, 400);
  }
  const k = await keyOf(subscription.endpoint);
  const prev = await env.SUBS.get(k, 'json');
  await env.SUBS.put(k, JSON.stringify({
    subscription,
    prefs: { time: '21:00', tz: 'Asia/Taipei', ...prefs },
    state: prev?.state || {},
  }));
  return json({ ok: true });
}

async function handlePrefs(req, env) {
  const { endpoint, prefs } = await req.json();
  const k = await keyOf(endpoint);
  const sub = await env.SUBS.get(k, 'json');
  if (!sub) return json({ error: '找不到這個訂閱' }, 404);
  sub.prefs = { ...sub.prefs, ...prefs };
  await env.SUBS.put(k, JSON.stringify(sub));
  return json({ ok: true });
}

async function handleUnsubscribe(req, env) {
  const { endpoint } = await req.json();
  await env.SUBS.delete(await keyOf(endpoint));
  return json({ ok: true });
}

/** 按一下就馬上收到一則，用來確認整條路通了。 */
async function handleTest(req, env) {
  const { endpoint } = await req.json();
  const k = await keyOf(endpoint);
  const sub = await env.SUBS.get(k, 'json');
  if (!sub) return json({ error: '找不到這個訂閱' }, 404);

  const line = LINES[Math.floor(Math.random() * LINES.length)];
  const res = await sendPush(sub.subscription, JSON.stringify(line), getVapid(env));
  return json({ ok: res.ok, status: res.status });
}

async function handleGenerateVapid() {
  const keys = await generateVapidKeys();
  return json({
    ...keys,
    做法: [
      'publicKey 填到 wrangler.toml 的 VAPID_PUBLIC，以及 src/config.js',
      'privateKeyJwk 整串 JSON.stringify 之後：wrangler secret put VAPID_PRIVATE_JWK',
    ],
  });
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    try {
      if (url.pathname === '/health') return json({ ok: true });
      if (url.pathname === '/generate-vapid') return handleGenerateVapid();
      if (url.pathname === '/subscribe' && req.method === 'POST') return handleSubscribe(req, env);
      if (url.pathname === '/prefs' && req.method === 'PUT') return handlePrefs(req, env);
      if (url.pathname === '/unsubscribe' && req.method === 'POST') return handleUnsubscribe(req, env);
      if (url.pathname === '/test' && req.method === 'POST') return handleTest(req, env);
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },

  async scheduled(event, env) {
    const vapid = getVapid(env);
    const now = Date.now();
    let cursor;

    do {
      const page = await env.SUBS.list({ cursor });
      cursor = page.list_complete ? null : page.cursor;

      for (const entry of page.keys) {
        try {
          const sub = await env.SUBS.get(entry.name, 'json');
          if (!sub) continue;

          const today = dueNow(sub.prefs, sub.state || {}, now);
          if (!today) continue;

          const line = LINES[Math.floor(Math.random() * LINES.length)];
          const res = await sendPush(sub.subscription, JSON.stringify(line), vapid);

          // 404/410 是「這個訂閱已經沒了」（app 被移除、權限被收回）。
          // 留著只會每天失敗一次，直接清掉。
          if (res.status === 404 || res.status === 410) {
            await env.SUBS.delete(entry.name);
            continue;
          }

          sub.state = { ...(sub.state || {}), lastSent: today };
          await env.SUBS.put(entry.name, JSON.stringify(sub));
        } catch (e) {
          console.error('push 失敗', entry.name, e.message);
        }
      }
    } while (cursor);
  },
};
