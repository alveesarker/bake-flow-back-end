const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config({ quiet: true });

const routes = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// --- CORS -------------------------------------------------------------
// CORS_ORIGIN can be "*" or a comma-separated list of allowed frontend
// origins, e.g. "http://localhost:5173,http://localhost:5174"
const corsOrigin = process.env.CORS_ORIGIN || "*";
const corsOptions =
  corsOrigin === "*"
    ? { origin: true }
    : { origin: corsOrigin.split(",").map((o) => o.trim()) };

app.use(cors(corsOptions));

// --- Core middleware ----------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// --- Health check ---------------------------------------------------------
app.get("/", (req, res) => {
  res.json({ success: true, message: "BakeFlow API is running" });
});

// --- API routes -----------------------------------------------------------
app.use("/api", routes);

// --- 404 + error handling (must stay last) ---------------------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
