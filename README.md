# 채용공고 알림

매일 **오전 9시 · 오후 3시**에 게시판 5곳을 확인해요.
제목에 **생활지원사**가 들어간 새 글이 있으면 **어머니 카톡으로 알림**을 보내요.

> 💡 VS Code에서는 `Cmd + Shift + V`를 누르면 이 문서를 보기 좋게 볼 수 있어요.

---

## ✅ 설정 순서 한눈에 보기

| 단계 | 할 일 | 누가 |
|:-:|---|:-:|
| 1 | 카카오 앱 만들기 · 설정 | 나 |
| 2 | 어머니를 앱 멤버로 초대 | 나 → 어머니 |
| 3 | 토큰 발급 (터미널) | 나 + 어머니 폰 |
| 4 | 테스트 메시지 보내기 | 나 |
| 5 | GitHub Secrets 등록 | 나 |

---

## 1단계. 카카오 앱 만들기

[developers.kakao.com](https://developers.kakao.com)에 **내 카카오계정**으로 로그인 → **앱 만들기**

왼쪽 메뉴 기준으로 아래를 차례대로 설정하세요.

### 📌 앱 › 플랫폼 키 › REST API 키
- [ ] **REST API 키** 복사 → 메모
- [ ] **카카오 로그인 리다이렉트 URI**에 아래 주소 등록
  ```
  http://localhost:8787/callback
  ```
- [ ] **클라이언트 시크릿**이 켜져 있으면 그 값도 복사 → 메모

### 📌 앱 › 일반 › 비즈니스 정보
- [ ] **개인 개발자 비즈 앱**으로 전환 (본인인증 필요)
  - 친구 목록 권한을 쓰려면 필요해요.

### 📌 앱 › 제품 링크 관리 › 웹 도메인
메시지의 "공고 보기" 버튼이 열리도록 아래 5개를 등록하세요.
- [ ] `http://www.ihnw.or.kr`
- [ ] `https://gcwc.or.kr`
- [ ] `http://www.gnlifeline.or.kr`
- [ ] `https://bohyun.kr`
- [ ] `http://www.gdolbom.or.kr`

### 📌 카카오 로그인 › 사용 설정
- [ ] 상태 **ON**

### 📌 카카오 로그인 › 동의항목
- [ ] **개인정보** › `카카오 서비스 내 친구목록` → 설정 (이용 중 동의)
- [ ] **접근권한** › `카카오톡 메시지 전송` → 설정 (선택 동의)

---

## 2단계. 어머니를 앱 멤버로 초대

### 📌 앱 › 멤버 › 멤버 추가
- [ ] 어머니 **카카오계정 이메일** 입력 → 초대
- [ ] 어머니가 초대 메일의 링크를 열고 **카카오디벨로퍼스에 가입**
  - 가입하기 전에는 상태가 "초대 메일 발송됨"으로 보여요.
- [ ] 나와 어머니가 **카톡 친구**인지 확인

> 심사를 받지 않은 앱은 **멤버끼리만** 메시지를 보낼 수 있어서 이 단계가 꼭 필요해요.

---

## 3단계. 토큰 발급 (터미널)

먼저 `.env` 파일을 만들고 1단계에서 메모한 키를 넣으세요.

```bash
cp .env.example .env
```

**① 어머니 계정 연결** (QR 로그인 → 어머니 폰 카톡으로 QR 찍기)
```bash
npm run kakao:auth -- --receiver
```

**② 내 계정으로 토큰 받기** (①이 끝나고 10분쯤 지나서 실행)
```bash
npm run kakao:auth
```

② 결과에 이렇게 나와요. 두 값을 `.env`에도 넣어두세요.
```
KAKAO_REFRESH_TOKEN = xxxxxxxx...
친구 목록:
  엄마  →  abcd1234...   ← 이게 어머니 uuid
```

> 친구 목록에 어머니가 안 보이면 10분 뒤에 ②를 다시 실행하세요. 친구 목록이 10분 동안 캐시돼요.

---

## 4단계. 테스트 메시지

```bash
npm run kakao:test
```
- [ ] 어머니 카톡에 "알림 테스트" 메시지가 오면 성공 🎉

---

## 5단계. GitHub Secrets 등록

GitHub 저장소 › **Settings › Secrets and variables › Actions › New repository secret**

| 이름 | 넣을 값 |
|---|---|
| `KAKAO_REST_API_KEY` | REST API 키 |
| `KAKAO_CLIENT_SECRET` | 클라이언트 시크릿 (켜둔 경우만) |
| `KAKAO_REFRESH_TOKEN` | 3단계 ②의 토큰 |
| `KAKAO_RECEIVER_UUIDS` | 어머니 uuid |
| `GH_PAT` | 아래 참고 |

**`GH_PAT` 만들기**
GitHub › Settings › Developer settings › **Fine-grained tokens** › Generate new token
- Repository access: **이 저장소만** 선택
- Permissions: **Secrets → Read and write**

> 왜 필요하냐면: 카카오 토큰은 2개월마다 새로 바뀌어요. 바뀐 토큰을 자동으로 다시 저장하려면 이 권한이 있어야 해요.

**마지막으로** Actions 탭 › **채용공고 확인** › **Run workflow**를 눌러 한 번 돌려보세요.

---

## 참고

<details>
<summary>동작 방식</summary>

- GitHub Actions가 정해진 시간에 `src/check.js`를 실행해요.
- 게시판을 읽고 `data/posts.json`의 이전 결과와 비교해요.
- 키워드가 들어간 새 글만 카톡으로 보내요.
- 결과는 GitHub Pages 웹페이지에 표시돼요.
- 처음 수집한 글은 알림 없이 기준선으로만 저장해요. 예전 공고가 한꺼번에 가지 않아요.
- 전송에 실패하면 다음 실행 때 다시 보내요. 발견된 지 3일이 지난 글은 보내지 않아요.
</details>

<details>
<summary>사이트 · 키워드 바꾸기</summary>

`sites.json`만 고치면 돼요. `postPattern`은 게시글 링크에서 글 번호를 뽑는 정규식이에요.
</details>

<details>
<summary>알아둘 점</summary>

- GitHub의 예약 실행은 몇 분에서 수십 분 늦게 돌 수 있어요.
- 카톡 알림이 실패하면 Actions가 빨간색으로 표시되고 GitHub가 메일로 알려줘요.
- 사이트를 읽지 못하면 웹페이지 아래쪽 "확인 중인 게시판"에 표시돼요.
- 저장소에 60일 동안 활동이 없으면 예약 실행이 꺼질 수 있어요. 꺼지면 Actions 탭에서 다시 켜세요.
</details>
