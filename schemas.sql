CREATE DATABASE match_diary_backend_express;
USE match_diary_backend_express;

-- 경기 정보 테이블
CREATE TABLE matches (
  id INT AUTO_INCREMENT PRIMARY KEY,  -- 고유 식별자
  date DATE NOT NULL,                 -- 경기 날짜
  time TIME NOT NULL,                 -- 경기 시간
  home INT NOT NULL,         -- 홈 팀 ID
  away INT NOT NULL,         -- 원정 팀 ID
  stadium INT NOT NULL,      -- 경기장 ID
  home_score INT DEFAULT NULL,        -- 홈 팀 점수
  away_score INT DEFAULT NULL,        -- 원정 팀 점수
  memo TEXT DEFAULT NULL,              -- 추가 메모
  FOREIGN KEY (home) REFERENCES kbo_teams(team_id),
  FOREIGN KEY (away) REFERENCES kbo_teams(team_id),
  FOREIGN KEY (stadium) REFERENCES kbo_stadiums(stadium_id)
);

-- INSERT INTO matches (date, time, home, away, stadium, home_score, away_score, memo)
-- VALUES
-- (STR_TO_DATE('2024.03.23', '%Y.%m.%d'), '14:00:00', 2, 10, 2, 3, 2, NULL),
-- (STR_TO_DATE('2024.03.23', '%Y.%m.%d'), '14:00:00', 1, 8, 1, 5, 3, '개막전');

-- 팀 테이블
CREATE TABLE kbo_teams (
    team_id INT AUTO_INCREMENT PRIMARY KEY, -- 팀 ID
    team_name VARCHAR(100) NOT NULL,       -- 팀 이름
    team_short_name VARCHAR(100) NOT NULL       -- 팀 이름(축약)
);

INSERT INTO kbo_teams (team_name, team_short_name)
VALUES
('SSG 랜더스', 'SSG'),
('LG 트윈스', 'LG'),
('키움 히어로즈', '키움'),
('KT 위즈', 'KT'),
('KIA 타이거즈', 'KIA'),
('NC 다이노스', 'NC'),
('삼성 라이온즈', '삼성'),
('롯데 자이언츠', '롯데'),
('두산 베어스', '두산'),
('한화 이글스', '한화');


-- 경기장 테이블
CREATE TABLE kbo_stadiums (
    stadium_id INT AUTO_INCREMENT PRIMARY KEY, -- 경기장 ID
    stadium_name VARCHAR(255) NOT NULL,        -- 경기장 이름
    stadium_short_name VARCHAR(255) NOT NULL,        -- 경기장 이름(축약)
    latitude DECIMAL(10, 8) NOT NULL,          -- 위도
    longitude DECIMAL(11, 8) NOT NULL         -- 경도
);

INSERT INTO kbo_stadiums (stadium_name, stadium_short_name, latitude, longitude)
VALUES 
('인천SSG랜더스필드', '인천', 37.4370423, 126.6932617),
('잠실야구장', '잠실', 37.5122579, 127.0719011),
('수원KT위즈파크', '수원', 37.2997553, 127.0096685),
('대전한화생명볼파크', '대전', 36.3163364, 127.4306331),
('대구삼성라이온즈파크', '대구', 35.8410136, 128.6819955),
('사직야구장', '사직', 35.1940316, 129.0615183),
('광주기아챔피언스필드', '광주', 35.1682592, 126.8884114),
('창원NC파크', '창원', 35.2225335, 128.5823895),
('고척스카이돔', '고척', 37.498182, 126.8670082),
('포항야구장', '포항', 36.0081953, 129.3593993),
('울산문수야구장', '울산', 35.5321681, 129.2655749),
('청주종합운동장야구장', '청주', 36.6394554, 127.4701387);


-- 팀 - 경기장 관계 테이블
CREATE TABLE team_stadiums (
    team_id INT NOT NULL,                      -- 팀 ID (외래 키)
    stadium_id INT NOT NULL,                   -- 경기장 ID (외래 키)
    PRIMARY KEY (team_id, stadium_id),         -- 복합 기본 키
    FOREIGN KEY (team_id) REFERENCES kbo_teams(team_id),
    FOREIGN KEY (stadium_id) REFERENCES kbo_stadiums(stadium_id)
);

INSERT INTO team_stadiums (team_id, stadium_id)
VALUES 
(1, 1),
(2, 2),
(3, 9),
(4, 3),
(5, 7),
(6, 8),
(7, 5),
(7, 10),
(8, 6),
(8, 11),
(9, 2),
(10, 4),
(10, 12);

-- 유저 정보 테이블
CREATE TABLE user_profiles (
    user_id VARCHAR(255) PRIMARY KEY, -- 사용자 ID
    nickname VARCHAR(100) DEFAULT NULL,         -- 닉네임
    team_id INT DEFAULT NULL,              -- 선호 팀 ID
    FOREIGN KEY (team_id) REFERENCES kbo_teams(team_id)
);

-- INSERT INTO user_profiles (user_id, nickname, team_id)
-- VALUES
-- ('asd1234', 'SoccerFan', 1),
-- ('qwe1234', 'GoalKeeper', 10);

-- 직관 기록 테이블
CREATE TABLE user_records (
    records_id INT AUTO_INCREMENT PRIMARY KEY,  -- 고유 식별자
    user_id VARCHAR(255) NOT NULL,                   -- 사용자 ID (기기 ID, uuid)
    match_id INT NOT NULL,                      -- 경기 식별자
    date DATE NOT NULL,                     -- 기록 날짜
    image VARCHAR(255) NOT NULL,        -- 이미지 경로
    stadium_id INT NOT NULL,          -- 경기장 ID
    user_note TEXT NOT NULL,             -- 사용자가 기록한 메모
    ticket_image VARCHAR(255) DEFAULT NULL,        -- 티켓 이미지 경로 *0318 추가
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id),
    FOREIGN KEY (stadium_id) REFERENCES kbo_stadiums(stadium_id)
);

-- INSERT INTO user_records (user_id, date, image, stadium_id, user_note)
-- VALUES
-- ('asd1234', STR_TO_DATE('2024.03.23', '%Y.%m.%d'), 'path/to/image1.jpg', 1, 'Visited the stadium for the first time'),
-- ('qwe1234', STR_TO_DATE('2024.03.23', '%Y.%m.%d'), 'path/to/image2.jpg', 2, 'Cheered for my favorite team');

-- 커뮤니티 테이블
CREATE TABLE community_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,  -- 고유 식별자
    user_id VARCHAR(255) NOT NULL,                    -- 사용자 ID
    stadium_id INT NOT NULL,          -- 경기장 ID
    date DATE NOT NULL,                     -- 작성 날짜
    user_post TEXT NOT NULL,             -- 사용자가 작성한 게시글
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id),
    FOREIGN KEY (stadium_id) REFERENCES kbo_stadiums(stadium_id)
);

-- INSERT INTO community_logs (user_id, stadium_id, date, user_post)
-- VALUES
-- ('asd1234', 1, STR_TO_DATE('2024.03.23', '%Y.%m.%d'), 'Amazing match! Loved the atmosphere.'),
-- ('qwe1234', 2, STR_TO_DATE('2024.03.23', '%Y.%m.%d'), 'Great game, but the food was too expensive.');

-- 커뮤니티 공지 테이블
CREATE TABLE community_notices (
    notice_id INT AUTO_INCREMENT PRIMARY KEY,  -- 고유 식별자
    notice TEXT NOT NULL,             -- 사용자가 작성한 게시글
    notice_type VARCHAR(50) NOT NULL,  -- 공지사항 타입 (예: 📢normal, 🍽️food, ⚾️moment )
    stadium_id INT NOT NULL,          -- 경기장 ID
    FOREIGN KEY (stadium_id) REFERENCES kbo_stadiums(stadium_id)
);
 

-- 직관 예약 테이블
CREATE TABLE match_booking (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,  -- 고유 식별자
    user_id VARCHAR(255) NOT NULL,                    -- 사용자 ID
    date DATE NOT NULL,                     -- 예약 날짜
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
);

-- 로컬스토리지 데이터 임시 테이블
-- 로컬스토리지 구조 확인 후 서버 마이그레이션 필요
CREATE TABLE temp_local_storage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    storage_value TEXT NOT NULL
);