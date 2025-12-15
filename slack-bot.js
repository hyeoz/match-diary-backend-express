import { App } from "@slack/bolt";
import dotenv from "dotenv";
import axios from "axios";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { generateBlogPost, formatPreviewForSlack } from "./blog-automation/claude-service.js";
import { spawn } from "child_process";
import * as Sentry from "@sentry/node";
import fs from "fs";
import path from "path";

dotenv.config();

// Sentry 초기화
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});

// Slack 앱 초기화
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// S3 클라이언트 초기화
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// 임시 데이터 저장소 (실제로는 DB나 Redis 사용 권장)
const pendingPosts = new Map();

/**
 * 슬랙 파일을 S3에 업로드
 */
async function uploadSlackImageToS3(fileUrl, token) {
  try {
    // Slack 파일 다운로드
    const response = await axios.get(fileUrl, {
      responseType: "arraybuffer",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const fileName = `blog-images/${Date.now()}_${path.basename(fileUrl)}`;

    // S3 업로드
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: response.data,
      ContentType: response.headers["content-type"],
    });

    await s3.send(command);

    return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
  } catch (error) {
    console.error("S3 업로드 실패:", error);
    throw error;
  }
}

/**
 * 메시지 이벤트 핸들러 (블로그 채널에서 메시지 수신)
 */
app.message(async ({ message, say, client }) => {
  try {
    // 블로그 자동화 채널에서만 동작
    if (message.channel !== process.env.SLACK_BLOG_CHANNEL_ID) {
      return;
    }

    // 봇 메시지나 서브타입이 있는 메시지 무시
    if (message.subtype || message.bot_id) {
      return;
    }

    console.log("📨 블로그 포스팅 요청 수신:", message.text);

    // 로딩 메시지 전송
    const loadingMsg = await say({
      text: "🤖 블로그 포스팅을 생성하고 있어요... 잠시만 기다려주세요!",
    });

    // 첨부된 이미지 처리
    let imageUrls = [];
    if (message.files && message.files.length > 0) {
      console.log(`📸 이미지 ${message.files.length}개 처리 중...`);

      for (const file of message.files) {
        if (file.mimetype?.startsWith("image/")) {
          try {
            const s3Url = await uploadSlackImageToS3(
              file.url_private,
              process.env.SLACK_BOT_TOKEN
            );
            imageUrls.push(s3Url);
            console.log(`✅ 이미지 업로드 완료: ${s3Url}`);
          } catch (error) {
            console.error("이미지 업로드 실패:", error);
          }
        }
      }
    }

    // Claude API로 블로그 포스팅 생성
    console.log("🤖 Claude API 호출 중...");
    const blogPost = await generateBlogPost(message.text, imageUrls);

    // 생성된 포스팅 저장 (승인 대기)
    const postId = `post_${Date.now()}`;
    pendingPosts.set(postId, {
      ...blogPost,
      imageUrls,
      userId: message.user,
      channelId: message.channel,
    });

    // 미리보기 및 승인 버튼 전송
    await client.chat.update({
      channel: message.channel,
      ts: loadingMsg.ts,
      text: formatPreviewForSlack(blogPost),
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `📝 *블로그 포스팅 생성 완료!*\n\n*제목:*\n${blogPost.title}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*본문 미리보기:*\n${blogPost.content.substring(0, 300)}...`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*태그 (${blogPost.tags.length}개):*\n${blogPost.tags.slice(0, 10).join(", ")}${blogPost.tags.length > 10 ? ` 외 ${blogPost.tags.length - 10}개` : ""}`,
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "_생성된 내용을 확인하고 네이버 블로그에 업로드하시겠습니까?_",
          },
        },
        {
          type: "actions",
          block_id: "blog_post_actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "✅ 승인 & 업로드",
              },
              style: "primary",
              value: postId,
              action_id: "approve_post",
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "❌ 거부",
              },
              style: "danger",
              value: postId,
              action_id: "reject_post",
            },
          ],
        },
      ],
    });

    console.log(`✅ 포스팅 생성 완료 (ID: ${postId})`);
  } catch (error) {
    console.error("메시지 처리 중 오류:", error);
    Sentry.captureException(error);
    await say({
      text: `❌ 오류가 발생했습니다: ${error.message}`,
    });
  }
});

/**
 * 승인 버튼 클릭 핸들러
 */
app.action("approve_post", async ({ body, ack, say, client }) => {
  await ack();

  try {
    const postId = body.actions[0].value;
    const post = pendingPosts.get(postId);

    if (!post) {
      await say({ text: "❌ 포스팅 데이터를 찾을 수 없습니다." });
      return;
    }

    // 업로드 중 메시지
    await say({ text: "📤 네이버 블로그에 업로드 중입니다..." });

    // Python 스크립트로 네이버 블로그 포스팅
    const result = await uploadToNaverBlog(post);

    if (result.success) {
      await say({
        text: `✅ 블로그 포스팅 완료!\n📍 ${result.url || process.env.NAVER_BLOG_URL}`,
      });
    } else {
      await say({
        text: `❌ 블로그 업로드 실패: ${result.error}`,
      });
    }

    // 완료 후 임시 데이터 삭제
    pendingPosts.delete(postId);
  } catch (error) {
    console.error("승인 처리 중 오류:", error);
    Sentry.captureException(error);
    await say({ text: `❌ 오류가 발생했습니다: ${error.message}` });
  }
});

/**
 * 거부 버튼 클릭 핸들러
 */
app.action("reject_post", async ({ body, ack, say }) => {
  await ack();

  try {
    const postId = body.actions[0].value;
    pendingPosts.delete(postId);

    await say({
      text: "❌ 포스팅이 취소되었습니다.",
    });
  } catch (error) {
    console.error("거부 처리 중 오류:", error);
    Sentry.captureException(error);
  }
});

/**
 * Python 스크립트를 호출하여 네이버 블로그에 포스팅
 */
function uploadToNaverBlog(post) {
  return new Promise((resolve, reject) => {
    // 임시 JSON 파일 생성
    const tempFile = `/tmp/blog_post_${Date.now()}.json`;
    fs.writeFileSync(tempFile, JSON.stringify(post, null, 2));

    const pythonProcess = spawn("python3", [
      "./blog-automation/naver-blog-poster.py",
      tempFile,
    ]);

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
      console.log(`Python stdout: ${data}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
      console.error(`Python stderr: ${data}`);
    });

    pythonProcess.on("close", (code) => {
      // 임시 파일 삭제
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        console.error("임시 파일 삭제 실패:", e);
      }

      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          resolve({ success: true, url: null });
        }
      } else {
        resolve({
          success: false,
          error: errorOutput || "알 수 없는 오류",
        });
      }
    });

    pythonProcess.on("error", (error) => {
      reject(error);
    });
  });
}

// 앱 시작
(async () => {
  try {
    await app.start();
    console.log("⚡️ Slack Bot이 실행되었습니다!");
    console.log(`📢 채널 ID: ${process.env.SLACK_BLOG_CHANNEL_ID}`);
  } catch (error) {
    console.error("Slack Bot 시작 실패:", error);
    Sentry.captureException(error);
    process.exit(1);
  }
})();
