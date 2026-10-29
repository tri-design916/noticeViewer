import fs from 'node:fs';
import { scrapeSite } from './scrape.js';
import { accessTokenFromEnv, receiverUuids, hasKakaoEnv, sendToFriends, postTemplate } from './kakao.js';

const DATA_FILE = 'data/posts.json';
const RUNS_FILE = 'data/runs.json';
const MAX_RUNS = 100;
// 알림 설정 전에 쌓인 글이 한꺼번에 가지 않도록, 처음 발견된 지 이 기간 안의 글만 보낸다.
const NOTIFY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

const config = JSON.parse(fs.readFileSync('sites.json', 'utf8'));
const data = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  : { sites: {}, posts: [] };
const posts = new Map(data.posts.map((p) => [p.key, p]));
const now = new Date().toISOString();
let failed = false;
const run = { at: now, sites: {}, newPosts: [] };

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
    run.sites[site.id] = true;
    console.log(`✔ ${site.name}: ${found.length}건 확인, 새 글 ${added}건${baseline ? ' (기준선)' : ''}`);
  } catch (e) {
    Object.assign(state, { lastError: e.message, lastErrorAt: now });
    run.sites[site.id] = false;
    console.error(`✘ ${site.name}: ${e.message}`);
  }
}

const pending = [...posts.values()].filter((p) => p.keyword && !p.notified);
const fresh = pending.filter((p) => Date.now() - Date.parse(p.firstSeen) < NOTIFY_WINDOW_MS);
for (const p of pending) if (!fresh.includes(p)) p.notified = 'skipped';

if (fresh.length) {
  if (!hasKakaoEnv()) {
    console.warn(`⚠ 카카오 설정이 없어 알림 ${fresh.length}건을 보내지 않았습니다.`);
  } else {
    try {
      const accessToken = await accessTokenFromEnv();
      const uuids = receiverUuids();
      for (const p of fresh) {
        const res = await sendToFriends(accessToken, uuids, postTemplate(data.sites[p.site].name, p));
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

// 점검 보고(src/report.js)용 실행 기록
run.newPosts = [...posts.values()].filter((p) => p.firstSeen === now && p.keyword && !p.baseline).map((p) => p.key);
run.notifyFailed = failed;
const runs = fs.existsSync(RUNS_FILE) ? JSON.parse(fs.readFileSync(RUNS_FILE, 'utf8')) : [];
runs.push(run);
fs.writeFileSync(RUNS_FILE, JSON.stringify(runs.slice(-MAX_RUNS), null, 2) + '\n');

if (failed) process.exit(1);
