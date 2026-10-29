import fs from 'node:fs';
import { scrapeSite } from './scrape.js';
import { refreshToken, sendToFriends, postTemplate } from './kakao.js';

const DATA_FILE = 'data/posts.json';
const NEW_TOKEN_FILE = '.kakao_refresh_token';
// 알림 설정 전에 쌓인 글이 한꺼번에 가지 않도록, 처음 발견된 지 이 기간 안의 글만 보낸다.
const NOTIFY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

const config = JSON.parse(fs.readFileSync('sites.json', 'utf8'));
const data = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  : { sites: {}, posts: [] };
const posts = new Map(data.posts.map((p) => [p.key, p]));
const now = new Date().toISOString();
let failed = false;

function matchKeyword(title) {
  return config.keywords.find((k) => title.includes(k)) ?? null;
}

for (const site of config.sites) {
  const state = (data.sites[site.id] ??= {});
  Object.assign(state, { name: site.name, url: site.url });
  // 처음 성공한 수집은 기준선으로만 저장하고 알림은 보내지 않는다.
  const baseline = !state.lastSuccess;

  try {
    const found = await scrapeSite(site);
    let added = 0;
    for (const p of found) {
      const key = `${site.id}:${p.id}`;
      const existing = posts.get(key);
      if (existing) {
        Object.assign(existing, { title: p.title, url: p.url, date: p.date || existing.date });
        continue;
      }
      posts.set(key, {
        key,
        site: site.id,
        ...p,
        keyword: matchKeyword(p.title),
        firstSeen: now,
        baseline,
        notified: baseline,
      });
      added++;
    }
    Object.assign(state, { lastSuccess: now, lastError: null, count: found.length });
    console.log(`✔ ${site.name}: ${found.length}건 확인, 새 글 ${added}건${baseline ? ' (기준선)' : ''}`);
  } catch (e) {
    Object.assign(state, { lastError: e.message, lastErrorAt: now });
    console.error(`✘ ${site.name}: ${e.message}`);
  }
}

const pending = [...posts.values()].filter((p) => p.keyword && !p.notified);
const fresh = pending.filter((p) => Date.now() - Date.parse(p.firstSeen) < NOTIFY_WINDOW_MS);
for (const p of pending) if (!fresh.includes(p)) p.notified = 'skipped';

if (fresh.length) {
  const env = process.env;
  if (!env.KAKAO_REST_API_KEY || !env.KAKAO_REFRESH_TOKEN || !env.KAKAO_RECEIVER_UUIDS) {
    console.warn(`⚠ 카카오 설정이 없어 알림 ${fresh.length}건을 보내지 않았습니다.`);
  } else {
    try {
      const token = await refreshToken({
        clientId: env.KAKAO_REST_API_KEY,
        clientSecret: env.KAKAO_CLIENT_SECRET,
        refreshToken: env.KAKAO_REFRESH_TOKEN,
      });
      if (token.refresh_token) {
        fs.writeFileSync(NEW_TOKEN_FILE, token.refresh_token);
        console.log('🔑 리프레시 토큰이 재발급되었습니다.');
      }
      const uuids = env.KAKAO_RECEIVER_UUIDS.split(',').map((s) => s.trim()).filter(Boolean);
      for (const p of fresh) {
        const res = await sendToFriends(token.access_token, uuids, postTemplate(data.sites[p.site].name, p));
        if (res.successful_receiver_uuids?.length) {
          p.notified = now;
          console.log(`💬 알림 전송: ${p.title}`);
        } else {
          throw new Error(`전송 실패: ${JSON.stringify(res.failure_info)}`);
        }
      }
    } catch (e) {
      failed = true;
      console.error(`✘ 카카오 알림 실패: ${e.message}`);
    }
  }
}

data.updatedAt = now;
data.keywords = config.keywords;
data.posts = [...posts.values()].sort(
  (a, b) => b.firstSeen.localeCompare(a.firstSeen) || b.date.localeCompare(a.date) || Number(b.id) - Number(a.id),
);
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n');

if (failed) process.exit(1);
