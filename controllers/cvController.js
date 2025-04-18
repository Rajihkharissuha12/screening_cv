const cloudinary = require("cloudinary").v2;
const { PrismaClient } = require("../generated/prisma");
const streanUpload = require("../utils/streanUpload");
const { GoogleGenAI } = require("@google/genai");

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.handleScreeningCV = async (req, res) => {
  const results = [];

  const files = await prisma.screeningcv.findMany({
    where: {
      status: "uploaded",
    },
    take: 15,
  });
  for (const file of files) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // const prompt = `
      // Berikut isi CV:\n${uploadResult.secure_url}\n\n
      // Required : \n\n
      // - jika umur > 30 tahun maka tidak perlu di proses dan tidak boleh di tampilkan\n\n
      // - Response yang di tampilkan cukup hanya Pelamar dengan umur di bawah 30 tahun\n\n
      // - Respone yang di berikan cukup ketentuan yang di inginkan di bawah !!!\n\n
      // - Tidak perlu penjelasan atau di berikan penjelasan detail perhitungan\n\n
      // - Jika hasil Response masih menampilkan data dengan umur > 30 tahun maka hapus dan sisakan data hasil umur kurang dari 30 tahun\n\n
      // Dari teks-teks CV berikut, untuk setiap kandidat, tolong identifikasi dan sebutkan:\n\n
      // - Nama lengkap : (contoh : nama lengkap)\n\n
      // - Perkiraan umur : (asumsi mulai bekerja usia 22 dan menambahkan total pengalaman, langsung sebutkan angka !!!)\n\n
      // - Daftar pengalaman kerja : \n\n
      //   - (nama kantor || durasi tanggal mulai dan selesai || total berapa lama durasi) // 1\n\n
      //   - (nama kantor || durasi tanggal mulai dan selesai || total berapa lama durasi) // 2\n\n
      //   - dan seterusnya\n\n
      // - Total durasi pengalaman kerja : (contoh 1 Tahun 2 Bulan)\n\n

      // Format output untuk setiap kandidat dengan jelas tanpa perlu penjelasan panjang lebar, cukup langsung point inti jawaban yang di inginkan sesuai required yang ada.!!!!!
      // kalo bisa di rapihkan juga untuk hasil response yang di berikan
      // `;
      const prompt = `
      Berikut adalah link CV: ${file.url_cv}
      required:
      - Respone yang di berikan cukup ketentuan yang di inginkan di bawah!!!
      - Tidak perlu penjelasan atau di berikan penjelasan detail perhitungan
      Tugas:
      - Hanya proses kandidat dengan umur di bawah 30 tahun (jika umur > 30, abaikan).
      - Untuk setiap kandidat, tampilkan hanya:
        - Nama lengkap
        - Perkiraan umur (cara menghitung 22 tahun + total pengalaman)
        - Daftar pengalaman kerja (format: nama kantor || tanggal mulai - selesai || total durasi)
        - Total durasi pengalaman kerja
      - Setiap kadidat tidak perlu penjelasan atau penambahan informasi.

      Output hanya berupa list poin-poin di atas, tanpa pendahuluan, penjelasan, atau kalimat pembuka/penutup.
      `;
      const geminiResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });
      // console.log(geminiResponse.candidates[0].content.parts[0].text);
      const template = {
        nama_file: file.nama_file,
        url: file.url_cv,
        extracted: geminiResponse.candidates[0].content.parts[0].text,
      };

      const files = await prisma.screeningcv.update({
        data: {
          status: "processed",
          response: template,
        },
        where: {
          id: file.id,
        },
      });
    } catch (err) {
      console.log(err);
      results.push({
        error: `Gagal proses file: ${file.originalname}`,
        err: err,
      });
    }
  }
  const fileall = await prisma.screeningcv.findMany({
    where: {
      status: "uploaded",
    },
  });
  return res.json({
    total: fileall.length,
  });
};
