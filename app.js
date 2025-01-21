import express from "express";
import { createUser, getMatchById, getMatches } from "./database.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API 작성
app.get("/matches", async (req, res) => {
  const matches = await getMatches();
  res.send(matches);
});

app.get("/match/:id", async (req, res) => {
  const id = req.params.id;
  const match = await getMatchById(id);
  res.send(match);
});

app.post("/user-profiles", async (req, res) => {
  const { userId, nickname, teamId } = req.body;
  const result = await createUser(userId, nickname, teamId);
  res.status(201).send(result);
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wroeng...");
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
