// src/routes/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import "dotenv/config";

const JWT_SECRET = process.env.JWT_SECRET!;

// Updated interface to support both old and new JWT structures
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email?: string;
    phoneNumber?: string;
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

    // Support both old JWT structure (email-based) and new structure (phone-based)
    req.user = {
      id: payload.sub, // JWT standard uses 'sub' for user ID
      email: payload.email, // For backward compatibility
      phoneNumber: payload.phoneNumber, // For new phone-based auth
      role: payload.role,
    };

    console.log("JWT payload:", payload);
    console.log("Authenticated user:", req.user);
    next();
  } catch (error) {
    console.error("JWT verification failed:", error);
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
}
