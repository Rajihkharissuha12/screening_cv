const express = require("express");
const router = express.Router();
// Import the controller containing the getScreeningHistory function
const showController = require("../controllers/showController"); // Adjust path if necessary

// --- Add the new route here ---
// Route to get the grouped screening history
router.get("/history/date", showController.getScreeningHistory);
router.get("/history", showController.getPriorityDates);
router.get("/history/bydate", showController.getScreeningHistoryByDate);
router.get("/history/byname", showController.getScreeningHistoryByName);
// --- End add new route ---

module.exports = router;
