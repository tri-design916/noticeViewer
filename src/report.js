// 초기 점검용 일일 보고: 지난 약 20시간(전날 15시 ~ 당일 9시 확인분)의 실행 결과를 텔레그램으로 보낸다.
// 공고 알림은 확인 시점에 이미 갔으므로 다시 보내지 않고, 보고 메시지 1개에 제목만 적는다.
// REPORT_DRY_RUN=1 이면 보내지 않고 출력만 한다.
import fs from 'node:fs';
import { hasTelegramEnv, sendTelegram, PAGE_URL } from './telegram.js';

const WINDOW_MS = 20 * 60 * 60 * 1000;

const config = JSON.parse(fs.readFileSync('sites.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('data/posts.json', 'utf8'));
const runs = fs.existsSync('data/runs.json') ? JSON.parse(fs.readFileSync('data/runs.json', 'utf8')) : [];

const kst = (iso, opts) => new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', ...opts });
const kstDate = (t) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);

// "어제 오후 3:02" 형식
function when(iso) {
  const t = Date.parse(iso);
  const days = (Date.parse(kstDate(Date.now())) - Date.parse(kstDate(t))) / 864e5;
  const day = days === 0 ? '오늘' : days === 1 ? '어제' : kst(iso, { month: 'numeric', day: 'numeric' });
  const h = Number(kst(iso, { hour: 'numeric', hourCycle: 'h23' }).replace(/\D/g, ''));
  const m = kst(iso, { minute: '2-digit' }).replace(/\D/g, '').padStart(2, '0');
  return `${day} ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${m}`;
}
const since = Date.now() - WINDOW_MS;
const recent = runs.filter((r) => Date.parse(r.at) >= since);
const postsByKey = new Map(data.posts.map((p) => [p.key, p]));
const newPosts = [...new Set(recent.flatMap((r) => r.newPosts))].map((k) => postsByKey.get(k)).filter(Boolean);

const lines = [`🔍 채용공고 점검 (${kst(new Date().toISOString(), { month: 'long', day: 'numeric' })})`, ''];
if (!recent.length) {
  lines.push('⚠ 확인이 한 번도 실행되지 않았어요.');
} else {
  for (const r of recent) {
    const failedSites = Object.entries(r.sites).filter(([, ok]) => !ok).map(([id]) => data.sites[id]?.name ?? id);
    const status = failedSites.length ? `⚠ 일부 실패(${failedSites.join(', ')})` : r.notifyFailed ? '⚠ 알림 실패' : '✅';
    lines.push(`${when(r.at)} 확인 ${status}`);
  }
}
lines.push('', `새 ${config.keywords.join(', ')} 공고: ${newPosts.length ? `${newPosts.length}건 있음` : '없음'}`);
for (const p of newPosts) lines.push(`· ${p.title}`);

lines.push('', `목록: ${PAGE_URL}`);
const text = lines.join('\n');

if (process.env.REPORT_DRY_RUN || !hasTelegramEnv()) {
  console.log(`--- (미전송)\n${text}\n`);
} else {
  await sendTelegram(text);
  console.log('💬 점검 보고 전송');
}
