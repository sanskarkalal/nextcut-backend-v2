// src/services/userServices.ts
import prisma from "../db";
import bcrypt from "bcrypt";

export async function createUser(
  name: string,
  email: string,
  password: string
) {
  try {
    console.log(`Creating user with email: ${email}`);
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });
    console.log(`User created successfully with ID: ${user.id}`);
    return user;
  } catch (error) {
    console.error("Error creating user:", error);
    throw new Error("Failed to create user");
  }
}

export async function authenticateUser(email: string, password: string) {
  try {
    console.log(`Attempting to authenticate user with email: ${email}`);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      console.log(`User not found with email: ${email}`);
      return null;
    }

    console.log(`User found, checking password for user ID: ${user.id}`);

    // Compare password
    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      console.log(`Invalid password for user: ${email}`);
      return null;
    }

    console.log(`Authentication successful for user: ${email}`);

    // Return only the fields you want exposed
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  } catch (error) {
    console.error("Error authenticating user:", error);
    throw new Error("Failed to authenticate user");
  }
}

export async function joinQueue(barberId: number, userId: number) {
  try {
    // Check if barber exists
    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barber) {
      throw new Error("Barber not found");
    }

    const [, , entry] = await prisma.$transaction([
      // 1) Remove any existing queue rows for this user
      prisma.queue.deleteMany({ where: { userId } }),

      // 2) Reset the user's queue flags
      prisma.user.update({
        where: { id: userId },
        data: { inQueue: false, queuedBarberId: null },
      }),

      // 3) Create the new queue entry
      prisma.queue.create({
        data: { barberId, userId },
        include: {
          user: { select: { id: true, name: true } },
          barber: { select: { id: true, name: true } },
        },
      }),

      // 4) Mark the user as in‐queue at this barber
      prisma.user.update({
        where: { id: userId },
        data: { inQueue: true, queuedBarberId: barberId },
      }),
    ]);

    return entry;
  } catch (error) {
    console.error("Error joining queue:", error);
    throw new Error("Failed to join queue");
  }
}

export async function removeFromQueue(userId: number) {
  try {
    // Check if user is in a queue
    const existingQueueEntry = await prisma.queue.findUnique({
      where: { userId },
      include: {
        barber: { select: { id: true, name: true } },
      },
    });

    if (!existingQueueEntry) {
      return {
        success: false,
        message: "You are not currently in any queue",
        data: null,
      };
    }

    // Remove user from queue in a transaction
    const [deletedEntry] = await prisma.$transaction([
      // 1) Delete the queue entry
      prisma.queue.delete({
        where: { userId },
        include: {
          barber: { select: { id: true, name: true } },
        },
      }),

      // 2) Update user's queue status
      prisma.user.update({
        where: { id: userId },
        data: {
          inQueue: false,
          queuedBarberId: null,
        },
      }),
    ]);

    return {
      success: true,
      message: `Successfully removed from ${deletedEntry.barber.name}'s queue`,
      data: {
        removedFrom: deletedEntry.barber,
        removedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Error removing from queue:", error);
    throw new Error("Failed to remove from queue");
  }
}

export async function getUserQueueStatus(userId: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        inQueue: true,
        queuedBarberId: true,
        Queue: {
          include: {
            barber: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.inQueue || !user.Queue) {
      return {
        inQueue: false,
        queuePosition: null,
        barber: null,
        enteredAt: null,
      };
    }

    // Get position in queue
    const position = await prisma.queue.count({
      where: {
        barberId: user.queuedBarberId!,
        enteredAt: {
          lt: user.Queue.enteredAt,
        },
      },
    });

    return {
      inQueue: true,
      queuePosition: position + 1, // +1 because count starts at 0
      barber: user.Queue.barber,
      enteredAt: user.Queue.enteredAt,
    };
  } catch (error) {
    console.error("Error getting user queue status:", error);
    throw new Error("Failed to get queue status");
  }
}

// Constants for distance calculation
const EARTH_RADIUS_KM = 6371;

// Compute distance between two points (in km)
function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Find barbers within a given radius (km) of a point.
 */
export async function getBarbersNearby(
  lat: number,
  long: number,
  radiusKm = 5
) {
  try {
    // Validate inputs
    if (lat < -90 || lat > 90 || long < -180 || long > 180) {
      throw new Error("Invalid latitude or longitude");
    }

    if (radiusKm <= 0) {
      throw new Error("Radius must be positive");
    }

    // 1) Rough bounding box (lat ±, lon ±)
    const latDelta = radiusKm / 111; // ~1° lat ≈ 111 km
    const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLon = long - lonDelta;
    const maxLon = long + lonDelta;

    // 2) Fetch candidates in bounding box
    const candidates = await prisma.barber.findMany({
      where: {
        lat: { gte: minLat, lte: maxLat },
        long: { gte: minLon, lte: maxLon },
      },
      select: {
        id: true,
        name: true,
        username: true,
        lat: true,
        long: true,
        createdAt: true,
        queueEntries: {
          select: {
            id: true,
            enteredAt: true,
            user: { select: { id: true, name: true } },
          },
          orderBy: { enteredAt: "asc" },
        },
      },
    });

    // 3) Filter by actual circle distance and add queue info
    const nearbyBarbers = candidates
      .map((barber) => ({
        ...barber,
        distanceKm: haversine(lat, long, barber.lat, barber.long),
        queueLength: barber.queueEntries.length,
        // Don't expose individual queue entries for privacy
        queueEntries: undefined,
      }))
      .filter((barber) => barber.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    console.log(`Found ${nearbyBarbers.length} barbers within ${radiusKm}km`);

    return nearbyBarbers;
  } catch (error) {
    console.error("Error getting nearby barbers:", error);
    throw new Error("Failed to get nearby barbers");
  }
}
