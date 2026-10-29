// 카카오 로그인으로 토큰을 발급받는 1회성 도우미.
//   npm run kakao:auth              → 보내는 사람(나): 리프레시 토큰 + 친구 uuid 출력
//   npm run kakao:auth -- --receiver → 받는 사람(어머니): 앱 연결·동의만 처리
import http from 'node:http';
import { exec } from 'node:child_process';
import { exchangeCode, getFriends } from '../src/kakao.js';

try {
  process.loadEnvFile();
} catch {}

const PORT = 8787;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const clientId = process.env.KAKAO_REST_API_KEY;
const clientSecret = process.env.KAKAO_CLIENT_SECRET;
const receiver = process.argv.includes('--receiver');

if (!clientId) {
  console.error('.env 파일에 KAKAO_REST_API_KEY를 넣어주세요.');
  process.exit(1);
}

const authUrl =
  'https://kauth.kakao.com/oauth/authorize?' +
  new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: 'talk_message,friends',
    prompt: 'login', // 매번 계정을 새로 고르게 해서 어머니 계정으로도 로그인할 수 있게 한다
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== '/callback') return res.end();
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

  const code = url.searchParams.get('code');
  if (!code) {
    res.end(`로그인 실패: ${url.searchParams.get('error_description') ?? '알 수 없는 오류'}`);
    return finish(1);
  }
  try {
    const token = await exchangeCode({ clientId, clientSecret, redirectUri: REDIRECT_URI, code });
    res.end('<h2>완료! 터미널로 돌아가세요. 이 창은 닫아도 됩니다.</h2>');

    if (receiver) {
      console.log('\n✅ 받는 사람 계정이 앱에 연결되었습니다. 이제 보내는 사람으로 다시 실행해 uuid를 확인하세요.');
      return finish(0);
    }
    console.log('\n✅ GitHub Secrets에 아래 값을 등록하세요.\n');
    console.log(`KAKAO_REFRESH_TOKEN = ${token.refresh_token}\n`);

    const friends = await getFriends(token.access_token);
    if (!friends.length) {
      console.log('⚠ 조회되는 친구가 없습니다. 받는 사람이 [앱 > 멤버]에 등록되어 있고 --receiver 로그인을 마쳤는지 확인하세요.');
    } else {
      console.log('친구 목록 (받을 사람의 uuid를 KAKAO_RECEIVER_UUIDS에 넣으세요. 여러 명이면 쉼표로 구분):');
      for (const f of friends) console.log(`  ${f.profile_nickname}  →  ${f.uuid}`);
    }
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
  console.log(`브라우저에서 카카오 로그인을 진행하세요${receiver ? ' (어머니 계정으로)' : ''}:\n${authUrl}\n`);
  exec(`${process.platform === 'darwin' ? 'open' : 'xdg-open'} "${authUrl}"`);
});
