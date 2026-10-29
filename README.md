# 채용공고 알림 (noticeViewer)

`sites.json`에 등록한 게시판 5곳을 **매일 09:00, 15:00(KST)** 에 확인합니다.
제목에 키워드(`생활지원사`)가 들어간 새 글이 있으면 **카카오톡으로 어머니께 메시지**를 보내고, 결과를 GitHub Pages 웹페이지에 보여줍니다.

```
GitHub Actions (cron) ─▶ src/check.js ─▶ 게시판 5곳 수집
                                   ├─▶ data/posts.json 커밋 (이전 결과와 비교)
                                   ├─▶ 키워드 새 글 → 카카오 "친구에게 보내기"
                                   └─▶ index.html + posts.json → GitHub Pages
```

- 처음 수집한 글은 **기준선**으로만 저장하고 알림을 보내지 않습니다.
- 알림 전송에 실패하면 다음 실행 때 다시 시도합니다. 처음 발견된 지 3일이 지난 글은 보내지 않습니다.
- 사이트를 추가하거나 키워드를 바꾸려면 `sites.json`만 고치면 됩니다. `postPattern`은 게시글 링크에서 글 번호를 뽑는 정규식입니다.

## 1. GitHub 설정

1. 새 **public** 저장소를 만들고 이 폴더를 push 합니다. 무료 플랜의 Pages는 public 저장소에서만 쓸 수 있습니다.
2. **Settings → Pages → Source**를 **GitHub Actions**로 바꿉니다.

## 2. 카카오 개발자 앱 설정

[developers.kakao.com](https://developers.kakao.com)에 **내 계정**으로 로그인한 뒤 진행합니다.

1. **앱 만들기**를 누르고, **앱 키 → REST API 키**를 복사해 둡니다.
2. **카카오 로그인**
   - 활성화 설정을 **ON**으로 바꿉니다.
   - Redirect URI에 `http://localhost:8787/callback`을 등록합니다.
   - **동의항목**에서 다음 두 가지를 설정합니다.
     - `카카오톡 메시지 전송 (talk_message)`
     - `카카오 서비스 내 친구목록 (friends)`
   - 친구목록 항목이 막혀 있으면 **앱 설정 → 비즈니스**에서 본인인증으로 **개인 개발자 비즈 앱**으로 전환합니다.
   - **보안 → Client Secret**을 "사용함"으로 두었다면 그 값도 복사해 둡니다.
3. **플랫폼 → Web → 사이트 도메인**에 아래 주소를 모두 등록합니다. 메시지의 "공고 보기" 버튼 링크는 등록된 도메인이어야 열립니다.
   ```
   http://www.ihnw.or.kr
   https://gcwc.or.kr
   http://www.gnlifeline.or.kr
   https://bohyun.kr
   http://www.gdolbom.or.kr
   ```
4. **팀원(멤버) 관리**에서 **어머니 카카오계정을 초대**하고, 어머니가 초대를 수락하시도록 합니다.
   - 심사를 받지 않은 앱은 팀원끼리만 친구 목록 조회와 메시지 발송이 됩니다.
5. 나와 어머니가 서로 **카카오톡 친구**인지 확인합니다.

## 3. 토큰 발급 (내 컴퓨터에서 한 번만)

```bash
npm install
cp .env.example .env              # KAKAO_REST_API_KEY (와 CLIENT_SECRET) 입력

npm run kakao:auth -- --receiver  # ① 어머니 계정으로 로그인 → 앱 연결 + 동의
npm run kakao:auth                # ② 내 계정으로 로그인 → 토큰 + 친구 uuid 출력
```

- ①에서는 로그인 화면의 **QR코드 로그인**을 쓰면 편합니다. 어머니 폰의 카카오톡으로 QR을 찍으면 됩니다.
- 친구 목록은 10분 동안 캐시됩니다. ② 결과에 어머니가 안 보이면 10분 뒤에 다시 실행하세요.
- 출력된 `KAKAO_REFRESH_TOKEN`과 어머니의 uuid를 `.env`에 넣고 `npm run kakao:test`를 실행하면, 어머니께 테스트 메시지가 가는지 확인할 수 있습니다.

## 4. GitHub Secrets 등록

**Settings → Secrets and variables → Actions → New repository secret**에서 등록합니다.

| 이름 | 값 |
|---|---|
| `KAKAO_REST_API_KEY` | REST API 키 |
| `KAKAO_CLIENT_SECRET` | Client Secret (사용하는 경우만) |
| `KAKAO_REFRESH_TOKEN` | ②에서 출력된 리프레시 토큰 |
| `KAKAO_RECEIVER_UUIDS` | 어머니 uuid (여러 명이면 쉼표로 구분) |
| `GH_PAT` | 아래 설명 참고 |

**`GH_PAT`가 필요한 이유**: 카카오 리프레시 토큰은 2개월 동안 유효하고, 만료 1개월 전부터는 갱신할 때 새 토큰이 나옵니다. 워크플로는 이 새 토큰을 Secret에 자동으로 다시 저장하는데, 그러려면 권한이 있는 토큰이 필요합니다.
GitHub **Settings → Developer settings → Fine-grained tokens**에서 토큰을 만드세요. 이 저장소만 선택하고, **Repository permissions → Secrets: Read and write**를 주면 됩니다.

## 5. 동작 확인

**Actions → 채용공고 확인 → Run workflow**로 바로 실행해 볼 수 있습니다. 실행이 끝나면 `https://<아이디>.github.io/<저장소>/`에서 결과를 볼 수 있습니다.

## 알아둘 점

- GitHub의 cron은 정시보다 몇 분에서 수십 분 늦게 실행될 수 있습니다.
- 저장소에 60일 동안 활동이 없으면 예약 실행이 자동으로 꺼질 수 있습니다. 이 워크플로는 실행할 때마다 확인 시각을 커밋하므로 보통은 괜찮지만, 꺼졌다면 Actions 탭에서 다시 켜주세요.
- 카카오 알림이 실패하면 워크플로가 **실패(빨간색)** 로 표시되고 GitHub가 메일로 알려줍니다. 사이트 수집 실패는 웹페이지 하단의 "확인 중인 게시판"에 표시됩니다.
- 일부 사이트가 해외 IP(GitHub 서버)를 막는다면 해당 사이트만 수집 실패로 표시됩니다.
