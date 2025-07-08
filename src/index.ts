import "dotenv/config";
import express from "express";
import cors from "cors";
// ADD THESE IMPORTS
import userRouter from "./routes/userRoutes";
import barberRouter from "./routes/barberRoutes";

const app = express();

console.log("=== ENVIRONMENT DEBUG ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT from env:", process.env.PORT);
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "Set" : "Not set");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Set" : "Not set");
console.log("========================");

// UPDATED CORS with more permissive settings
app.use(
  cors({
    origin: [
      //allow all vercel domains
      /\.vercel(?:\.app|-preview\.app)$/,
      "https://next-cut-frontend-e6zu.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
      "https://nextcut-backend-v2.onrender.com",
      "https://next-cut-frontend-e6zu-ghyrwsst9-sanskars-projects-5d4f18b1.vercel.app", // Add your backend URL too
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  })
);

// Add explicit OPTIONS handling for preflight requests
app.options("*", cors());

app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "NextCut API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "NextCut API is healthy",
    timestamp: new Date().toISOString(),
  });
});

// USE YOUR ROUTE FILES
app.use("/user", userRouter);
app.use("/barber", barberRouter);

// Debug endpoint
app.get("/debug", (req, res) => {
  res.json({
    origin: req.headers.origin,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3000;

console.log("Attempting to start server on 0.0.0.0:" + PORT);
app.listen(PORT, () => {
  console.log(`✅ Server successfully listening on 0.0.0.0:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
