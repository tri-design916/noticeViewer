// 텔레그램 봇으로 나에게 알림을 보낸다. 메시지는 카톡에 그대로 복사해 전달하기 쉽게 링크가 보이는 일반 텍스트로 만든다.
export const PAGE_URL = 'https://tri-design916.github.io/noticeViewer/';

export function hasTelegramEnv(env = process.env) {
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
}

export async function telegramApi(method, body, env = process.env) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`텔레그램 API 오류 ${res.status}: ${json.description}`);
  return json.result;
}

export function sendTelegram(text, env = process.env) {
  return telegramApi('sendMessage', { chat_id: env.TELEGRAM_CHAT_ID, text, link_preview_options: { is_disabled: true } }, env);
}

// 새 공고 알림: 몇 건이든 메시지 1개. siteName(post) → 기관 이름
export function alertText(posts, siteName) {
  const blocks = posts.map((p) => [`[${siteName(p)}] ${p.title}`, p.date && `게시일: ${p.date}`, p.url].filter(Boolean).join('\n'));
  return `📢 ${posts[0].keyword} 새 공고 ${posts.length}건\n\n${blocks.join('\n\n')}`;
}
