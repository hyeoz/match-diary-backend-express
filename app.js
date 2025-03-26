import express from "express";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import multer from "multer";
import dotenv from "dotenv";
import sharp from "sharp";
import path from "path";
import morgan from "morgan";
import { createStream } from "rotating-file-stream";
import fs from "fs";

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
  getUserRecordsByUser,
  getUserRecordByDate,
  getMatchById,
  getAllBookings,
  deleteBooking,
  createBooking,
  createLocalStorage,
} from "./database.js";

dotenv.config();

const app = express();

// 로그 디렉토리 생성
const logDirectory = path.join(process.cwd(), "logs");
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);

// 로그 스트림 생성
const accessLogStream = createStream("access.log", {
  interval: "1d", // 매일 새로운 파일 생성
  path: logDirectory,
  size: "10M", // 파일 크기가 10MB를 넘으면 새로운 파일 생성
});

// 로깅 미들웨어 설정
app.use(morgan("combined", { stream: accessLogStream }));

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
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 이미지 리사이징 및 S3 업로드 함수
async function uploadToS3(file, s3path = "uploads") {
  try {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".gif"].includes(fileExtension)) {
      throw new Error("Only image files are allowed.");
    }

    // 이미지 리사이징 (세로 길이가 1800px를 넘지 않도록)
    const image = sharp(file.buffer);
    const metadata = await image.metadata();

    let resizedImage = image;
    if (metadata.height > 1800) {
      resizedImage = image.resize(null, 1800); // 세로 길이를 1800px로 리사이징
    }

    // 리사이징된 이미지를 버퍼로 변환
    const resizedBuffer = await resizedImage.toBuffer();

    // S3 업로드 설정
    const fileName = `${s3path}/${Date.now()}_${file.originalname}`;

    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: resizedBuffer,
      ContentType: file.mimetype,
    };

    // S3에 파일 업로드
    const command = new PutObjectCommand(params);
    await s3.send(command);

    // S3 파일 URL 생성
    const fileUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    return fileUrl;
  } catch (error) {
    console.error("Failed to upload to S3:", error);
    throw new Error("Failed to upload image to S3.");
  }
}

// 기존 파일 삭제
const deleteOldFile = async (oldFileKey) => {
  if (!oldFileKey || !s3) return;
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: oldFileKey,
    });
    await s3.send(command);
  } catch (error) {
    console.error("Error deleting old image:", error.message);
  }
};

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

// 필터별 경기
app.get("/match/filter", async (req, res) => {
  try {
    const date = req.query.date; // 쿼리 파라미터에서 'date' 가져오기
    // TODO team 필터가 들어갈 수도 있음

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

// ID 별 경기 찾기
app.get("/match/:id", async (req, res) => {
  try {
    const id = req.params.id; // path 파라미터에서 'id' 가져오기

    if (!id) {
      return res
        .status(400)
        .send({ message: "ID query parameter is required" });
    }

    const match = await getMatchById(id);

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

// 모든 직관기록 (관리자용)
app.get("/user-records", async (req, res) => {
  try {
    const records = await getUserRecords();
    res.send(records);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch user records" });
  }
});

// 유저의 모든 직관기록
app.post("/user-records", async (req, res) => {
  try {
    const { userId } = req.body;
    const records = await getUserRecordsByUser(userId);
    res.send(records);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch user records" });
  }
});

// 단일 기록 조회 by ID
app.post("/user-record/id", async (req, res) => {
  try {
    const { recordId, userId } = req.body;
    const userRecords = await getUserRecordsByUser(userId);

    if (
      !!userRecords.length &&
      !userRecords.filter((record) => record.records_id === recordId).length
    ) {
      // 유저의 기록은 존재하지만 그 기록에 호출보낸 기록 id 가 없는 경우 (본인이 작성한 글이 아님)
      return res.status(403).send({ message: "Forbidden access" });
    }

    const records = await getUserRecordById(recordId);
    res.send(records);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch user records" });
  }
});

// 단일 기록 조회 by DATE
app.post("/user-record/date", async (req, res) => {
  try {
    const { date, userId } = req.body;

    const records = await getUserRecordByDate(date, userId);
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

// 유저의 직관 예약 기록 조회
app.post("/bookings", async (req, res) => {
  try {
    const { userId } = req.body;
    const bookings = await getAllBookings(userId);
    res.send(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch bookings" });
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
app.post(
  "/create-record",
  upload.fields([
    { name: "file", maxCount: 1 }, // 기록 이미지
    { name: "ticketFile", maxCount: 1 }, // 티켓 이미지
  ]),
  async (req, res) => {
    try {
      const body = req.body;

      if (!body) {
        return res.status(400).send({ message: "Payload is required" });
      }

      // 필요한 모든 필드가 제공되었는지 확인
      const requiredFields = [
        "userId",
        // "matchId", // 경기 없는 날 작성을 위해
        "stadiumId",
        "date",
        "userNote",
      ];
      for (const field of requiredFields) {
        if (!(field in body)) {
          return res.status(400).send({ message: `${field} is required` });
        }
      }

      // 이미지가 포함되었는지 확인
      if (!req.files.file || !req.files.file[0]) {
        return res.status(400).send({ message: "Image file is required" });
      }

      // 내부적으로 /upload API 호출해서 파일 S3에 업로드
      const imageUrl = await uploadToS3(req.files.file[0]); // S3에서 URL 반환

      // 티켓 이미지 있으면 업로드
      let ticketImageUrl = null;
      if (req.files.ticketFile && req.files.ticketFile[0]) {
        ticketImageUrl = await uploadToS3(req.files.ticketFile[0], "ticket");
      }

      const { userId, matchId, stadiumId, date, userNote } = body;

      await createRecord({
        userId,
        matchId: matchId === "null" ? null : matchId,
        stadiumId,
        date,
        image: imageUrl,
        userNote,
        ticketImage: ticketImageUrl,
      });

      res.send({ status: 201, message: "Added" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .send({ message: "An error occurred while adding a user record" });
    }
  }
);

// 직관 예약 추가
app.post("/create-booking", async (req, res) => {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).send({ message: "Payload is required" });
    }

    // 필요한 모든 필드가 제공되었는지 확인
    const requiredFields = ["userId", "date"];
    for (const field of requiredFields) {
      if (!(field in body)) {
        return res.status(400).send({ message: `${field} is required` });
      }
    }

    await createBooking(body);
    res.send({ status: 201, message: "Added" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ message: "An error occurred while adding a user record" });
  }
});

// NOTE 임시 스토리지 데이터 업로드
app.post("/create-local-storage", async (req, res) => {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).send({ message: "Payload is required" });
    }

    // 필요한 모든 필드가 제공되었는지 확인
    const requiredFields = ["userId", "storageKey", "storageValue"];
    for (const field of requiredFields) {
      if (!(field in body)) {
        return res.status(400).send({ message: `${field} is required` });
      }
    }

    await createLocalStorage(body);
    res.send({ status: 201, message: "Added" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ message: "An error occurred while adding a user record" });
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
// app.patch("/record/update", upload.single("file"), async (req, res) => {
app.patch(
  "/record/update",
  upload.fields([
    { name: "file", maxCount: 1 }, // 기록 이미지
    { name: "ticketFile", maxCount: 1 }, // 티켓 이미지
  ]),
  async (req, res) => {
    try {
      const body = req.body;

      if (!body) {
        return res.status(400).send({ message: "Payload is required" });
      }

      // 필요한 모든 필드가 제공되었는지 확인
      const requiredFields = ["recordsId", "userNote"];
      for (const field of requiredFields) {
        if (!(field in body)) {
          return res.status(400).send({ message: `${field} is required` });
        }
      }
      // 이미지가 포함되었는지 확인
      // TODO 수정인 경우 파일이 아닌 링크로 올 수 있음
      // 이미지가 포함되었는지 확인 (파일이거나 링크일 수 있음)
      let imageUrl = null;

      if (body.imageUrl) {
        // 이미지 URL이 포함되었으면 이를 사용
        imageUrl = body.imageUrl;
      } else if (req.files.file[0]) {
        // 파일이 포함되었으면 S3에 업로드 후 URL 반환
        imageUrl = await uploadToS3(req.files.file[0]); // S3에서 URL 반환
      }

      if (!imageUrl) {
        return res
          .status(400)
          .send({ message: "Image (file or URL) is required" });
      }

      let ticketUrl = null;

      if (body.ticketUrl) {
        // 이미지 URL이 포함되었으면 이를 사용
        ticketUrl = body.ticketUrl;
      } else if (req.files.ticketFile?.[0]) {
        // 파일이 포함되었으면 S3에 업로드 후 URL 반환
        ticketUrl = await uploadToS3(req.files.ticketFile[0]); // S3에서 URL 반환
      }

      const { userNote, recordsId } = body;

      // 기존 기록 확인
      const oldRecord = await getUserRecordById(recordsId);

      if (!oldRecord) {
        return res
          .status(404)
          .send({ message: "Match not found for the given information" });
      }

      if (oldRecord[0]?.image) {
        const imageKey = oldRecord[0].image;
        await deleteOldFile(imageKey); // 기존 이미지를 S3에서 삭제
      }

      // 유저가 다른 경우
      if (body.userId !== oldRecord[0].user_id) {
        return res.status(403).send({ message: "Forbidden" });
      }

      const updatedRecord = await updateRecord({
        userNote,
        recordsId,
        image: imageUrl,
        ticketImage: ticketUrl,
      });

      if (!updatedRecord) {
        return res
          .status(404)
          .send({ message: "Match not found for the given information" });
      }

      res.send({ status: 200, message: "Updated", data: updatedRecord });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .send({ message: "An error occurred while updating the match" });
    }
  }
);

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
app.delete("/user-records/:recordsId", async (req, res) => {
  try {
    const recordsId = req.params.recordsId; // 쿼리 파라미터에서 'recordsId' 가져오기

    if (!recordsId) {
      return res.status(400).send({ message: "Record ID is required" });
    }

    // 기존 기록 확인
    const oldRecord = await getUserRecordById(recordsId);

    if (!oldRecord) {
      return res
        .status(404)
        .send({ message: "Match not found for the given information" });
    }

    if (oldRecord[0]?.image) {
      const imageKey = oldRecord[0].image;
      await deleteOldFile(imageKey); // S3에서 기존 이미지 삭제
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

// 직관 예약 삭제
app.delete("/bookings/:bookingId", async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    await deleteBooking(bookingId);
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
