// .env 설정으로 받는 사람에게 테스트 메시지를 한 번 보낸다: npm run kakao:test
import { refreshToken, sendToFriends, postTemplate } from '../src/kakao.js';

try {
  process.loadEnvFile();
} catch {}

const env = process.env;
const token = await refreshToken({
  clientId: env.KAKAO_REST_API_KEY,
  clientSecret: env.KAKAO_CLIENT_SECRET,
  refreshToken: env.KAKAO_REFRESH_TOKEN,
});
const uuids = env.KAKAO_RECEIVER_UUIDS.split(',').map((s) => s.trim());
const res = await sendToFriends(
  token.access_token,
  uuids,
  postTemplate('테스트', {
    keyword: '알림 테스트',
    title: '이 메시지가 보이면 채용공고 알림 설정이 끝난 거예요 😊',
    url: 'https://bohyun.kr/bbs/board.php?bo_table=m50',
  }),
);
console.log(res);
