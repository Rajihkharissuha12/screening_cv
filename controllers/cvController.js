const cloudinary = require("cloudinary").v2;
const { PrismaClient } = require("@prisma/client");
const streanUpload = require("../utils/streanUpload");
const { GoogleGenAI } = require("@google/genai");
const pdf = require("pdf-parse");
const { default: axios } = require("axios");

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.handleScreeningCV = async (req, res) => {
  const results = [];

  // --- Get filter values from request (Example using req.query) ---
  // Adjust req.query to req.body if needed based on how you send data
  const minExperienceRequired = req.query.minExperience || null; // e.g., "1 Tahun 0 Bulan" or null/undefined
  const desiredDomicile = req.query.domicile || null; // e.g., "Jakarta" or null/undefined
  // --- End Get filter values ---

  const files = await prisma.screeningcv.findMany({
    where: {
      status: "uploaded",
    },
    take: 15, // Consider making 'take' dynamic or configurable
  });

  let ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  for (const file of files) {
    try {
      const response = await axios.get(file.url_cv, {
        responseType: "arraybuffer", // Important: Get data as a buffer
      });

      const data = await pdf(response.data);

      // --- Dynamically build filter instructions ---
      let filterCondition = "";

      let filterInstructions = "";
      if (minExperienceRequired && minExperienceRequired !== "0") {
        filterInstructions += `\n          - Minimum total durasi pengalaman kerja: ${minExperienceRequired} (Hanya tampilkan jika total pengalaman kerja kandidat DI ATAS  ${minExperienceRequired} ATAU SAMA PERSIS)`;
      }
      if (desiredDomicile) {
        filterInstructions += `\n          - Lokasi domisili yang diinginkan: ${desiredDomicile} (Hanya tampilkan jika domisili kandidat SAMA PERSIS)`;
      }

      if (filterInstructions) {
        filterCondition = `
      - Filter hasil berdasarkan kriteria berikut:${filterInstructions}
      - Jika kandidat TIDAK MEMENUHI SEMUA kriteria aktif di atas, JANGAN tampilkan output APAPUN untuk kandidat tersebut.`;
      }
      // --- End Dynamic build ---

      const prompt = `
      Berikut adalah link CV: ${data.text}

      PERINTAH TEGAS:
      - JANGAN berikan penjelasan APAPUN.
      - JANGAN gunakan kalimat pembuka atau penutup.
      - JANGAN menyertakan perhitungan umur.
      - Pastikan SEMUA informasi yang diekstrak berasal LANGSUNG dari konten CV yang diberikan di URL. // Added instruction for accuracy
      - HANYA berikan output sesuai format yang diminta di bawah.${
        filterCondition /* Inject dynamic filter conditions here */
      }

      Tugas (HANYA untuk kandidat yang MEMENUHI kriteria aktif):
      Ekstrak informasi berikut dari CV dan tampilkan HANYA dalam format ini:
      - Nama lengkap: [Nama Lengkap Kandidat]
      - Perkiraan umur: [Angka Umur] (Hitung: 22 + total pengalaman kerja dalam tahun)
      - Lokasi domisili: [Kota/Daerah Domisili]
      - Daftar pengalaman kerja:
          - [Nama Kantor] || [Tanggal Mulai - Tanggal Selesai] || [Total Durasi]
          - [Nama Kantor] || [Tanggal Mulai - Tanggal Selesai] || [Total Durasi]
          (lanjutkan jika ada)
      - Total durasi pengalaman kerja: [X Tahun Y Bulan]

      Output HARUS HANYA berupa daftar poin di atas untuk kandidat yang lolos filter. TIDAK ADA TEKS LAIN.
      `; // Removed the last

      const geminiResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash-lite",
        contents: prompt,
      });

      const extractedText =
        geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "";

      const template = {
        nama_file: file.nama_file,
        url: file.url_cv,
        extracted: extractedText,
      };

      // --- Update DB based on whether AI returned content ---
      if (template.extracted && template.extracted.trim() !== "") {
        await prisma.screeningcv.update({
          data: {
            status: "processed",
            response: template,
          },
          where: {
            id: file.id,
          },
        });
        results.push({
          message: `Success Processed CV ${file.nama_file}`,
          data: template, // Optionally include extracted data
        });
      } else {
        await prisma.screeningcv.update({
          data: {
            status: "processed",
          },
          where: {
            id: file.id,
          },
        });
        results.push({
          message: `CV ${file.nama_file} filtered out by AI criteria.`,
        });
      }
      // --- End Update DB ---
    } catch (err) {
      console.error(`Error processing file ${file.nama_file}:`, err); // Log specific error
      // const errorFileName =
      //   file && file.nama_file ? file.nama_file : "unknown file";
      // results.push({
      //   error: `Gagal proses file: ${errorFileName}`,
      //   details: err.message || "An unexpected error occurred",
      // });
      try {
        await prisma.screeningcv.update({
          data: { status: "error" },
          where: { id: file.id },
        });
      } catch (dbError) {
        console.error(
          `Failed to update status to error for file ID ${file.id}:`,
          dbError
        );
      }
    }
  }

  // --- Return consolidated results ---
  const remainingUploaded = await prisma.screeningcv.count({
    where: { status: "uploaded" },
  });

  return res.json({
    processedResults: results,
    remainingUploadedCount: remainingUploaded,
  });
  // --- End Return ---
};
