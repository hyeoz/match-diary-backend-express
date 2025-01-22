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

// post 예시
// const createUser = async (user_id, nickname, team_id) => {
//   const result = await pool.query(
//     `
//     INSERT INTO user_profiles (user_id, nickname, team_id)
//     VALUES (?, ?, ?)
//   `,
//     [user_id, nickname, team_id]
//   );
//   return result;
// };

export {
  getMatches,
  getTeams,
  getStadiums,
  getUsers,
  getUserRecords,
  getCommunityLogs,
  getTeamStadiumRelation,
  getMatchByDate,
  getCommunityLogByStadium,
};
