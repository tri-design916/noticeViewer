// 초기 점검용 일일 보고: 지난 약 20시간(전날 15시 ~ 당일 9시 확인분)의 실행 결과를 받는 사람에게 보낸다.
// 새 공고가 있으면 요약 뒤에 원래 알림 메시지도 다시 보낸다.
// REPORT_DRY_RUN=1 이면 보내지 않고 출력만 한다.
import fs from 'node:fs';
import { accessTokenFromEnv, receiverUuids, hasKakaoEnv, sendToFriends, postTemplate } from './kakao.js';

const PAGE_URL = 'https://tri-design916.github.io/noticeViewer/';
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

const messages = [
  { object_type: 'text', text: lines.join('\n').slice(0, 200), link: { web_url: PAGE_URL, mobile_web_url: PAGE_URL }, button_title: '목록 보기' },
  ...newPosts.map((p) => postTemplate(data.sites[p.site]?.name ?? p.site, p)),
];

if (process.env.REPORT_DRY_RUN || !hasKakaoEnv()) {
  for (const m of messages) console.log(`--- (미전송)\n${m.text}\n`);
} else {
  const accessToken = await accessTokenFromEnv();
  const uuids = receiverUuids();
  for (const m of messages) {
    const res = await sendToFriends(accessToken, uuids, m);
    if (!res.successful_receiver_uuids?.length) throw new Error(`전송 실패: ${JSON.stringify(res.failure_info)}`);
  }
  console.log(`💬 점검 보고 전송 (메시지 ${messages.length}개)`);
}
