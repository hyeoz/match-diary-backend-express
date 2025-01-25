import express from "express";
import {
  getMatches,
  getTeams,
  getStadiums,
  getUsers,
  getUserRecords,
  getCommunityLogs,
  getTeamStadiumRelation,
  getMatchByDate,
  getCommunityLogByStadium,
  createMatch,
  updateMatch,
  deleteLog,
  createLog,
} from "./database.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* SECTION API 작성 */

// ANCHOR GET
// 모든 경기
app.get("/matches", async (req, res) => {
  try {
    const matches = await getMatches();
    res.send(matches);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch matches" });
  }
});

// 날짜별 경기
app.get("/match", async (req, res) => {
  try {
    const date = req.query.date; // 쿼리 파라미터에서 'date' 가져오기

    if (!date) {
      return res
        .status(400)
        .send({ message: "Date query parameter is required" });
    }

    const match = await getMatchByDate(date);

    if (!match) {
      return res
        .status(404)
        .send({ message: "Match not found for the given date" });
    }

    res.send(match);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ message: "An error occurred while fetching the match" });
  }
});

// 모든 팀
app.get("/teams", async (req, res) => {
  try {
    const teams = await getTeams();
    res.send(teams);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch teams" });
  }
});

// 모든 경기장
app.get("/stadiums", async (req, res) => {
  try {
    const stadiums = await getStadiums();
    res.send(stadiums);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch stadiums" });
  }
});

// 팀 - 경기장 관계
app.get("/team-stadiums", async (req, res) => {
  try {
    const relations = await getTeamStadiumRelation();
    res.send(relations);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch team-stadium relations" });
  }
});

// 모든 유저
app.get("/users", async (req, res) => {
  try {
    const users = await getUsers();
    res.send(users);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch users" });
  }
});

// 모든 직관기록
app.get("/user-records", async (req, res) => {
  try {
    const records = await getUserRecords();
    res.send(records);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch user records" });
  }
});

// 모든 커뮤니티 글
app.get("/community-logs", async (req, res) => {
  try {
    const logs = await getCommunityLogs();
    res.send(logs);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch community logs" });
  }
});

// 경기장 별 커뮤니티 글
app.get("/community-log", async (req, res) => {
  try {
    const stadiumId = req.query.stadiumId; // 쿼리 파라미터에서 'stadiumId' 가져오기

    if (!stadiumId) {
      return res
        .status(400)
        .send({ message: "Stadium information is required" });
    }

    const match = await getCommunityLogByStadium(stadiumId);

    if (!match) {
      return res
        .status(404)
        .send({ message: "Log not found for the given stadium information" });
    }

    res.send(match);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ message: "An error occurred while fetching the logs" });
  }
});

// ANCHOR POST
// 경기 추가
app.post("/match", async (req, res) => {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).send({ message: "Payload is required" });
    }

    // 필요한 모든 필드가 제공되었는지 확인
    const requiredFields = [
      "date",
      "time",
      "home",
      "away",
      "stadium",
      "homeScore",
      "awayScore",
    ];
    for (const field of requiredFields) {
      if (!(field in body)) {
        return res.status(400).send({ message: `${field} is required` });
      }
    }

    await createMatch(body);
    res.send({ status: 201, data: "Added" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "An error occurred while adding a match" });
  }
});

// 커뮤니티 글 추가
app.post("community-log", async (req, res) => {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).send({ message: "Payload is required" });
    }

    // 필요한 모든 필드가 제공되었는지 확인
    // 필요한 모든 필드가 제공되었는지 확인
    const requiredFields = ["userId", "stadiumId", "date", "userPost"];
    for (const field of requiredFields) {
      if (!(field in body)) {
        return res.status(400).send({ message: `${field} is required` });
      }
    }

    await createLog(body);
    res.send({ status: 201, data: "Added" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "An error occurred while adding a log" });
  }
});

// ANCHOR PATCH
// 경기 업데이트
app.patch("/match/update", async (req, res) => {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).send({ message: "Payload is required" });
    }

    // 필요한 모든 필드가 제공되었는지 확인
    const requiredFields = [
      "date",
      "time",
      "homeTeam",
      "awayTeam",
      "homeScore",
      "awayScore",
    ];
    for (const field of requiredFields) {
      if (!(field in body)) {
        return res.status(400).send({ message: `${field} is required` });
      }
    }

    const updatedMatch = await updateMatch(body);

    if (!updatedMatch) {
      return res
        .status(404)
        .send({ message: "Match not found for the given information" });
    }

    res.send({ status: 200, data: "Updated", match: updatedMatch });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ message: "An error occurred while updating the match" });
  }
});

// ANCHOR DELETE
// 커뮤니티 글 삭제
app.delete("/community-log", async (req, res) => {
  try {
    const logId = req.query.logId; // 쿼리 파라미터에서 'logId' 가져오기

    if (!logId) {
      return res.status(400).send({ message: "Log ID is required" });
    }

    await deleteLog(logId);
    res.send({ status: 200, data: "Deleted" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ message: "An error occurred while deleting the log" });
  }
});

// ANCHOR ERROR
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wroeng...");
});

// ANCHOR SERVER
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
