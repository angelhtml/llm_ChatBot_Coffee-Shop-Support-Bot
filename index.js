import express from "express";
import { askQuestion } from "./query.js";
const app = express();
app.use(express.json());

app.post("/ask", async (req, res) => {
  const { question } = req.body;
  const answer = await askQuestion(question);  // your existing function
  res.json({ answer });
});

app.listen(3001, () => console.log("Support bot running on port 3001"));