const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors"); // 1. Import cors
const ScreeningRoutes = require("./routes/cvRoutes");
const UploadRoutes = require("./routes/uploadRoutes");
const ShowRoutes = require("./routes/showRoutes");

// 2. Configure CORS to allow only your frontend origin
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://hr-briliant.vercel.app", // Remove trailing slash
  ],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // Wider method coverage
  allowedHeaders: "Content-Type,Authorization,X-Requested-With", // Case-sensitive
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions)); // Use the configured options

// Add this right after CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://hr-briliant.vercel.app");
  res.header("Vary", "Origin");
  next();
});

app.options("*", cors(corsOptions)); // Handle preflight for all routes

app.use(express.json());
app.use("/api/cv", ScreeningRoutes);
app.use("/api/cvupload", UploadRoutes);
app.use("/api", ShowRoutes);

app.get("/", (req, res) => {
  res.send("API CV Reader aktif");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
