require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
const pool = require("./db");


app.use(cors());
app.use(express.json());

const upload = multer({
  dest: "uploads/"
});


app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW()"
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json(error);
  }
});
app.listen(process.env.PORT, () => {
  console.log(
    `Server running on port ${process.env.PORT}`
  );
});