import express from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
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
  getUser,
  createUser,
  updateUser,
  deleteRecord,
  createRecord,
  getUserRecordById,
  updateRecord,
} from "./database.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// AWS 설정
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: `https://s3.${process.env.AWS_REGION}.amazonaws.com`,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer 설정 (파일 업로드 미들웨어)
const upload = multer({ dest: "uploads/" });

// 이미지 리사이징 및 S3 업로드 함수
async function uploadToS3(file) {
  try {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".gif"].includes(fileExtension)) {
      throw new Error("Only image files are allowed.");
    }

    // 이미지 리사이징 (세로 길이가 1800px를 넘지 않도록)
    const image = sharp(file.path);
    const metadata = await image.metadata();

    let resizedImage = image;
    if (metadata.height > 1800) {
      resizedImage = image.resize(null, 1800); // 세로 길이를 1800px로 리사이징
    }

    // 리사이징된 이미지 임시 파일 저장
    const resizedFilePath = `uploads/resized-${Date.now()}-${
      file.originalname
    }`;
    await resizedImage.toFile(resizedFilePath);

    // S3 업로드 설정
    const fileContent = fs.readFileSync(resizedFilePath);
    const fileName = `uploads/${Date.now()}_${file.originalname}`;

    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: fileContent,
      ContentType: file.mimetype,
    };

    // S3에 파일 업로드
    const command = new PutObjectCommand(params);
    await s3.send(command);

    // S3 파일 URL 생성
    const fileUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    // 임시 파일 삭제
    fs.unlinkSync(file.path);
    fs.unlinkSync(resizedFilePath);

    return fileUrl;
  } catch (error) {
    console.error("Failed to upload to S3:", error);
    throw new Error("Failed to upload image to S3.");
  }
}

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

    res.send({ status: 201, message: "Added" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "An error occurred while adding a match" });
  }
});

// 커뮤니티 글 추가
app.post("/community-log", async (req, res) => {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).send({ message: "Payload is required" });
    }

    // 필요한 모든 필드가 제공되었는지 확인
    const requiredFields = ["userId", "stadiumId", "date", "userPost"];
    for (const field of requiredFields) {
      if (!(field in body)) {
        return res.status(400).send({ message: `${field} is required` });
      }
    }

    await createLog(body);
    res.send({ status: 201, message: "Added" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "An error occurred while adding a log" });
  }
});

// 단일 유저 조회 - body 를 사용해야해서 post 로
app.post("/user", async (req, res) => {
  try {
    const { userId } = req.body; // body 에서 'userId' 가져오기

    if (!userId) {
      return res.status(400).send({ message: "User information is required" });
    }

    const user = await getUser(userId);

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send(user);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ message: "An error occurred while fetching the user" });
  }
});

// 유저 추가
app.post("/create-user", async (req, res) => {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).send({ message: "Payload is required" });
    }

    // 필요한 모든 필드가 제공되었는지 확인
    const requiredFields = ["userId", "nickname", "teamId"];
    for (const field of requiredFields) {
      if (!(field in body)) {
        return res.status(400).send({ message: `${field} is required` });
      }
    }

    await createUser(body);
    res.send({ status: 201, message: "Added" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "An error occurred while adding a user" });
  }
});

// 기록 추가
app.post("/user-records", upload.single("image"), async (req, res) => {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).send({ message: "Payload is required" });
    }

    // 필요한 모든 필드가 제공되었는지 확인
    const requiredFields = ["userId", "stadiumId", "date", "userNote"];
    for (const field of requiredFields) {
      if (!(field in body)) {
        return res.status(400).send({ message: `${field} is required` });
      }
    }

    // 이미지가 포함되었는지 확인
    if (!req.file) {
      return res.status(400).send({ message: "Image file is required" });
    }

    // 내부적으로 /upload API 호출해서 파일 S3에 업로드
    const imageUrl = await uploadToS3(req.file); // S3에서 URL 반환

    const { userId, stadiumId, date, userNote } = body;
    await createRecord({
      userId,
      stadiumId,
      date,
      image: imageUrl,
      userNote,
    });
    res.send({ status: 201, message: "Added" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "An error occurred while adding a user" });
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
      "home",
      "away",
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

    res.send({ status: 200, message: "Updated", data: updatedMatch });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ message: "An error occurred while updating the match" });
  }
});

// 유저 정보 수정
app.patch("/user/update", async (req, res) => {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).send({ message: "Payload is required" });
    }

    // 필요한 모든 필드가 제공되었는지 확인
    const requiredFields = ["userId", "nickname", "teamId"];
    for (const field of requiredFields) {
      if (!(field in body)) {
        return res.status(400).send({ message: `${field} is required` });
      }
    }

    const updatedUser = await updateUser(body);

    if (!updatedUser) {
      return res
        .status(404)
        .send({ message: "Match not found for the given information" });
    }

    res.send({ status: 200, message: "Updated", data: updatedUser });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ message: "An error occurred while updating the match" });
  }
});

// 기록 수정
app.patch("/record/update", async (req, res) => {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).send({ message: "Payload is required" });
    }

    // 필요한 모든 필드가 제공되었는지 확인
    const requiredFields = ["userId", "image", "userNote", "recordsId"];
    for (const field of requiredFields) {
      if (!(field in body)) {
        return res.status(400).send({ message: `${field} is required` });
      }
    }

    // 유저가 다른 경우
    const record = await getUserRecordById(body.recordsId);
    if (body.userId !== record[0].user_id) {
      return res.status(403).send({ message: "Forbidden" });
    }

    const updateRecord = await updateRecord(body);

    if (!updateRecord) {
      return res
        .status(404)
        .send({ message: "Match not found for the given information" });
    }

    res.send({ status: 200, message: "Updated", data: updatedUser });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ message: "An error occurred while updating the match" });
  }
});

// ANCHOR DELETE
// 커뮤니티 글 삭제
app.delete("/community-log/:logId", async (req, res) => {
  try {
    const logId = req.params.logId; // 쿼리 파라미터에서 'logId' 가져오기

    if (!logId) {
      return res.status(400).send({ message: "Log ID is required" });
    }

    await deleteLog(logId);
    res.send({ status: 200, message: "Deleted" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ message: "An error occurred while deleting the log" });
  }
});

// 기록 삭제
app.delete("/user_records/:recordsId", async (req, res) => {
  try {
    const recordsId = req.params.recordsId; // 쿼리 파라미터에서 'recordsId' 가져오기

    if (!recordsId) {
      return res.status(400).send({ message: "Log ID is required" });
    }

    await deleteRecord(recordsId);
    res.send({ status: 200, message: "Deleted" });
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
app.listen(80, () => {
  console.log("Server is running on port 80");
});
