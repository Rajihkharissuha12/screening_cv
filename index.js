const express = require("express");
const app = express();
require("dotenv").config();
const router = require("./routes/cvRoutes");

app.use(express.json());
app.use("/api/cv", router);

app.get("/", (req, res) => {
  res.send("API CV Reader aktif");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
