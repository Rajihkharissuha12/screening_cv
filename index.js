const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors"); // 1. Import cors
const ScreeningRoutes = require("./routes/cvRoutes");
const UploadRoutes = require("./routes/uploadRoutes");

// 2. Configure CORS to allow only your frontend origin
const corsOptions = {
  origin: "http://localhost:3000", // Replace 3001 with your actual Next.js frontend port if different
};
app.use(cors(corsOptions)); // Use the configured options

app.use(express.json());
app.use("/api/cv", ScreeningRoutes);
app.use("/api/cvupload", UploadRoutes);

app.get("/", (req, res) => {
  res.send("API CV Reader aktif");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
