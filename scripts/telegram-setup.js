// 텔레그램 설정 도우미: npm run telegram:setup
//   1) .env에 TELEGRAM_BOT_TOKEN만 넣고 실행 → 봇에게 보낸 메시지에서 chat id를 찾아 출력
//   2) TELEGRAM_CHAT_ID까지 넣고 실행 → 테스트 메시지 전송
import { telegramApi, sendTelegram } from '../src/telegram.js';

try {
  process.loadEnvFile();
} catch {}

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('.env 파일에 TELEGRAM_BOT_TOKEN을 넣어주세요.');
  process.exit(1);
}

if (process.env.TELEGRAM_CHAT_ID) {
  await sendTelegram('✅ 채용공고 알림 테스트입니다. 이 메시지가 보이면 텔레그램 설정 완료!');
  console.log('테스트 메시지를 보냈습니다. 텔레그램을 확인하세요.');
} else {
  const updates = await telegramApi('getUpdates', {});
  const chats = new Map(updates.map((u) => u.message?.chat).filter(Boolean).map((c) => [c.id, c]));
  if (!chats.size) {
    console.log('⚠ 봇에게 온 메시지가 없습니다. 텔레그램에서 봇을 열고 아무 메시지나 보낸 뒤 다시 실행하세요.');
  } else {
    console.log('아래 숫자를 .env의 TELEGRAM_CHAT_ID에 넣고 다시 실행하세요:');
    for (const c of chats.values()) console.log(`  ${c.first_name ?? c.title ?? ''}  →  ${c.id}`);
  }
}
