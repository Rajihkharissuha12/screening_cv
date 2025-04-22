const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY1 });

async function cleanCVText(rawText) {
  const cleaningPrompt = `
  TUGAS UTAMA: Bersihkan teks CV berikut dengan ATURAN KETAT:

  1. HAPUS TOTAL bagian-bagian ini beserta isinya (JANGAN sisakan judulnya):
     - Deskripsi/Summary/About Me/Tentang Saya
     - Skills/Abilities/Keahlian/Kemampuan
     - Pengalaman Organisasi/Organisasi
     - Publikasi/Jurnal/Publications
     - Proyek Pribadi/Side Projects/Portfolio (kecuali terkait langsung pekerjaan)
     - Bootcamp/Sertifikat/Pelatihan/Kursus/Certificates
     - Referensi/References
     - Seminar/Workshop/Konferensi
     - Hobi/Minat/Interests
     - Prestasi/Penghargaan (kecuali terkait langsung pekerjaan)

  2. PERTAHANKAN HANYA bagian-bagian ini:
     - Informasi Pribadi (Nama, Kontak seperti Email, Telepon, Alamat singkat [Kota/Kabupaten])
     - Pendidikan Formal (SD, SMP, SMA/SMK, D1-D4, S1-S3, Universitas/Institut/Sekolah Tinggi)
     - Pengalaman Kerja Profesional (Nama Perusahaan, Jabatan, Periode Kerja, Deskripsi Tugas Singkat)

  3. PERBAIKI & STANDARISASI (WAJIB):
     - Perbaiki SEMUA kesalahan ketik (typo) dan ejaan dalam teks yang dipertahankan.
     - Jelaskan SEMUA singkatan umum, terutama BULAN (misal: "Agt" menjadi "Agustus", "Sept" menjadi "September", "Okt" menjadi "Oktober", "Nov" menjadi "November", "Des" menjadi "Desember", "Jan" menjadi "Januari", "Feb" menjadi "Februari", "Mar" menjadi "Maret", "Apr" menjadi "April", "Mei" tetap "Mei", "Jun" menjadi "Juni", "Jul" menjadi "Juli"). Jika ada singkatan lain yang umum (seperti nama gelar atau institusi), coba jelaskan jika konteksnya jelas.

  4. FORMAT OUTPUT:
     - Hanya teks biasa (plain text).
     - JANGAN gunakan markdown, bullet points, atau numbering.
     - Pisahkan bagian utama (Pribadi, Pendidikan, Pengalaman Kerja) dengan baris kosong jika memungkinkan.

  CV ASLI UNTUK DIPROSES:
  \`\`\`
  ${rawText}
  \`\`\`

  OUTPUT HANYA TEKS CV YANG SUDAH DIBERSIHKAN DAN DIPERBAIKI SESUAI ATURAN DI ATAS. JANGAN TAMBAHKAN KOMENTAR ATAU PENJELASAN APAPUN.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: cleaningPrompt,
    });

    const cleanedText =
      response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return cleanedText.replace(/```/g, "").trim(); // Clean markdown backticks
  } catch (error) {
    console.error("Error cleaning CV:", error);
    return rawText; // Return original text if error
  }
}

module.exports = { cleanCVText };
