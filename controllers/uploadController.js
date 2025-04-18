const cloudinary = require("cloudinary").v2;
const { PrismaClient } = require("@prisma/client");
const streanUpload = require("../utils/streanUpload");
const { GoogleGenAI } = require("@google/genai");
const moment = require("moment"); // Add this line to import moment

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.handleUploadCV = async (req, res) => {
  const files = req.files;
  const results = [];

  if (req.files && req.files.length > 15) {
    return res
      .status(400)
      .json({ error: "Maximum 25 files allowed per upload." });
  }

  for (const file of files) {
    try {
      const uploadResult = await streanUpload(file.buffer, file.originalname);
      const uploadCV = await prisma.screeningcv.create({
        data: {
          tanggal: moment().format("DD-MM-YYYY"), // Format date as DD-MM-YYYY string
          nama_file: uploadResult.public_id,
          url_cv: uploadResult.secure_url,
          public_id: uploadResult.asset_id,
          status: "uploaded",
        },
      });

      const getall = await prisma.screeningcv.count({
        where: { status: "uploaded", tanggal: moment().format("DD-MM-YYYY") },
      });
      results.push({
        message: `Success Upload CV ${uploadResult.public_id}`,
        total: getall,
      });
    } catch (err) {
      console.log(err);
      results.push({
        error: `Gagal upload file: ${file.originalname}`,
        err: err,
      });
    }
  }

  return res.json(results);
};
