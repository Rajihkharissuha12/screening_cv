const { PrismaClient } = require("@prisma/client");
// const streanUpload = require("../utils/streanUpload"); // Assuming not used directly here
const { GoogleGenAI } = require("@google/genai");
const pdf = require("pdf-parse");
const axios = require("axios"); // Corrected import
const moment = require("moment"); // Add this line to import moment
const { cleanCVText } = require("../utils/cleaningcv");

const prisma = new PrismaClient();

exports.handleCleaningCV = async (req, res) => {
  const files = await prisma.screeningcv.findMany({
    where: {
      status: "uploaded",
    },
    take: 7, // Consider making 'take' dynamic or configurable
  });

  for (const file of files) {
    try {
      // Fetch PDF content
      const response = await axios.get(file.url_cv, {
        responseType: "arraybuffer",
      });

      // Parse PDF content
      const data = await pdf(response.data);

      // Cleaning CV
      const cleanedText = await cleanCVText(data.text);

      const cleanedCV = await prisma.screeningcv.update({
        where: { id: file.id },
        data: {
          status: "cleaned",
          basic_cv: cleanedText,
        },
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: `Error : ${error.message}`,
      });
    }
  }
  const remainingUploaded = await prisma.screeningcv.count({
    where: { status: "uploaded" },
  });

  return res.status(200).json({
    status: "success",
    message: `Successfully cleaned`,
    remainingUploaded: remainingUploaded,
  });
};
