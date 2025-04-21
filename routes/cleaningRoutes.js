const express = require("express");
const router = express.Router();
const { handleCleaningCV } = require("../controllers/cleaningController");

router.post("/cleaning", handleCleaningCV);

module.exports = router;
