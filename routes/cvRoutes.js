const express = require("express");
const router = express.Router();
const multer = require("multer");
const { handleUploadCVs } = require("../controllers/cvController");

const storage = multer.memoryStorage(); // tidak simpan di disk
const upload = multer({ storage });

router.post("/upload", upload.array("cvs", 10), handleUploadCVs);

module.exports = router;
