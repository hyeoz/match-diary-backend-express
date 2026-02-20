#!/usr/bin/env python3
"""
네이버 블로그 자동 포스팅 스크립트 (Selenium)
"""

import sys
import json
import os
import time
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

# 환경 변수 로드
load_dotenv()

NAVER_ID = os.getenv("NAVER_BLOG_ID")
NAVER_PASSWORD = os.getenv("NAVER_BLOG_PASSWORD")
HEADLESS_MODE = os.getenv("HEADLESS_MODE", "true").lower() == "true"


def setup_driver():
    """Chrome 드라이버 설정"""
    chrome_options = Options()

    if HEADLESS_MODE:
        chrome_options.add_argument("--headless")

    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument(
        "user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )

    # 자동화 탐지 방지
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)

    # 자동화 탐지 방지 스크립트
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": """
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            })
        """
    })

    return driver


def login_naver(driver):
    """네이버 로그인"""
    try:
        print("🔐 네이버 로그인 시작...")
        driver.get("https://nid.naver.com/nidlogin.login")

        # 로그인 폼 대기
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "id"))
        )

        # JavaScript로 입력 (captcha 우회)
        driver.execute_script(
            f"document.getElementById('id').value = '{NAVER_ID}'"
        )
        time.sleep(0.5)

        driver.execute_script(
            f"document.getElementById('pw').value = '{NAVER_PASSWORD}'"
        )
        time.sleep(0.5)

        # 로그인 버튼 클릭
        login_btn = driver.find_element(By.ID, "log.login")
        login_btn.click()

        # 로그인 완료 대기
        time.sleep(3)

        # 로그인 성공 확인
        if "nid.naver.com" in driver.current_url:
            print("❌ 로그인 실패 - Captcha 또는 보안 문제 발생")
            return False

        print("✅ 네이버 로그인 성공")
        return True

    except Exception as e:
        print(f"❌ 로그인 중 오류: {e}")
        return False


def upload_images(driver, image_urls):
    """이미지 업로드"""
    try:
        if not image_urls:
            return []

        print(f"📸 이미지 {len(image_urls)}개 업로드 중...")

        # 스마트에디터 iframe으로 전환
        driver.switch_to.frame("mainFrame")

        uploaded_images = []

        for idx, img_url in enumerate(image_urls):
            # 이미지 URL 삽입 버튼 클릭
            # 실제 네이버 블로그 에디터 구조에 맞게 수정 필요
            # 여기서는 예시 코드입니다

            # 이미지는 S3 URL을 직접 HTML에 삽입하는 방식 사용
            uploaded_images.append(img_url)
            print(f"  ✅ 이미지 {idx + 1} 준비 완료")

        driver.switch_to.default_content()
        return uploaded_images

    except Exception as e:
        print(f"❌ 이미지 업로드 중 오류: {e}")
        driver.switch_to.default_content()
        return []


def post_to_blog(driver, title, content, tags, image_urls):
    """블로그 포스팅"""
    try:
        print("📝 블로그 포스팅 시작...")

        # 블로그 글쓰기 페이지로 이동
        driver.get("https://blog.naver.com/PostWriteForm.naver")

        # 페이지 로딩 대기
        time.sleep(3)

        # 제목 입력
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[placeholder*='제목']"))
        )

        title_input = driver.find_element(By.CSS_SELECTOR, "input[placeholder*='제목']")
        title_input.clear()
        title_input.send_keys(title)
        print(f"  ✅ 제목 입력: {title}")

        time.sleep(1)

        # 스마트에디터 iframe으로 전환
        driver.switch_to.frame("mainFrame")

        # 본문 입력
        # HTML 모드로 전환
        try:
            html_mode_btn = driver.find_element(By.CSS_SELECTOR, "button[data-mode='html']")
            html_mode_btn.click()
            time.sleep(1)
        except:
            pass

        # 이미지 URL을 content에 삽입
        content_with_images = content
        for idx, img_url in enumerate(image_urls):
            placeholder = f"[IMAGE_{idx + 1}]"
            img_tag = f'<img src="{img_url}" style="max-width: 100%;" /><br/>'
            content_with_images = content_with_images.replace(placeholder, img_tag)

        # 본문 삽입
        driver.execute_script(
            f"document.querySelector('.se-content').innerHTML = `{content_with_images}`"
        )
        print("  ✅ 본문 입력 완료")

        # iframe에서 나오기
        driver.switch_to.default_content()

        time.sleep(1)

        # 태그 입력
        try:
            tag_input = driver.find_element(By.CSS_SELECTOR, "input[placeholder*='태그']")
            for tag in tags[:20]:  # 최대 20개까지
                tag_input.send_keys(tag)
                tag_input.send_keys(",")
                time.sleep(0.3)
            print(f"  ✅ 태그 {len(tags[:20])}개 입력 완료")
        except Exception as e:
            print(f"  ⚠️ 태그 입력 건너뜀: {e}")

        time.sleep(1)

        # 발행 버튼 클릭
        publish_btn = driver.find_element(By.CSS_SELECTOR, "button.publish_btn")
        publish_btn.click()

        print("  ✅ 발행 버튼 클릭")

        # 발행 완료 대기
        time.sleep(5)

        # 발행된 포스팅 URL 가져오기
        post_url = driver.current_url

        print(f"✅ 블로그 포스팅 완료: {post_url}")
        return post_url

    except Exception as e:
        print(f"❌ 포스팅 중 오류: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """메인 함수"""
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "JSON 파일 경로가 필요합니다."}))
        sys.exit(1)

    json_file = sys.argv[1]

    try:
        # JSON 파일 읽기
        with open(json_file, 'r', encoding='utf-8') as f:
            post_data = json.load(f)

        title = post_data.get("title", "")
        content = post_data.get("content", "")
        tags = post_data.get("tags", [])
        image_urls = post_data.get("imageUrls", [])

        if not title or not content:
            print(json.dumps({"success": False, "error": "제목 또는 본문이 없습니다."}))
            sys.exit(1)

        # 드라이버 설정
        driver = setup_driver()

        try:
            # 네이버 로그인
            if not login_naver(driver):
                print(json.dumps({"success": False, "error": "로그인 실패"}))
                sys.exit(1)

            # 블로그 포스팅
            post_url = post_to_blog(driver, title, content, tags, image_urls)

            if post_url:
                print(json.dumps({"success": True, "url": post_url}))
            else:
                print(json.dumps({"success": False, "error": "포스팅 실패"}))
                sys.exit(1)

        finally:
            driver.quit()

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
