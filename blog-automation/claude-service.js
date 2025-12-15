import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Claude API를 사용하여 블로그 포스팅 콘텐츠 생성
 * @param {string} userContent - 사용자가 입력한 내용
 * @param {string[]} imageUrls - 첨부된 이미지 URL 배열
 * @returns {Promise<{title: string, content: string, tags: string[]}>}
 */
export async function generateBlogPost(userContent, imageUrls = []) {
  try {
    // 블로그 스타일 가이드 (https://blog.naver.com/8125686 기반)
    const styleGuide = `
당신은 네이버 블로그 포스팅을 작성하는 전문 작가입니다.
아래 스타일 가이드를 철저히 따라 글을 작성해주세요:

## 말투 및 톤
- 친근하고 편안한 반말 사용 (예: "~했어", "~인 것 같아", "~더라")
- 독자와 대화하듯이 자연스러운 어투
- 감정을 솔직하게 표현

## 문단 구성
- 짧고 간결한 문단 (2-3문장)
- 읽기 편한 구조
- 중간중간 공백으로 가독성 향상

## 특징적 요소
- 경험과 느낌을 중심으로 서술
- 구체적인 디테일 포함
- 사진과 연관된 설명 추가

## 이모티콘 및 표현
- 적절한 이모티콘 사용 (⚾️, 🏟️, 😊, 👍 등)
- 감탄사 활용 (와, 진짜, 대박 등)

## SEO 태그
- 주제와 관련된 태그 10개 이상 생성
- 인기 검색어 포함
- 지역명, 팀명 등 구체적인 키워드
`;

    const userMessage = `
다음 내용을 바탕으로 블로그 포스팅을 작성해주세요.

사용자 입력 내용:
${userContent}

${imageUrls.length > 0 ? `첨부된 이미지: ${imageUrls.length}장` : ""}

아래 JSON 형식으로 응답해주세요:
{
  "title": "포스팅 제목 (흥미로운 제목, 40자 이내)",
  "content": "포스팅 본문 (HTML 태그 사용 가능, 이미지는 [IMAGE_1], [IMAGE_2] 형태로 표시)",
  "tags": ["태그1", "태그2", ... "태그10+"]
}
`;

    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: styleGuide + "\n\n" + userMessage,
            },
          ],
        },
      ],
    });

    // Claude 응답에서 JSON 추출
    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("Claude 응답에서 JSON을 찾을 수 없습니다.");
    }

    const blogPost = JSON.parse(jsonMatch[0]);

    // 태그가 10개 미만이면 경고
    if (blogPost.tags.length < 10) {
      console.warn(
        `경고: 태그가 ${blogPost.tags.length}개만 생성되었습니다. 10개 이상 권장합니다.`
      );
    }

    return {
      title: blogPost.title,
      content: blogPost.content,
      tags: blogPost.tags,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  } catch (error) {
    console.error("Claude API 오류:", error);
    throw new Error(`블로그 포스팅 생성 실패: ${error.message}`);
  }
}

/**
 * 블로그 포스팅 미리보기 포맷 (슬랙 메시지용)
 * @param {Object} blogPost - generateBlogPost의 반환값
 * @returns {string} 슬랙 메시지 형식의 미리보기
 */
export function formatPreviewForSlack(blogPost) {
  const preview = `
📝 *블로그 포스팅 생성 완료!*

*제목:*
${blogPost.title}

*본문 미리보기:*
${blogPost.content.substring(0, 500)}...

*태그 (${blogPost.tags.length}개):*
${blogPost.tags.join(", ")}

---
_생성된 내용을 확인하고 네이버 블로그에 업로드하시겠습니까?_
`;

  return preview;
}
