const express = require("express");
const router = express.Router();
const { handleScreeningCV } = require("../controllers/cvController");

router.post("/process", handleScreeningCV);

module.exports = router;
