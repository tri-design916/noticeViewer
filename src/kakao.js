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
