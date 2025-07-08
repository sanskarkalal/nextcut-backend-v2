// src/routes/userRoutes.ts
import express, { Request, Response } from "express";
import {
  createUser,
  authenticateUser,
  joinQueue,
  getBarbersNearby,
  removeFromQueue,
  getUserQueueStatus,
} from "../services/userServices";
import "dotenv/config";
import jwt from "jsonwebtoken";
import { authenticateJWT, AuthenticatedRequest } from "./middleware/auth";

const userRouter = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Helper function to extract error message
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

// Helper function to check if error has a code property
const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error === "object" && error !== null && "code" in error) {
    return (error as any).code;
  }
  return undefined;
};

// User signup
userRouter.post("/signup", async (req: Request, res: Response) => {
  try {
    console.log("User signup request received:", {
      body: req.body,
      headers: req.headers.origin,
    });

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      console.log("Missing fields in signup request");
      res.status(400).json({ error: "Name, email and password are required." });
      return;
    }

    const user = await createUser(name, email, password);
    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET!, {
      expiresIn: "8h",
    });

    console.log("User signup successful:", {
      userId: user.id,
      email: user.email,
    });

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      msg: "User created successfully",
      token,
    });
  } catch (error) {
    console.error("User signup error:", error);

    // Handle unique constraint violation
    if (getErrorCode(error) === "P2002") {
      res.status(409).json({ msg: "Email already exists" });
      return;
    }

    res.status(500).json({
      msg: "Error occurred during sign up",
      error: getErrorMessage(error),
    });
  }
});

// User signin
userRouter.post("/signin", async (req: Request, res: Response) => {
  try {
    console.log("User signin request received:", {
      email: req.body.email,
      hasPassword: !!req.body.password,
      origin: req.headers.origin,
    });

    const { email, password } = req.body;

    if (!email || !password) {
      console.log("Missing email or password in signin request");
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    console.log("Attempting to authenticate user:", email);
    const user = await authenticateUser(email, password);

    if (!user) {
      console.log("Authentication failed for user:", email);
      res.status(401).json({ msg: "Invalid email or password" });
      return;
    }

    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET!, {
      expiresIn: "8h",
    });

    console.log("User signin successful:", {
      userId: user.id,
      email: user.email,
    });

    res.json({
      user,
      msg: "User Signed In Successfully",
      token,
    });
  } catch (error) {
    console.error("User signin error:", error);
    res.status(500).json({
      msg: "Error occurred during sign in",
      error: getErrorMessage(error),
    });
  }
});

// Join queue
userRouter.post(
  "/joinqueue",
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { barberId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!barberId) {
        res.status(400).json({ error: "Barber ID is required" });
        return;
      }

      const queueEntry = await joinQueue(barberId, userId);

      res.json({
        msg: "You have joined the queue",
        queue: queueEntry,
      });
    } catch (error) {
      console.error("Join queue error:", error);
      res
        .status(500)
        .json({ msg: "Error joining queue", error: getErrorMessage(error) });
    }
  }
);

// Remove from queue
userRouter.post(
  "/leavequeue",
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const result = await removeFromQueue(userId);

      if (!result.success) {
        res.status(400).json({ msg: result.message });
        return;
      }

      res.json({
        msg: "You have been removed from the queue",
        data: result.data,
      });
    } catch (error) {
      console.error("Leave queue error:", error);
      res
        .status(500)
        .json({ msg: "Error leaving queue", error: getErrorMessage(error) });
    }
  }
);

// Get nearby barbers
userRouter.get(
  "/nearby",
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const lat = req.query.lat as string;
      const long = req.query.long as string;

      if (!lat || !long) {
        res.status(400).json({
          error: "Latitude and longitude query parameters are required",
        });
        return;
      }

      const qLat = parseFloat(lat);
      const qLong = parseFloat(long);

      if (isNaN(qLat) || isNaN(qLong)) {
        res.status(400).json({ error: "Invalid latitude or longitude values" });
        return;
      }

      // Validate latitude and longitude ranges
      if (qLat < -90 || qLat > 90) {
        res.status(400).json({ error: "Latitude must be between -90 and 90" });
        return;
      }

      if (qLong < -180 || qLong > 180) {
        res
          .status(400)
          .json({ error: "Longitude must be between -180 and 180" });
        return;
      }

      const radius = req.query.radius
        ? parseFloat(req.query.radius as string)
        : 5;

      if (isNaN(radius) || radius <= 0) {
        res.status(400).json({ error: "Radius must be a positive number" });
        return;
      }

      const barbers = await getBarbersNearby(qLat, qLong, radius);

      res.json({
        barbers,
        searchLocation: { lat: qLat, long: qLong },
        radiusKm: radius,
      });
    } catch (error) {
      console.error("Error fetching nearby barbers:", error);
      res.status(500).json({
        error: "Internal server error",
        details: getErrorMessage(error),
      });
    }
  }
);

// Get user's queue status
userRouter.get(
  "/queue-status",
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const queueStatus = await getUserQueueStatus(userId);
      res.json({ queueStatus });
    } catch (error) {
      console.error("Error fetching queue status:", error);
      res.status(500).json({
        error: "Internal server error",
        details: getErrorMessage(error),
      });
    }
  }
);

export default userRouter;
