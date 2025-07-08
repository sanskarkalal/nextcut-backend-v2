// src/routes/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import "dotenv/config";

const JWT_SECRET = process.env.JWT_SECRET!;

// Extend Request interface to include user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email?: string;
    role?: string;
  };
}

export function authenticateJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;

    // Attach user info to request object
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    console.log("JWT payload:", payload);
    console.log("Passed JWT auth middleware");
    next();
  } catch (error) {
    console.error("JWT verification failed:", error);
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
}
