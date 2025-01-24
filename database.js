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
// TODO 날짜 등 다른 정보로 get 할 수 있도록 쿼리 작성

// 모든 경기
const getMatches = async () => {
  const [matches] = await pool.query("SELECT * FROM matches");
  return matches;
};
// 날짜별 필터링
const getMatchByDate = async (date) => {
  const [[match]] = await pool.query(
    `
    SELECT * 
    FROM matches
    WHERE date = ?
  `,
    [date]
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
// 모든 직관기록
const getUserRecords = async () => {
  const [records] = await pool.query("SELECT * FROM user_records");
  return records;
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

// 경기 데이터 생서
const createMatch = async (params) => {
  const { date, time, home, away, stadium, homeScore, awayScore, memo } =
    params;
  const result = await pool.query(
    `
    INSERT INTO matches (date, time, home, away, stadium, home_score, away_score, memo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [date, time, home, away, stadium, homeScore, awayScore, memo]
  );
  return result;
};

// 특정 경기 수정
const updateMatch = async (params) => {
  const { date, time, homeTeam, awayTeam, homeScore, awayScore } = params;
  const [[match]] = await pool.query(
    `
      UPDATE matches 
      SET home_score = ?, away_score = ?
      WHERE date = ? AND time = ? AND home_team = ? AND away_team = ?
    `,
    [homeScore, awayScore, date, time, homeTeam, awayTeam]
  );
  return match;
};

export {
  // GET
  getMatches,
  getTeams,
  getStadiums,
  getUsers,
  getUserRecords,
  getCommunityLogs,
  getTeamStadiumRelation,
  getMatchByDate,
  getCommunityLogByStadium,
  // POST
  createMatch,
  // UPDATE
  updateMatch,
};
