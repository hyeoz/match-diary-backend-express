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

const getMatches = async () => {
  const [matches] = await pool.query("SELECT * FROM matches");
  return matches;
};
// 쿼리파라미터 예시
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
// TODO 날짜 등 다른 정보로 get 할 수 있도록 쿼리 작성

const getUsers = async () => {
  const [users] = await pool.query("SELECT * FROM user_profiles");
  return users;
};
// post 예시
const createUser = async (user_id, nickname, team_id) => {
  const result = await pool.query(
    `
    INSERT INTO user_profiles (user_id, nickname, team_id)
    VALUES (?, ?, ?)  
  `,
    [user_id, nickname, team_id]
  );
  return result;
};

export { getMatches, getMatchById, getUsers, createUser };
