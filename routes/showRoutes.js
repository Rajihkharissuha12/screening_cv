const express = require("express");
const router = express.Router();
// Import the controller containing the getScreeningHistory function
const showController = require("../controllers/showController"); // Adjust path if necessary

// --- Add the new route here ---
// Route to get the grouped screening history
router.get("/history/date", showController.getScreeningHistory);
router.get("/history", showController.getPriorityDates);
// --- End add new route ---

// Add other routes for 'show' functionality below if needed
// Example: router.get('/:id', showController.getScreeningById);

module.exports = router;
