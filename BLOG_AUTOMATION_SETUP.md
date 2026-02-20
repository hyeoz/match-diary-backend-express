# 슬랙-Claude 블로그 자동 포스팅 시스템 설정 가이드

슬랙 채널에 메시지와 이미지를 올리면 Claude AI가 블로그 포스팅을 생성하고, 승인 후 네이버 블로그에 자동으로 업로드하는 시스템입니다.

## 📋 목차

1. [시스템 요구사항](#시스템-요구사항)
2. [설치 과정](#설치-과정)
3. [Slack 앱 설정](#slack-앱-설정)
4. [Claude API 키 발급](#claude-api-키-발급)
5. [환경 변수 설정](#환경-변수-설정)
6. [실행 방법](#실행-방법)
7. [사용 방법](#사용-방법)
8. [트러블슈팅](#트러블슈팅)

---

## 🔧 시스템 요구사항

- **Node.js**: v18 이상
- **Python**: 3.8 이상
- **Chrome 브라우저**: Selenium용
- **네이버 계정**: 블로그 권한 필요
- **Slack 워크스페이스**: 관리자 권한 필요

---

## 📦 설치 과정

### 1. Node.js 패키지 설치

```bash
npm install
```

### 2. Python 패키지 설치

```bash
pip install -r requirements.txt
```

---

## 🤖 Slack 앱 설정

### 1. Slack 앱 생성

1. [Slack API 대시보드](https://api.slack.com/apps) 접속
2. **"Create New App"** 클릭
3. **"From scratch"** 선택
4. 앱 이름 입력 (예: "Blog Automation Bot")
5. 워크스페이스 선택

### 2. Socket Mode 활성화

1. 왼쪽 메뉴에서 **"Socket Mode"** 선택
2. **"Enable Socket Mode"** 토글 켜기
3. App-Level Token 이름 입력 (예: "blog-bot-token")
4. **Scope**: `connections:write` 추가
5. 생성된 **App Token (xapp-...)** 복사 → `.env`의 `SLACK_APP_TOKEN`

### 3. Bot 권한 설정

1. 왼쪽 메뉴에서 **"OAuth & Permissions"** 선택
2. **Bot Token Scopes**에 다음 권한 추가:
   - `chat:write` - 메시지 전송
   - `files:read` - 파일 읽기
   - `channels:history` - 채널 메시지 읽기
   - `channels:read` - 채널 정보 읽기
   - `im:history` - DM 메시지 읽기

3. 상단의 **"Install to Workspace"** 클릭
4. 권한 승인
5. 생성된 **Bot User OAuth Token (xoxb-...)** 복사 → `.env`의 `SLACK_BOT_TOKEN`

### 4. Event Subscriptions 설정

1. 왼쪽 메뉴에서 **"Event Subscriptions"** 선택
2. **"Enable Events"** 토글 켜기
3. **Subscribe to bot events**에 다음 이벤트 추가:
   - `message.channels` - 채널 메시지 수신
4. **"Save Changes"** 클릭

### 5. Interactivity 설정

1. 왼쪽 메뉴에서 **"Interactivity & Shortcuts"** 선택
2. **"Interactivity"** 토글 켜기
3. **"Save Changes"** 클릭

### 6. 채널에 봇 초대

1. 슬랙 채널 생성 (예: `#blog-automation`)
2. 채널에서 `/invite @Blog Automation Bot` 입력
3. 채널 ID 복사:
   - 채널 이름 클릭 → "About" → 하단의 Channel ID 복사
   - `.env`의 `SLACK_BLOG_CHANNEL_ID`에 입력

### 7. Signing Secret 복사

1. 왼쪽 메뉴에서 **"Basic Information"** 선택
2. **"App Credentials"** 섹션에서 **Signing Secret** 복사
3. `.env`의 `SLACK_SIGNING_SECRET`에 입력

---

## 🔑 Claude API 키 발급

1. [console.anthropic.com](https://console.anthropic.com) 접속
2. 이메일로 회원가입
3. 대시보드에서 **"API Keys"** 클릭
4. **"+Create Key"** 버튼 클릭
5. 키 이름 입력 (예: "blog-automation")
6. 생성된 키 복사 (⚠️ 한 번만 표시됨!)
7. `.env`의 `ANTHROPIC_API_KEY`에 입력

**💰 과금 정보:**
- 신규 가입자는 무료 크레딧 제공
- Pay-as-you-go 방식
- Claude 3.5 Sonnet: 입력 $3/M tokens, 출력 $15/M tokens

---

## ⚙️ 환경 변수 설정

### 1. `.env` 파일 생성

```bash
cp .env.example .env
```

### 2. `.env` 파일 수정

```env
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_BLOG_CHANNEL_ID=C1234567890

# Claude AI Configuration
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Naver Blog Configuration
NAVER_BLOG_ID=your_naver_id
NAVER_BLOG_PASSWORD=your_naver_password
NAVER_BLOG_URL=https://blog.naver.com/your_blog_id

# Chrome Driver Configuration
HEADLESS_MODE=true  # false로 설정하면 브라우저가 보임

# 기존 환경 변수 (Database, AWS, Sentry 등)는 그대로 유지
```

---

## 🚀 실행 방법

### 1. 개발 모드 (로컬)

```bash
# Slack Bot 실행
node slack-bot.js
```

### 2. 프로덕션 모드 (PM2)

```bash
# package.json에 스크립트 추가
npm run start-blog-bot
```

**package.json에 다음 스크립트 추가:**

```json
{
  "scripts": {
    "start-blog-bot": "pm2 start slack-bot.js --name blog-automation-bot"
  }
}
```

---

## 📱 사용 방법

### 1. 블로그 포스팅 생성

1. 설정한 슬랙 채널 (예: `#blog-automation`)에 메시지 작성
2. 이미지 첨부 (선택사항)
3. 전송

**예시 메시지:**
```
오늘 잠실에서 LG vs 두산 경기 직관했어!
날씨도 좋고 경기도 재밌었는데 결과가 아쉽더라 ㅠㅠ
다음엔 꼭 이기길!!
```

### 2. Claude AI가 블로그 포스팅 생성

- Claude가 자동으로 블로그 스타일에 맞춰 글 작성
- 제목, 본문, 태그(10개 이상) 생성
- 미리보기 메시지 전송

### 3. 승인 및 업로드

- **✅ 승인 & 업로드** 버튼 클릭 → 네이버 블로그 자동 포스팅
- **❌ 거부** 버튼 클릭 → 취소

### 4. 완료 알림

- 업로드 완료 시 슬랙에 블로그 URL 전송

---

## 🎨 블로그 스타일 커스터마이징

`blog-automation/claude-service.js` 파일에서 `styleGuide` 변수를 수정하여 블로그 톤앤매너를 조정할 수 있습니다.

```javascript
const styleGuide = `
당신은 네이버 블로그 포스팅을 작성하는 전문 작가입니다.

## 말투 및 톤
- 친근하고 편안한 반말 사용
- 독자와 대화하듯이 자연스러운 어투

## 문단 구성
- 짧고 간결한 문단 (2-3문장)
...
`;
```

---

## 🐛 트러블슈팅

### 1. Slack Bot이 메시지를 받지 못할 때

**원인:**
- Socket Mode 미활성화
- Event Subscriptions 설정 누락
- 채널에 봇 미초대

**해결:**
```bash
# 봇이 채널에 있는지 확인
/invite @Blog Automation Bot

# 로그 확인
pm2 logs blog-automation-bot
```

### 2. 네이버 로그인 실패 (Captcha)

**원인:**
- 네이버가 자동화를 감지

**해결:**
1. `HEADLESS_MODE=false`로 설정하여 브라우저 직접 확인
2. 수동으로 로그인 후 쿠키 저장 방식으로 변경 (고급)
3. IP 주소 변경

### 3. Claude API 오류

**원인:**
- API 키 만료 또는 잘못됨
- 크레딧 소진

**해결:**
```bash
# 환경 변수 확인
echo $ANTHROPIC_API_KEY

# .env 파일 재확인
cat .env | grep ANTHROPIC
```

### 4. Python 스크립트 실행 오류

**원인:**
- Python 패키지 미설치
- Chrome Driver 호환성 문제

**해결:**
```bash
# 패키지 재설치
pip install -r requirements.txt --force-reinstall

# Chrome Driver 수동 업데이트
pip install webdriver-manager --upgrade
```

### 5. 이미지 업로드 실패

**원인:**
- S3 권한 문제
- Slack 파일 접근 권한 부족

**해결:**
- AWS S3 버킷 정책 확인
- Slack Bot 권한에 `files:read` 추가

---

## 📂 프로젝트 구조

```
match-diary-backend-express/
├── blog-automation/
│   ├── claude-service.js          # Claude API 연동
│   └── naver-blog-poster.py       # Selenium 네이버 블로그 자동 포스팅
├── slack-bot.js                   # Slack Bot 메인 서버
├── .env.example                   # 환경 변수 예시
├── requirements.txt               # Python 패키지
├── package.json                   # Node.js 패키지
└── BLOG_AUTOMATION_SETUP.md       # 이 문서
```

---

## 🔒 보안 주의사항

1. **절대 공개 저장소에 업로드하지 마세요:**
   - `.env` 파일
   - 네이버 계정 정보
   - Slack 토큰
   - Claude API 키

2. **`.gitignore`에 추가:**
   ```
   .env
   .env.local
   ```

3. **API 키 주기적으로 갱신**

---

## 📞 문의 및 피드백

문제가 발생하거나 개선 사항이 있다면 이슈를 등록해주세요!

---

**Made with ❤️ by hyeoz**
