const express = require("express");
const app = express();
require("dotenv").config();
const ScreeningRoutes = require("./routes/cvRoutes");
const UploadRoutes = require("./routes/uploadRoutes");

app.use(express.json());
app.use("/api/cv", ScreeningRoutes);
app.use("/api/cvupload", UploadRoutes);

app.get("/", (req, res) => {
  res.send("API CV Reader aktif");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
