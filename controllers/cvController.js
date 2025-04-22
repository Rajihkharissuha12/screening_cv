const { PrismaClient } = require("@prisma/client");
// const streanUpload = require("../utils/streanUpload"); // Assuming not used directly here
const { GoogleGenAI } = require("@google/genai");
const pdf = require("pdf-parse");
const axios = require("axios"); // Corrected import
const moment = require("moment-timezone"); // Add this line to import moment
const { cleanCVText } = require("../utils/cleaningcv");

const prisma = new PrismaClient();

exports.handleScreeningCV = async (req, res) => {
  const results = []; // Stores processing summary (success/filter/error)
  let processedCandidates = []; // Stores structured data of successfully processed candidates for sorting

  // --- Get filter values from request ---
  const minExperienceRequired = req.query.minExperience || null;
  const desiredDomicile = req.query.domicile || null;
  const khususmbakrere = req.query.khususmbakrere || null;
  // --- End Get filter values ---

  const files = await prisma.screeningcv.findMany({
    where: {
      status: "cleaned",
    },
    take: 10, // Consider making 'take' dynamic or configurable
  });

  // Initialize Gemini AI client once

  let ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY2 });

  // --- Stage 1: Process each file ---
  for (const file of files) {
    let extractedData = null;
    const fileNameForLogs = file.nama_file || `ID ${file.id}`; // Use filename or ID for logging

    try {
      // Fetch PDF content
      // const response = await axios.get(file.url_cv, {
      //   responseType: "arraybuffer",
      // });

      // // Parse PDF content
      // const data = await pdf(response.data);

      // // Cleaning CV
      // const cleanedText = await cleanCVText(data.text);

      // --- Dynamically build filter instructions for the prompt ---
      let filterCondition = "";
      let filterInstructions = "";

      // Filter by Domicile
      if (desiredDomicile) {
        filterInstructions += `
        1. FILTER DOMISILI (WAJIB DIPATUHI):
          - Kandidat HARUS memiliki domisili sesuai "${desiredDomicile}".
          - Jika domisili tidak sesuai, TIDAK PERLU CEK FILTER LAIN, langsung kembalikan JSON kosong {}.
          - Aturan detail:
            1. KANDIDAT HARUS DITOLAK JIKA:
               - Domisili tidak disebutkan secara eksplisit dalam CV
               - Hanya menyebut nama jalan/kecamatan tanpa kota/kabupaten
               - Menyebut lokasi lebih dari 50km dari area yang diminta
               - Menggunakan singkatan tidak resmi (e.g., "Jkt" untuk Jakarta)
               - Hanya menyebut kode pos tanpa nama lokasi
            2. CONTOH PENOLAKAN OTOMATIS:
               - Filter: "Bali" → CV menyebut "Denpasar" → DITERIMA
               - Filter: "Bali" → CV menyebut "Bandung" → DITOLAK
               - Filter: "Jakarta" → CV menyebut "Tangerang Selatan" → DITERIMA
               - Filter: "Sleman" → CV menyebut "Bantul" → DITERIMA (masih DIY)
               - Filter: "Surabaya" → CV menyebut "Gresik" → DITOLAK
            3. TINDAKAN PAKSA:
               - Jika ada keraguan sedikit pun tentang kecocokan domisili → Kembalikan nul
               - Jika domisili kandidat tidak 100% memenuhi hierarki wilayah → Kembalikan null
               - Jika terdapat lebih dari 1 domisili dalam CV → Prioritaskan domisili terbaru
               - Jika domisili tidak konsisten di berbagai bagian CV → Anggap tidak valid`;
      }

      // Filter by Minimum Experience
      if (minExperienceRequired && minExperienceRequired !== "0") {
        filterInstructions += `\n
        2. FILTER MINIMUM PENGALAMAN KERJA (WAJIB DIPATUHI):
           1. Kandidat HARUS memiliki TOTAL pengalaman kerja minimal ${minExperienceRequired}.
           2. PERHATIAN KHUSUS: Jika total pengalaman kerja KURANG dari ${minExperienceRequired}, WAJIB mengembalikan JSON kosong {} ATAU BERIKAN NILAI NULL.
           3. Perhitungan pengalaman kerja:
              * Hitung total durasi dari SEMUA pengalaman kerja yang valid
              * Format durasi: "X Tahun Y Bulan"
              * Contoh: Jika filter ${minExperienceRequired}
                - Total "1 Tahun 11 Bulan" → DITOLAK (kurang dari ${minExperienceRequired})
                - Total "${minExperienceRequired}  0 Bulan" → DITERIMA (tepat ${minExperienceRequired})
                - Total "${minExperienceRequired}  1 Bulan" → DITERIMA (lebih dari ${minExperienceRequired})
           4. ATURAN KETAT:
              * Jika ada keraguan dalam perhitungan → WAJIB kembalikan NULL
              * Jika format durasi tidak jelas → WAJIB kembalikan NULL
              * Jika total pengalaman < ${minExperienceRequired} → WAJIB kembalikan NULL
              * TIDAK ADA TOLERANSI untuk pengalaman kurang dari ${minExperienceRequired}
           5. HANYA lanjutkan proses jika total pengalaman ≥ ${minExperienceRequired}.
           6. CONTOH PENERAPAN:
           - Pengalaman < ${minExperienceRequired} → HAPUS
           - Pengalaman ${minExperienceRequired} tepat → MASUKKAN
           - Pengalaman > ${minExperienceRequired} → MASUKKAN`;
      }
      // 4. TIDAK ADA TOLERANSI:
      // - Jika kurang 1 hari dari ${minExperienceRequired} → DITOLAK
      // - Jika ada keraguan sedikit pun → DITOLAK

      // Filter by Khusus MBakrere
      if (khususmbakrere === "true" || khususmbakrere === true) {
        filterInstructions += `\n
      3. FILTER TAMBAHAN PENGALAMAN KERJA (WAJIB DIPATUHI):
        1. Untuk setiap pengalaman kerja:
           - HANYA masukkan pengalaman dengan durasi MINIMAL 1 tahun atau 12 bulan
           - Pengalaman dengan durasi < 12 bulan WAJIB DIHAPUS dari daftar
           - Perhitungan durasi harus TEPAT berdasarkan tanggal mulai dan selesai
        2. TINDAKAN PAKSA:
           - Jika ada keraguan dalam perhitungan durasi → Abaikan pengalaman tersebut
           - Jika tanggal tidak lengkap → Abaikan pengalaman tersebut
           - Jika total pengalaman setelah filter < 12 bulan → Kembalikan JSON kosong {} atau tidak masukkan ke daftar pengalaman kerja
           - Jika total pengalaman setelah filter = 0 Tahun → Kembalikan JSON kosong {} atau tidak masukkan ke daftar pengalaman kerja
           - Jika total pengalaman setelah filter > 0 Tahun → MASUKKAN ke daftar pengalaman kerja 
           - Jika total pengalaman setelah filter = 12 bulan → MASUKKAN ke daftar pengalaman kerja
           - Jika total pengalaman setelah filter > 12 bulan → MASUKKAN ke daftar pengalaman kerja
        3. CONTOH PENERAPAN:
           - Pengalaman 11 bulan 29 hari → HAPUS
           - Pengalaman 12 bulan tepat → MASUKKAN
           - Pengalaman 13 bulan → MASUKKAN`;
      }

      if (filterInstructions) {
        filterCondition = `
      - FILTERING WAJIB BERURUTAN (JANGAN LEWATKAN SATU PUN):
      ${filterInstructions}
      - PERHATIKAN: Jika kandidat TIDAK MEMENUHI SALAH SATU SAJA dari kriteria di atas, WAJIB mengembalikan JSON kosong {} tanpa memproses lebih lanjut.
      - Contoh: Jika domisili yang diminta adalah "Bali" dan kandidat berdomisili di "Jakarta", maka HARUS mengembalikan JSON kosong {} WALAUPUN kriteria lainnya terpenuhi.
      - Setiap kriteria bersifat WAJIB dan MUTLAK. Tidak ada toleransi atau pengecualian.
      - HANYA proses dan ekstrak data untuk kandidat yang LOLOS SEMUA FILTER di atas.`;
      }
      // --- End Dynamic build ---

      // --- Define the extraction prompt for Gemini ---
      const extractionPrompt = `
      Berikut adalah teks mentah dari CV:

      ${file.basic_cv}

      PERINTAH TEGAS:
      - JANGAN berikan penjelasan APAPUN.
      - JANGAN gunakan kalimat pembuka atau penutup.
      - JANGAN menyertakan perhitungan umur.
      - Pastikan SEMUA informasi yang diekstrak berasal LANGSUNG dari teks CV yang diberikan.
      - Untuk "pendidikanTerakhir", prioritaskan pendidikan formal terakhir (Universitas, SMA/SMK, SMP). Jika ada pendidikan formal dan bootcamp, pilih yang formal. Jika hanya ada bootcamp, baru gunakan itu.
      - HANYA berikan output sesuai Filter yang diminta di bawah.${
        filterCondition /* Inject dynamic filter conditions here */
      }

      Tugas (HANYA untuk kandidat yang MEMENUHI kriteria filter aktif):
      Ekstrak informasi berikut dari CV dan tampilkan HANYA dalam format JSON YANG VALID berikut. Jika tidak lolos filter, kembalikan JSON kosong {}.
      {
        "namaLengkap": "[Nama Lengkap Kandidat]",
        "perkiraanUmur": "[Angka Umur]", // Hitung: 22 + total pengalaman kerja dalam tahun
        "lokasiDomisili": "[Kota/Daerah Domisili]",
        "pendidikanTerakhir": "[Tingkat Pendidikan Formal Terakhir, e.g., S1 Teknik Informatika, SMA Negeri 1. HINDARI bootcamp jika ada pendidikan formal. Jika tidak ditemukan pendidikan terakhir, kembalikan null]",
        "daftarPengalaman": [
          {
            "kantor": "[Nama Kantor]", 
            "periode": "[Tanggal Mulai - Tanggal Selesai]", 
            "jobtitle": "[Jabatan]",
            "durasi": "[Total Durasi - STRICT CALCULATION RULES:
                      - DO NOT modify or change the original 'periode' field. Use it exactly as extracted from the CV.
                      - You MUST always calculate and fill the 'durasi' field completely and correctly, following these rules:
                        1) Year-only format (e.g., 2024-2025):
                          - Assume start date: January 1st of start year
                          - Assume end date: December 31st of end year
                          - Calculate exact months between these dates
                        2) Month-Year format (e.g., Mar 2024 - Aug 2024):
                          - Assume start date: 1st day of start month
                          - Assume end date: Last day of end month
                          - Calculate exact months between these dates
                        3) Month-to-Month Year format (e.g., Mar-Jun 2024):
                          - Assume start date: 1st day of start month
                          - Assume end date: Last day of end month
                          - Both months must be in same year
                          - Calculate exact months between these dates
                        4) If the end period is 'present', 'current', or 'sekarang':
                          - Use the current month and year (${moment()
                            .tz("Asia/Jakarta")
                            .format(
                              "DD-MM-YYYY"
                            )}) as the end date for calculation
                        5) If the start or end month is missing, assume January for missing start month and December for missing end month.
                        6) If the start or end year is missing, use the year from the other period (e.g., if start year missing, use end year).
                        7) Partial months:
                          - Count as 1 month if ≥ 15 days
                          - Ignore if < 15 days
                        8) Invalid formats:
                          - If both start and end dates are missing, mark as invalid and exclude from experience list
                          - If unclear/ambiguous dates, mark as invalid and exclude from experience list
                          - If multiple date ranges, use the most recent
                      - ALL durations MUST be expressed as 'X Tahun Y Bulan'
                      - Example calculations:
                          - '2024-2025' = 2 Tahun 0 Bulan
                          - 'Jan 2024 - Mar 2024' = 0 Tahun 3 Bulan
                          - 'Mar-Jun 2024' = 0 Tahun 4 Bulan
                          - '2024-present' = Calculate from Jan 1, 2024 to today (${moment()
                            .tz("Asia/Jakarta")
                            .format("DD-MM-YYYY")})
                      - If you find missing months or years in the period, fill them in for calculation as per the rules above, but DO NOT change the original 'periode' text.
                      - The 'durasi' field must always be filled with the correct calculation, never left blank or incomplete.
                    ]"
          },
          // ... (lanjutkan jika ada)
        ],
        "totalPengalamanKerja": "[Calculate total work experience by summing all valid 'durasi' values from 'daftarPengalaman' array. Format must be 'X Tahun Y Bulan'. Return null if total experience doesn't meet minimum ${minExperienceRequired} requirement OR if no valid experience exists (not empty string, not 0, no other format).]"
      }

      Output HARUS HANYA berupa JSON di atas untuk kandidat yang lolos filter, atau JSON kosong {} jika tidak lolos. TIDAK ADA TEKS LAIN, TIDAK ADA MARKDOWN BACKTICKS.`;

      // --- Call Gemini AI ---
      const geminiResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: extractionPrompt,
      });

      // Safely access the response text
      const rawExtractedText =
        geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      // --- Attempt to parse the JSON response ---
      try {
        // Clean potential markdown backticks (though instructed not to include them)
        const cleanedJsonString = rawExtractedText
          .replace(/^```json\s*|```$/g, "") // More robust regex for cleaning
          .trim();

        // Handle empty string case after cleaning
        if (cleanedJsonString === "") {
          extractedData = {};
        } else {
          extractedData = JSON.parse(cleanedJsonString);
        }
      } catch (parseError) {
        console.error(
          `Error parsing JSON for file ${fileNameForLogs}: ${parseError}. Raw text: "${rawExtractedText}"`
        );
        extractedData = {}; // Treat parse error as empty/filtered
      }

      // --- Update DB and collect results based on parsed data ---
      if (
        extractedData &&
        Object.keys(extractedData).length > 0 &&
        extractedData.namaLengkap &&
        extractedData.lokasiDomisili &&
        extractedData.totalPengalamanKerja
      ) {
        // Successfully processed and extracted
        await prisma.screeningcv.update({
          data: {
            status: "processed",
            tanggal_screening: moment().format("YYYY-MM-DD"),
            response: extractedData, // Store the parsed JSON object
          },
          where: { id: file.id },
        });
        results.push({
          file: fileNameForLogs,
          status: "processed",
          message: `Success Processed CV ${fileNameForLogs}`,
        });
        // Add relevant data for sorting to processedCandidates
        processedCandidates.push({
          id: file.id,
          nama_file: file.nama_file,
          url_cv: file.url_cv,
          namaLengkap: extractedData.namaLengkap,
          totalPengalamanKerja: extractedData.totalPengalamanKerja, // String "X Tahun Y Bulan"
          pendidikanTerakhir: extractedData.pendidikanTerakhir, // String pendidikan
          lokasiDomisili: extractedData.lokasiDomisili,
          extractedDetails: extractedData, // Store the full extracted object if needed later
        });
      } else {
        // Filtered out by AI criteria or invalid/empty JSON response
        await prisma.screeningcv.update({
          data: {
            status: "filtered_out",
            tanggal_screening: moment().format("YYYY-MM-DD"),
            response: {
              info: `Filtered by AI criteria or invalid/empty JSON response. Criteria: Exp >= ${
                minExperienceRequired || "N/A"
              }, Domicile = ${desiredDomicile || "N/A"}`,
              rawResponse: rawExtractedText, // Store raw response for debugging
            },
          },
          where: { id: file.id },
        });
        results.push({
          file: fileNameForLogs,
          status: "filtered_out",
          message: `CV ${fileNameForLogs} filtered out by AI criteria or invalid response.`,
        });
      }
      // --- End Update DB ---
    } catch (err) {
      // Handle errors during PDF fetching, parsing, AI call, or DB update
      console.error(`Error processing file ${fileNameForLogs}:`, err);
      try {
        await prisma.screeningcv.update({
          data: {
            status: "error",
            tanggal_screening: moment().format("YYYY-MM-DD"),
          },
          where: { id: file.id },
        });
      } catch (dbError) {
        console.error(
          `Failed to update status to error for file ID ${file.id}:`,
          dbError
        );
      }
      // Add error details to the results summary
      results.push({
        file: fileNameForLogs,
        status: "error",
        error: `Failed to process file: ${fileNameForLogs}`,
        details: err.message || "An unexpected error occurred",
      });
    }
  } // --- End loop for 'file' ---

  // --- Stage 2: Prioritize (Sort) Processed Candidates ---

  // Helper function to parse duration "X Tahun Y Bulan" to total months
  function parseExperienceToMonths(expString) {
    if (!expString || typeof expString !== "string") return 0;
    let totalMonths = 0;
    const yearMatch = expString.match(/(\d+)\s*Tahun/i);
    const monthMatch = expString.match(/(\d+)\s*Bulan/i);
    if (yearMatch) totalMonths += parseInt(yearMatch[1], 10) * 12;
    if (monthMatch) totalMonths += parseInt(monthMatch[1], 10);
    return totalMonths;
  }

  // Helper function to assign a rank to education level
  function getEducationRank(eduString) {
    if (!eduString || typeof eduString !== "string") return 0;
    const lowerEdu = eduString.toLowerCase();
    // Assign ranks (higher is better)
    if (
      lowerEdu.includes("s3") ||
      lowerEdu.includes("doktor") ||
      lowerEdu.includes("phd")
    )
      return 6;
    if (lowerEdu.includes("s2") || lowerEdu.includes("master")) return 5;
    if (
      lowerEdu.includes("s1") ||
      lowerEdu.includes("sarjana") ||
      lowerEdu.includes("bachelor")
    )
      return 4;
    if (lowerEdu.includes("d4")) return 3.5;
    if (lowerEdu.includes("d3") || lowerEdu.includes("diploma tiga")) return 3;
    if (lowerEdu.includes("d2")) return 2;
    if (lowerEdu.includes("d1")) return 1;
    if (
      lowerEdu.includes("sma") ||
      lowerEdu.includes("smk") ||
      lowerEdu.includes("senior high") ||
      lowerEdu.includes("high school")
    )
      return 0.5;
    return 0; // Default for unrecognized or missing education
  }

  // Add calculated values (total months experience, education rank) to each candidate
  processedCandidates.forEach((candidate) => {
    candidate.totalMonthsExperience = parseExperienceToMonths(
      candidate.totalPengalamanKerja
    );
    candidate.educationRank = getEducationRank(candidate.pendidikanTerakhir);
  });

  // Sort candidates based on priority: 1. Experience (desc), 2. Education (desc)
  // Filter out candidates with 0 experience before sorting
  const validCandidates = processedCandidates.filter(
    (candidate) => candidate.totalMonthsExperience > 0
  );

  // Sort remaining candidates by experience and education
  validCandidates.sort((a, b) => {
    // Priority 1: Experience (higher first)
    if (b.totalMonthsExperience !== a.totalMonthsExperience) {
      return b.totalMonthsExperience - a.totalMonthsExperience;
    }
    // Priority 2: Education (higher rank first) if experience is the same
    return b.educationRank - a.educationRank;
  });

  // Replace the original array with filtered and sorted candidates
  processedCandidates = validCandidates;

  // --- Filter to keep only candidates matching the highest priority level ---
  let finalCandidates = [];
  if (processedCandidates.length > 0) {
    // Get the experience level of the top candidate (highest experience)
    const highestExperienceLevel = processedCandidates[0].totalMonthsExperience;

    // Filter the list to include only candidates with that same highest experience level
    finalCandidates = processedCandidates.filter(
      (candidate) => candidate.totalMonthsExperience === highestExperienceLevel
    );
    // Candidates within this final list are already sorted by education due to the initial sort
  }
  // --- End Filter ---

  // --- Return consolidated and SORTED results ---
  const remainingUploaded = await prisma.screeningcv.count({
    where: { status: "cleaned" },
  });

  const formatResults = {
    // Return the FILTERED and sorted list
    sortedCandidates: finalCandidates.map((c) => ({
      // Use finalCandidates here
      nama_file: c.nama_file,
      url_cv: c.url_cv,
      namaLengkap: c.namaLengkap,
      totalPengalamanKerja: c.totalPengalamanKerja, // Original string for display
      pendidikanTerakhir: c.pendidikanTerakhir, // Original string for display
      lokasiDomisili: c.lokasiDomisili,
      // Optionally include the full extracted details if needed by the frontend
      extractedDetails: c.extractedDetails,
    })),
    processingSummary: processedCandidates, // Summary of processing status for each file (processed/filtered_out/error)
    remainingUploadedCount: remainingUploaded,
  };

  const priorityData = await prisma.prioritycv.create({
    data: {
      tanggal: moment().format("DD-MM-YYYY"),
      response: formatResults,
    },
  });
  // Prepare the final response object
  return res.json(formatResults);
  // --- End Return ---
}; // End of handleScreeningCV function
