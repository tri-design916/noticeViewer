// 카카오 로그인으로 토큰을 발급받는 1회성 도우미.
//   npm run kakao:auth                      → 보내는 사람(나): 리프레시 토큰 + 친구 uuid 출력
//   npm run kakao:auth -- --receiver        → 받는 사람(어머니)이 옆에 있을 때: 이 컴퓨터에서 로그인
//   npm run kakao:auth -- --link            → 받는 사람에게 보낼 원격 동의 링크 출력
//   npm run kakao:auth -- --code <코드>      → 원격 동의 후 받은 코드로 연결 완료 (10분 안에)
import http from 'node:http';
import { exec } from 'node:child_process';
import { exchangeCode, getFriends } from '../src/kakao.js';

try {
  process.loadEnvFile();
} catch {}

const PORT = 8787;
const LOCAL_REDIRECT_URI = `http://localhost:${PORT}/callback`;
const REMOTE_REDIRECT_URI =
  process.env.KAKAO_REMOTE_REDIRECT_URI ?? 'https://tri-design916.github.io/noticeViewer/callback.html';
const clientId = process.env.KAKAO_REST_API_KEY;
const clientSecret = process.env.KAKAO_CLIENT_SECRET;
const args = process.argv.slice(2);
const receiver = args.includes('--receiver');

if (!clientId) {
  console.error('.env 파일에 KAKAO_REST_API_KEY를 넣어주세요.');
  process.exit(1);
}

function authUrl(redirectUri, extra = {}) {
  return (
    'https://kauth.kakao.com/oauth/authorize?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'talk_message,friends',
      ...extra,
    })
  );
}

const RECEIVER_DONE = '\n✅ 받는 사람 계정이 앱에 연결되었습니다. 10분쯤 뒤 npm run kakao:auth 로 uuid를 확인하세요.';

async function printSenderResult(token) {
  console.log('\n✅ GitHub Secrets에 아래 값을 등록하세요.\n');
  console.log(`KAKAO_REFRESH_TOKEN = ${token.refresh_token}\n`);

  const friends = await getFriends(token.access_token);
  if (!friends.length) {
    console.log('⚠ 조회되는 친구가 없습니다. 받는 사람이 [앱 > 멤버]에 등록되어 있고 연결을 마쳤는지 확인하세요.');
  } else {
    console.log('친구 목록 (받을 사람의 uuid를 KAKAO_RECEIVER_UUIDS에 넣으세요. 여러 명이면 쉼표로 구분):');
    for (const f of friends) console.log(`  ${f.profile_nickname}  →  ${f.uuid}`);
  }
}

if (args.includes('--link')) {
  console.log('아래 링크를 어머니께 카톡으로 보내세요. 동의 후 화면의 "카톡으로 보내기"를 누르시면 됩니다.\n');
  console.log(authUrl(REMOTE_REDIRECT_URI));
  console.log('\n코드를 받으면 10분 안에: npm run kakao:auth -- --code <코드>');
} else if (args.includes('--code')) {
  // 카톡으로 받은 "알림 연결 코드: xxx" 문장을 통째로 붙여넣어도 되게 코드만 뽑는다.
  const code = args.slice(args.indexOf('--code') + 1).join(' ').replace(/^.*:\s*/, '').trim();
  try {
    await exchangeCode({ clientId, clientSecret, redirectUri: REMOTE_REDIRECT_URI, code });
    console.log(RECEIVER_DONE);
  } catch (e) {
    console.error(e.message);
    console.error('코드는 10분 동안 한 번만 쓸 수 있습니다. 만료됐다면 --link 로 링크를 다시 보내세요.');
    process.exitCode = 1;
  }
} else {
  const url = authUrl(LOCAL_REDIRECT_URI, { prompt: 'login' }); // 매번 계정을 새로 고르게 한다
  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, LOCAL_REDIRECT_URI);
    if (reqUrl.pathname !== '/callback') return res.end();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

    const code = reqUrl.searchParams.get('code');
    if (!code) {
      res.end(`로그인 실패: ${reqUrl.searchParams.get('error_description') ?? '알 수 없는 오류'}`);
      return finish(1);
    }
    try {
      const token = await exchangeCode({ clientId, clientSecret, redirectUri: LOCAL_REDIRECT_URI, code });
      res.end('<h2>완료! 터미널로 돌아가세요. 이 창은 닫아도 됩니다.</h2>');
      if (receiver) console.log(RECEIVER_DONE);
      else await printSenderResult(token);
      finish(0);
    } catch (e) {
      res.end(`오류: ${e.message}`);
      console.error(e.message);
      finish(1);
    }
  });

  function finish(code) {
    process.exitCode = code;
    server.close();
    server.closeAllConnections();
  }

  server.listen(PORT, () => {
    console.log(`브라우저에서 카카오 로그인을 진행하세요${receiver ? ' (어머니 계정으로)' : ''}:\n${url}\n`);
    exec(`${process.platform === 'darwin' ? 'open' : 'xdg-open'} "${url}"`);
  });
}
