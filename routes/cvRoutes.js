const express = require("express");
const router = express.Router();
const { handleScreeningCV } = require("../controllers/cvController");

router.get("/upload", handleScreeningCV);

module.exports = router;
