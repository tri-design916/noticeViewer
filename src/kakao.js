import fs from 'node:fs';

const NEW_TOKEN_FILE = '.kakao_refresh_token';
const KAUTH = 'https://kauth.kakao.com';
const KAPI = 'https://kapi.kakao.com';

async function post(url, body, accessToken) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
    body: new URLSearchParams(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`카카오 API 오류 ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

export function exchangeCode({ clientId, clientSecret, redirectUri, code }) {
  return post(`${KAUTH}/oauth/token`, {
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
    ...(clientSecret && { client_secret: clientSecret }),
  });
}

// 응답에 refresh_token이 있으면 갱신된 것(만료 1개월 이내일 때 재발급됨)이므로 저장해야 한다.
export function refreshToken({ clientId, clientSecret, refreshToken }) {
  return post(`${KAUTH}/oauth/token`, {
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
    ...(clientSecret && { client_secret: clientSecret }),
  });
}

// 환경변수의 리프레시 토큰으로 액세스 토큰을 받는다. 재발급된 리프레시 토큰은 워크플로가 Secret에 다시 저장하도록 파일로 남긴다.
export async function accessTokenFromEnv(env = process.env) {
  const token = await refreshToken({
    clientId: env.KAKAO_REST_API_KEY,
    clientSecret: env.KAKAO_CLIENT_SECRET,
    refreshToken: env.KAKAO_REFRESH_TOKEN,
  });
  if (token.refresh_token) {
    fs.writeFileSync(NEW_TOKEN_FILE, token.refresh_token);
    console.log('🔑 리프레시 토큰이 재발급되었습니다.');
  }
  return token.access_token;
}

export function receiverUuids(env = process.env) {
  return env.KAKAO_RECEIVER_UUIDS.split(',').map((s) => s.trim()).filter(Boolean);
}

export function hasKakaoEnv(env = process.env) {
  return Boolean(env.KAKAO_REST_API_KEY && env.KAKAO_REFRESH_TOKEN && env.KAKAO_RECEIVER_UUIDS);
}

export async function getFriends(accessToken) {
  const res = await fetch(`${KAPI}/v1/api/talk/friends`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`친구 목록 조회 실패 ${res.status}: ${JSON.stringify(json)}`);
  return json.elements ?? [];
}

export function sendToFriends(accessToken, receiverUuids, template) {
  return post(
    `${KAPI}/v1/api/talk/friends/message/default/send`,
    {
      receiver_uuids: JSON.stringify(receiverUuids),
      template_object: JSON.stringify(template),
    },
    accessToken,
  );
}

// 텍스트 템플릿 본문은 최대 200자.
export function postTemplate(siteName, post) {
  let text = `📢 ${post.keyword} 새 공고\n\n[${siteName}]\n${post.title}`;
  if (post.date) text += `\n\n게시일: ${post.date}`;
  if (text.length > 200) text = text.slice(0, 199) + '…';
  return {
    object_type: 'text',
    text,
    link: { web_url: post.url, mobile_web_url: post.url },
    button_title: '공고 보기',
  };
}

export const PAGE_URL = 'https://tri-design916.github.io/noticeViewer/';
const LIST_MAX = 3; // 리스트 템플릿 항목은 최대 3개

// 새 공고 알림은 몇 건이든 메시지 1개로 보낸다(친구에게 보내기 쿼터가 작다).
// 1건이면 텍스트, 2건 이상이면 리스트 템플릿. siteName(post) → 기관 이름
export function alertTemplate(posts, siteName) {
  if (posts.length === 1) return postTemplate(siteName(posts[0]), posts[0]);
  const page = { web_url: PAGE_URL, mobile_web_url: PAGE_URL };
  return {
    object_type: 'list',
    header_title: `📢 ${posts[0].keyword} 새 공고 ${posts.length}건`,
    header_link: page,
    contents: posts.slice(0, LIST_MAX).map((p) => ({
      title: p.title,
      description: [siteName(p), p.date].filter(Boolean).join(' · '),
      link: { web_url: p.url, mobile_web_url: p.url },
    })),
    buttons: [{ title: '전체 목록 보기', link: page }],
  };
}
