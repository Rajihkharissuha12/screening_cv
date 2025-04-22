const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const moment = require("moment-timezone"); // Add this line to import moment

// --- Updated function to fetch and MERGE Prioritycv data by date ---
exports.getScreeningHistory = async (req, res) => {
  const { date } = req.query;
  try {
    // --- Step 1: Fetch all Prioritycv records ---
    const priorityData = await prisma.prioritycv.findMany({
      select: {
        id: true,
        tanggal: true,
        response: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { tanggal: "desc" },
        { createdAt: "desc" }, // Sort by creation time to process latest first for a date
      ],
      where: {
        tanggal: date, // Filter by the provided date
      },
    });

    // --- Step 2: Merge the results by the 'tanggal' field ---
    const mergedPriorityData = {}; // Changed variable name for clarity

    for (const priority of priorityData) {
      const tanggal = priority.tanggal;

      // Safely access response and its properties, provide defaults
      const response =
        priority.response && typeof priority.response === "object"
          ? priority.response
          : {};
      const currentCandidates = Array.isArray(response.sortedCandidates)
        ? response.sortedCandidates
        : [];
      const currentSummary = Array.isArray(response.processingSummary)
        ? response.processingSummary
        : [];

      // If this date hasn't been seen yet, initialize it
      if (!mergedPriorityData[tanggal]) {
        mergedPriorityData[tanggal] = {
          // Use details from the first record encountered for the date (which is the latest due to sorting)
          latestRecordId: priority.id,
          latestCreatedAt: priority.createdAt,
          latestUpdatedAt: priority.updatedAt,
          // Initialize arrays with the current record's data
          sortedCandidates: [...currentCandidates], // Create copies
          processingSummary: [...currentSummary], // Create copies
          // You could add other fields from the response if needed, e.g., remainingUploadedCount
          // remainingUploadedCount: response.remainingUploadedCount || 0,
        };
      } else {
        // If date exists, append data from the current record to the existing arrays
        mergedPriorityData[tanggal].sortedCandidates.push(...currentCandidates);
        mergedPriorityData[tanggal].processingSummary.push(...currentSummary);
        // Decide how to handle other fields like remainingUploadedCount if they exist
        // e.g., maybe take the value from the latest record (already set during initialization)
      }
    }
    // --- End Merging Logic ---

    // // --- Step 3 (Renumbered): Transform the merged data object into an array ---
    const result_array = Object.entries(mergedPriorityData).map(
      ([tanggal, data]) => ({
        tanggal_process: tanggal, // The date string
        data: data, // The merged and filtered data object for that date
      })
    );
    // --- End Transformation ---
    // console.log(result_array[0].data.sortedCandidates);
    // --- Step 4 (Renumbered): Return the transformed array ---
    let processedCandidates = result_array[0].data.processingSummary;
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
      if (lowerEdu.includes("d3") || lowerEdu.includes("diploma tiga"))
        return 3;
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

    // --- End Filter ---
    // --- Return consolidated and SORTED results ---
    const remainingUploaded = await prisma.screeningcv.count({
      where: { status: "cleaned" },
    });

    const formatResults = {
      // Return the FILTERED and sorted list
      tanggal_process: result_array[0].tanggal_process,
      data: {
        sortedCandidates: result_array[0].data.sortedCandidates.map((c) => ({
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
      },
    };

    // --- New Step: Filter processingSummary to remove duplicates from sortedCandidates ---
    // Create a Set of url_cv values from sortedCandidates for efficient lookup
    // Create a Set of URLs from sortedCandidates for efficient lookup
    const sortedCandidateUrls = new Set(
      formatResults.data.sortedCandidates
        ?.map((candidate) => candidate?.url_cv)
        .filter(Boolean) || []
    );

    // Filter out processingSummary entries that exist in sortedCandidates
    formatResults.data.processingSummary =
      formatResults.data.processingSummary.filter(
        (summaryItem) =>
          !summaryItem.url_cv || !sortedCandidateUrls.has(summaryItem.url_cv)
      );
    // --- End Filtering Step ---

    // --- Step 4 (Renumbered): Return the transformed array ---
    return res.json([formatResults]); // Return the array
  } catch (error) {
    console.error("Error fetching priority CV history:", error); // Updated error message
    return res.status(500).json({
      message: "Failed to fetch priority CV history", // Updated error message
      error: error.message,
    });
  }
};
// --- End updated function ---

// --- New function to get distinct priority dates ---
exports.getPriorityDates = async (req, res) => {
  try {
    // Fetch distinct 'tanggal' values from Prioritycv
    const distinctDatesData = await prisma.prioritycv.findMany({
      distinct: ["tanggal"], // Get only unique values for the 'tanggal' field
      select: {
        tanggal: true, // Select only the 'tanggal' field
      },
      orderBy: {
        tanggal: "desc", // Order the dates descending (most recent first)
      },
    });

    // Extract the date strings into a simple array
    const dateList = distinctDatesData.map((item) => item.tanggal);

    // Return the list of dates
    return res.json(distinctDatesData);
  } catch (error) {
    console.error("Error fetching distinct priority dates:", error);
    return res.status(500).json({
      message: "Failed to fetch priority dates",
      error: error.message,
    });
  }
};
// --- End new function ---

// Other controller functions...
