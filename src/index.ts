// src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import userRouter from "./routes/userRoutes";
import barberRouter from "./routes/barberRoutes";

const app = express();

console.log("=== ENVIRONMENT DEBUG ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT from env:", process.env.PORT);
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "Set" : "Not set");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Set" : "Not set");
console.log("========================");

// CORS configuration - matching your original setup
app.use(
  cors({
    origin: [
      "https://next-cut-frontend-e6zu.vercel.app", // Your Vercel frontend
      "http://localhost:5173", // Local Vite dev server
      "http://localhost:3000", // Local alternative
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Health check endpoints (required for Render)
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "NextCut API v2 is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "2.0.0",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/user", userRouter);
app.use("/barber", barberRouter);

// Debug endpoint
app.get("/debug", (req, res) => {
  res.json({
    origin: req.headers.origin,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    routes: {
      user: [
        "POST /user/signup",
        "POST /user/signin",
        "POST /user/joinqueue",
        "POST /user/leavequeue",
        "GET /user/nearby",
        "GET /user/queue-status",
      ],
      barber: [
        "POST /barber/signup",
        "POST /barber/signin",
        "GET /barber/queue",
        "POST /barber/remove-user",
      ],
    },
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
    method: req.method,
  });
});

// Global error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Global error handler:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
);

const PORT = process.env.PORT || 3000;

console.log("Attempting to start server on 0.0.0.0:" + PORT);
app.listen(PORT, () => {
  console.log(`✅ Server successfully listening on 0.0.0.0:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🚀 API Endpoints:`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Debug: http://localhost:${PORT}/debug`);
  console.log(`   User API: http://localhost:${PORT}/user/*`);
  console.log(`   Barber API: http://localhost:${PORT}/barber/*`);
});
