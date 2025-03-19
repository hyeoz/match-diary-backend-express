import dayjs from "dayjs";
import dotenv from "dotenv";
import mysql from "mysql2";

dotenv.config(); // 환경변수 활성화

// connection 생성
const pool = mysql
  .createPool({
    host: process.env.HOST,
    user: process.env.LOCAL_DB_USER,
    password: process.env.LOCAL_DB_PASSWORD,
    database: process.env.LOCAL_DB_NAME,
  })
  .promise();

/* SECTION GET */

// 모든 경기
const getMatches = async () => {
  const [matches] = await pool.query("SELECT * FROM matches");
  return matches;
};
// 날짜별 필터링
const getMatchByDate = async (date) => {
  const [match] = await pool.query(
    `
    SELECT * 
    FROM matches
    WHERE date = ?
  `,
    [date]
  );
  return match;
};
// ID 별 필터링
const getMatchById = async (id) => {
  const [[match]] = await pool.query(
    `
    SELECT * 
    FROM matches
    WHERE id = ?
  `,
    [id]
  );
  return match;
};
// 모든 팀
const getTeams = async () => {
  const [teams] = await pool.query("SELECT * FROM kbo_teams");
  return teams;
};
// 모든 경기장
const getStadiums = async () => {
  const [stadiums] = await pool.query("SELECT * FROM kbo_stadiums");
  return stadiums;
};
// 팀 - 경기장 관계
const getTeamStadiumRelation = async () => {
  const [rel] = await pool.query("SELECT * FROM team_stadiums");
  return rel;
};
// 모든 유저
const getUsers = async () => {
  const [users] = await pool.query("SELECT * FROM user_profiles");
  return users;
};
// 단일 유저
const getUser = async (userId) => {
  const [user] = await pool.query(
    "SELECT * FROM user_profiles WHERE user_id = ?",
    [userId]
  );
  return user;
};
// 모든 직관기록
const getUserRecords = async () => {
  const [records] = await pool.query("SELECT * FROM user_records");
  return records;
};
// 유저의 모든 직관기록 조회
const getUserRecordsByUser = async (userId) => {
  const [records] = await pool.query(
    "SELECT * FROM user_records WHERE user_id = ?",
    [userId]
  );
  return records;
};
// id 에 따른 단일 직관기록 (유저 확인)
const getUserRecordById = async (recordId) => {
  const [record] = await pool.query(
    "SELECT * FROM user_records WHERE records_id = ?",
    [recordId]
  );
  return record;
};
// 날짜에 따른 단일 직관기록 (유저확인)
const getUserRecordByDate = async (date, userId) => {
  const parsedDate = dayjs(date).format("YYYY-MM-DD");

  const [record] = await pool.query(
    "SELECT * FROM user_records WHERE date = ? AND user_id = ?",
    [parsedDate, userId]
  );
  return record;
};

// 모든 커뮤니티 글
const getCommunityLogs = async () => {
  const [logs] = await pool.query("SELECT * FROM community_logs");
  return logs;
};
// 경기장별 커뮤니티 글
const getCommunityLogByStadium = async (stadiumId) => {
  const [logs] = await pool.query(
    `
    SELECT * 
    FROM community_logs
    WHERE stadium_id = ?
    `,
    [stadiumId]
  );
  return logs;
};

const getAllBookings = async (userId) => {
  const [bookings] = await pool.query(
    "SELECT * FROM match_booking WHERE user_id = ?",
    [userId]
  );
  return bookings;
};

/* SECTION INSERT */

// 경기 데이터 생성
const createMatch = async (params) => {
  const { date, time, home, away, stadium, homeScore, awayScore, memo } =
    params;

  const isDuplicate = await checkDuplicateMatch(params);

  const parsedDate = dayjs(date).format("YYYY-MM-DD");
  const parsedTime = dayjs(date + time).format("HH:mm:ss"); // 시간만으로는 dayjs 가 parsing 할 수 없음

  // 이미 존재하는 경기라면 수정요청 보내기
  if (isDuplicate) {
    const result = await updateMatch(params);
    return result;
  }

  const result = await pool.query(
    `
    INSERT INTO matches (date, time, home, away, stadium, home_score, away_score, memo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      parsedDate,
      parsedTime,
      home,
      away,
      stadium,
      homeScore,
      awayScore,
      memo ?? null,
    ]
  );
  return result;
};

// 커뮤니티 데이터 추가
const createLog = async (params) => {
  const { userId, stadiumId, date, userPost } = params;

  const parsedDate = dayjs(date).format("YYYY-MM-DD");
  const result = await pool.query(
    `
      INSERT INTO community_logs (user_id, stadium_id, date, user_post)
      VALUES (?, ?, ?, ?)
    `,
    [userId, stadiumId, parsedDate, userPost]
  );
  return result;
};

// 유저 생성
const createUser = async (params) => {
  const { userId, nickname, teamId } = params;
  const result = await pool.query(
    `
      INSERT INTO user_profiles (user_id, nickname, team_id)
      VALUES (?, ?, ?)
    `,
    [userId, nickname, teamId]
  );
  return result;
};

// 직관 기록 추가
const createRecord = async (params) => {
  const { userId, matchId, stadiumId, date, image, userNote, ticketImage } =
    params;

  const parsedDate = dayjs(date).format("YYYY-MM-DD");

  // 기록 수정 요청은 분리
  const result = await pool.query(
    `
    INSERT INTO user_records (user_id, match_id, date, image, user_note, stadium_id, ticket_image)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    [userId, matchId, parsedDate, image, userNote, stadiumId, ticketImage]
  );
  return result;
};

const createBooking = async (params) => {
  const { userId, date } = params;

  const parsedDate = dayjs(date).format("YYYY-MM-DD");

  const result = await pool.query(
    `
    INSERT INTO match_booking (user_id, date)
    VALUES (?, ?)
  `,
    [userId, parsedDate]
  );
  return result;
};

/* SECTION UPDATE */
// 특정 경기 수정
const updateMatch = async (params) => {
  const { date, time, home, away, homeScore, awayScore } = params;

  const parsedDate = dayjs(date).format("YYYY-MM-DD");
  const parsedTime = dayjs(date + time).format("HH:mm:ss");

  const result = await pool.query(
    `
      UPDATE matches 
      SET home_score = ?, away_score = ?
      WHERE date = ? AND time = ? AND home = ? AND away = ?
    `,
    [homeScore, awayScore, parsedDate, parsedTime, home, away]
  );
  return result;
};

// 유저 정보 수정
const updateUser = async (params) => {
  const { nickname, teamId, userId } = params;
  const result = await pool.query(
    `
      UPDATE user_profiles 
      SET nickname = ?, team_id = ?
      WHERE user_id = ?
    `,
    [nickname, teamId, userId]
  );
  return result;
};

// 직관 기록 수정
const updateRecord = async (params) => {
  const { image, ticketImage, userNote, recordsId } = params;

  const result = await pool.query(
    `
      UPDATE user_records 
      SET image = ?, ticket_image = ?, user_note = ?
      WHERE records_id = ?
    `,
    [image, ticketImage, userNote, recordsId]
  );
  return result;
};

/* SECTION DELETE */
// 커뮤니티 글 삭제
const deleteLog = async (id) => {
  const result = await pool.query(
    `
      DELETE FROM community_logs
      WHERE log_id = ?
    `,
    [id]
  );
  return result;
};

// 직관 기록 삭제
const deleteRecord = async (id) => {
  const result = await pool.query(
    `
      DELETE FROM user_records
      WHERE records_id = ?
    `,
    [id]
  );
  return result;
};

// 직관 예약 삭제
const deleteBooking = async (id) => {
  const result = await pool.query(
    `
      DELETE FROM match_booking
      WHERE booking_id = ?
    `,
    [id]
  );
  return result;
};

/* SECTION UTILS */
const checkDuplicateMatch = async (params) => {
  const { date, time, home, away } = params;

  const parsedDate = dayjs(`${date}T${time}`).format("YYYY-MM-DD");
  const parsedTime = dayjs(`${date}T${time}`).format("HH:mm:ss");

  const [rows] = await pool.query(
    `
    SELECT * FROM matches
    WHERE date = ? AND time = ? AND home = ? AND away = ?
    `,
    [parsedDate, parsedTime, home, away]
  );
  return rows.length > 0;
};

export {
  // GET
  getMatches,
  getMatchById,
  getTeams,
  getStadiums,
  getUsers,
  getUser,
  getUserRecords,
  getUserRecordsByUser,
  getUserRecordById,
  getUserRecordByDate,
  getCommunityLogs,
  getTeamStadiumRelation,
  getMatchByDate,
  getCommunityLogByStadium,
  getAllBookings,
  // POST
  createMatch,
  createLog,
  createUser,
  createRecord,
  createBooking,
  // UPDATE
  updateMatch,
  updateUser,
  updateRecord,
  // DELETE
  deleteLog,
  deleteRecord,
  deleteBooking,
};
