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

// Simple CORS allowing your frontend
app.use(
  cors({
    origin: [
      "https://next-cut-frontend-e6zu.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

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

// ADD THESE ROUTE CONNECTIONS
app.use("/user", userRouter);
app.use("/barber", barberRouter);

// REMOVE ALL THE INLINE ENDPOINTS (everything from line 49 to the debug endpoint)
// Keep only the debug endpoint and server startup

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
