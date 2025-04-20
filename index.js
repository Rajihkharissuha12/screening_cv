const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors"); // 1. Import cors
const ScreeningRoutes = require("./routes/cvRoutes");
const UploadRoutes = require("./routes/uploadRoutes");
const ShowRoutes = require("./routes/showRoutes");

// 2. Configure CORS to allow only your frontend origin
const corsOptions = {
  // --- Edit 1: Change origin to an array of allowed origins ---
  origin: [
    "http://localhost:3000", // Keep the existing localhost origin
    "https://hr-briliant.vercel.app", // Remove trailing slash from Vercel frontend origin
    "https://screening-cv-nine.vercel.app", // Add backend Vercel origin
  ],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // Wider method coverage
  allowedHeaders: "Content-Type,Authorization,X-Requested-With", // Case-sensitive
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  // --- End Edit 1 ---
};
app.use(cors(corsOptions)); // Use the configured options

app.use(express.json());
app.use("/api/cv", ScreeningRoutes);
app.use("/api/cvupload", UploadRoutes);
app.use("/api", ShowRoutes);

app.get("/", (req, res) => {
  res.send("API CV Reader aktif");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
