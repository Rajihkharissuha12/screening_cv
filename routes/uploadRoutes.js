const express = require("express");
const router = express.Router();
const multer = require("multer");
const { handleUploadCV } = require("../controllers/uploadController");

const storage = multer.memoryStorage(); // tidak simpan di disk
const upload = multer({ storage });

router.post("/upload", upload.array("cvs", 100), handleUploadCV);

module.exports = router;
