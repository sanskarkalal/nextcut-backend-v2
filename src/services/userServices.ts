// src/services/userServices.ts - Complete User Services
import { Prisma } from "@prisma/client";
import prisma from "../db";
import bcrypt from "bcrypt";

export interface UserDTO {
  id: number;
  name: string;
  phoneNumber: string;
}

// Function to calculate distance between two coordinates
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

export async function createUser(
  name: string,
  phoneNumber: string
): Promise<UserDTO> {
  try {
    console.log("Creating user with data:", {
      name,
      phoneNumber,
    });

    const user = await prisma.user.create({
      data: { name, phoneNumber },
    });

    console.log("User created:", user);
    return {
      id: user.id,
      name: user.name,
      phoneNumber: user.phoneNumber,
    };
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
}

export async function authenticateUser(
  phoneNumber: string
): Promise<UserDTO | null> {
  try {
    const user = await prisma.user.findUnique({ where: { phoneNumber } });

    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      phoneNumber: user.phoneNumber,
    };
  } catch (error) {
    console.error("Error authenticating user:", error);
    throw new Error("Failed to authenticate user");
  }
}

export async function joinQueue(
  barberId: number,
  userId: number,
  service: string
) {
  try {
    // Check if barber exists
    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barber) {
      throw new Error("Barber not found");
    }

    // Validate service type
    const validServices = ["haircut", "beard", "haircut+beard"];
    if (!validServices.includes(service)) {
      throw new Error("Invalid service type");
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
        data: { barberId, userId, service },
        include: {
          user: { select: { id: true, name: true, phoneNumber: true } },
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
        message: "User is not in any queue",
        data: null,
      };
    }

    // Remove from queue and update user status
    await prisma.$transaction([
      prisma.queue.delete({ where: { userId } }),
      prisma.user.update({
        where: { id: userId },
        data: { inQueue: false, queuedBarberId: null },
      }),
    ]);

    return {
      success: true,
      message: "Successfully removed from queue",
      data: {
        barberId: existingQueueEntry.barberId,
        barberName: existingQueueEntry.barber.name,
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
      include: {
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
        position: null,
        barber: null,
        estimatedWait: null,
        service: null,
      };
    }

    // Get queue position
    const queuePosition = await prisma.queue.count({
      where: {
        barberId: user.queuedBarberId!,
        enteredAt: { lt: user.Queue.enteredAt },
      },
    });

    // Estimate wait time (15 minutes per person ahead)
    const estimatedWaitMinutes = queuePosition * 15;

    return {
      inQueue: true,
      position: queuePosition + 1,
      barber: user.Queue.barber,
      estimatedWait: estimatedWaitMinutes,
      service: user.Queue.service,
      enteredAt: user.Queue.enteredAt,
    };
  } catch (error) {
    console.error("Error getting queue status:", error);
    throw new Error("Failed to get queue status");
  }
}

export async function getBarbersNearby(
  userLat: number,
  userLong: number,
  radiusKm: number = 10
) {
  try {
    const allBarbers = await prisma.barber.findMany({
      include: {
        queueEntries: {
          orderBy: { enteredAt: "asc" },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    const barbersWithDistance = allBarbers.map((barber) => {
      const distance = calculateDistance(
        userLat,
        userLong,
        barber.lat,
        barber.long
      );

      return {
        id: barber.id,
        name: barber.name,
        lat: barber.lat,
        long: barber.long,
        distance: Math.round(distance * 10) / 10, // Round to 1 decimal
        queueLength: barber.queueEntries.length,
        estimatedWait: barber.queueEntries.length * 15, // 15 minutes per person
        queue: barber.queueEntries.map((entry, index) => ({
          position: index + 1,
          user: entry.user,
          service: entry.service,
          enteredAt: entry.enteredAt,
        })),
      };
    });

    // Filter by radius and sort by distance
    const nearbyBarbers = barbersWithDistance
      .filter((barber) => barber.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    return nearbyBarbers;
  } catch (error) {
    console.error("Error getting nearby barbers:", error);
    throw new Error("Failed to get nearby barbers");
  }
}
