// src/routes/barberRoutes.ts - Fixed with proper default export
import { Router, Request, Response } from "express";
import {
  authenticateBarber,
  createBarber,
  getQueue,
  removeUserFromQueue,
} from "../services/barberServices";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { authenticateJWT, AuthenticatedRequest } from "./middleware/auth";

const router = Router();
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

// Barber signup
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { name, username, password, lat, long } = req.body;

    if (!name || !username || !password || !lat || !long) {
      res.status(400).json({
        error: "All fields are required: name, username, password, lat, long",
      });
      return;
    }

    const latNum = parseFloat(lat);
    const longNum = parseFloat(long);

    if (isNaN(latNum) || isNaN(longNum)) {
      res.status(400).json({ error: "Invalid latitude or longitude values" });
      return;
    }

    // Validate latitude and longitude ranges
    if (latNum < -90 || latNum > 90) {
      res.status(400).json({ error: "Latitude must be between -90 and 90" });
      return;
    }

    if (longNum < -180 || longNum > 180) {
      res.status(400).json({ error: "Longitude must be between -180 and 180" });
      return;
    }

    const barber = await createBarber(
      name,
      username,
      password,
      latNum,
      longNum
    );
    const token = jwt.sign({ sub: barber.id, role: "BARBER" }, JWT_SECRET!, {
      expiresIn: "8h",
    });

    res.status(201).json({
      barber,
      msg: "Barber Created Successfully",
      token,
    });
  } catch (error) {
    console.error("Barber signup error:", error);

    // Handle unique constraint violation
    if (getErrorCode(error) === "P2002") {
      res.status(409).json({ msg: "Username already exists" });
      return;
    }

    res.status(500).json({
      msg: "Error occurred during barber signup",
      error: getErrorMessage(error),
    });
  }
});

// Barber signin
router.post("/signin", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const barber = await authenticateBarber(username, password);

    if (!barber) {
      res.status(401).json({ msg: "Invalid username or password" });
      return;
    }

    const token = jwt.sign({ sub: barber.id, role: "BARBER" }, JWT_SECRET!, {
      expiresIn: "8h",
    });

    res.json({
      barber,
      msg: "Barber Signed In Successfully",
      token,
    });
  } catch (error) {
    console.error("Barber signin error:", error);
    res.status(500).json({
      msg: "Error occurred during barber sign in",
      error: getErrorMessage(error),
    });
  }
});

// Get barber's queue
router.get(
  "/queue",
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const barberId = req.user?.id;

      if (!barberId) {
        res.status(401).json({ error: "Barber not authenticated" });
        return;
      }

      // Verify this is a barber making the request
      if (req.user?.role !== "BARBER") {
        res.status(403).json({ error: "Access denied. Barber role required." });
        return;
      }

      const queue = await getQueue(barberId);

      res.json({
        barberId,
        queueLength: queue.length,
        queue: queue.map((entry, index) => ({
          position: index + 1,
          queueId: entry.id,
          user: entry.user,
          service: entry.service || "haircut", // Fallback for old entries
          enteredAt: entry.enteredAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching barber queue:", error);
      res.status(500).json({
        error: "Internal server error",
        details: getErrorMessage(error),
      });
    }
  }
);

// Remove user from queue (barber action)
router.post(
  "/remove-user",
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const barberId = req.user?.id;
      const { userId } = req.body;

      if (!barberId) {
        res.status(401).json({ error: "Barber not authenticated" });
        return;
      }

      if (req.user?.role !== "BARBER") {
        res.status(403).json({ error: "Access denied. Barber role required." });
        return;
      }

      if (!userId) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      const result = await removeUserFromQueue(barberId, userId);

      if (!result.success) {
        res.status(400).json({ msg: result.message });
        return;
      }

      res.json({
        msg: "User removed from queue successfully",
        data: result.data,
      });
    } catch (error) {
      console.error("Error removing user from queue:", error);
      res.status(500).json({
        error: "Internal server error",
        details: getErrorMessage(error),
      });
    }
  }
);

// IMPORTANT: Default export
export default router;
