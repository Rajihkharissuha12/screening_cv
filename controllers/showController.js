const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// --- Updated function to fetch and MERGE Prioritycv data by date ---
exports.getScreeningHistory = async (req, res) => {
  const { date } = req.query;
  console.log(date);
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

    // --- Step 3: Transform the merged data object into an array ---
    const result_array = Object.entries(mergedPriorityData).map(
      ([tanggal, data]) => ({
        tanggal_process: tanggal, // The date string
        data: data, // The merged data object for that date
      })
    );
    // --- End Transformation ---

    // --- Step 4: Return the transformed array ---
    return res.json(result_array); // Return the array
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
