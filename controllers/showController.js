const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// --- Updated function to fetch and combine Screeningcv and Prioritycv data ---
exports.getScreeningHistory = async (req, res) => {
  try {
    // --- Step 2: Fetch all Prioritycv records ---
    const priorityData = await prisma.prioritycv.findMany({
      select: {
        tanggal: true, // Prioritycv still uses 'tanggal'
        response: true,
      },
      // --- Edit 2: Also wrap this orderBy in an array for consistency (optional but good practice) ---
      orderBy: [{ tanggal: "desc" }],
      // --- End Edit 2 ---
    });

    // --- Step 5: Return the combined history object ---
    return res.json(priorityData);
  } catch (error) {
    console.error("Error fetching screening history:", error);
    return res.status(500).json({
      message: "Failed to fetch screening history",
      error: error.message,
    });
  }
};
// --- End updated function ---

// Other controller functions...
