// src/services/barberServices.ts - Complete Barber Services
import { Prisma } from "@prisma/client";
import prisma from "../db";
import bcrypt from "bcrypt";

export interface BarberDTO {
  id: number;
  name: string;
  username: string;
  lat: number;
  long: number;
}

export async function createBarber(
  name: string,
  username: string,
  password: string,
  lat: number,
  long: number
): Promise<BarberDTO> {
  try {
    console.log("Creating barber with data:", {
      name,
      username,
      lat,
      long,
    });

    const passwordHash = await bcrypt.hash(password, 10);
    const barber = await prisma.barber.create({
      data: { name, username, passwordHash, lat, long },
    });

    console.log("Barber created:", barber);
    return {
      id: barber.id,
      name: barber.name,
      username: barber.username,
      lat: barber.lat,
      long: barber.long,
    };
  } catch (error) {
    console.error("Error creating barber:", error);
    throw error; // Re-throw to handle in route
  }
}

export async function authenticateBarber(
  username: string,
  password: string
): Promise<BarberDTO | null> {
  try {
    const barber = await prisma.barber.findUnique({ where: { username } });

    if (!barber) return null;

    const valid = await bcrypt.compare(password, barber.passwordHash);

    if (!valid) return null;

    return {
      id: barber.id,
      name: barber.name,
      username: barber.username,
      lat: barber.lat,
      long: barber.long,
    };
  } catch (error) {
    console.error("Error authenticating barber:", error);
    throw new Error("Failed to authenticate barber");
  }
}

export async function getQueue(barberId: number): Promise<
  Prisma.QueueGetPayload<{
    include: { user: { select: { id: true; name: true; phoneNumber: true } } };
  }>[]
> {
  try {
    // Verify barber exists
    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barber) {
      throw new Error("Barber not found");
    }

    return prisma.queue.findMany({
      where: { barberId },
      orderBy: { enteredAt: "asc" },
      include: {
        user: { select: { id: true, name: true, phoneNumber: true } },
      },
    });
  } catch (error) {
    console.error("Error getting queue:", error);
    throw new Error("Failed to get queue");
  }
}

export async function removeUserFromQueue(barberId: number, userId: number) {
  try {
    // Check if the queue entry exists and belongs to this barber
    const queueEntry = await prisma.queue.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, phoneNumber: true } },
        barber: { select: { id: true, name: true } },
      },
    });

    if (!queueEntry) {
      return {
        success: false,
        message: "User is not in any queue",
        data: null,
      };
    }

    // Verify the barber has permission to remove this user
    if (queueEntry.barberId !== barberId) {
      return {
        success: false,
        message: "You can only remove users from your own queue",
        data: null,
      };
    }

    // Create service history entry
    await prisma.serviceHistory.create({
      data: {
        barberId: barberId,
        userId: userId,
        service: queueEntry.service,
      },
    });

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
      message: "User served and removed from queue successfully",
      data: {
        user: queueEntry.user,
        service: queueEntry.service,
        servedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error removing user from queue:", error);
    throw new Error("Failed to remove user from queue");
  }
}

export async function getBarberStats(barberId: number) {
  try {
    // Verify barber exists
    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barber) {
      throw new Error("Barber not found");
    }

    const currentQueue = await prisma.queue.count({
      where: { barberId },
    });

    const totalServiced = await prisma.serviceHistory.count({
      where: { barberId },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayServiced = await prisma.serviceHistory.count({
      where: {
        barberId,
        servedAt: { gte: todayStart },
      },
    });

    const recentServices = await prisma.serviceHistory.findMany({
      where: { barberId },
      orderBy: { servedAt: "desc" },
      take: 10,
      include: {
        user: { select: { id: true, name: true, phoneNumber: true } },
      },
    });

    return {
      currentQueueLength: currentQueue,
      totalCustomersServiced: totalServiced,
      todayCustomersServiced: todayServiced,
      estimatedWaitTime: currentQueue * 15, // 15 minutes per customer
      recentServices,
    };
  } catch (error) {
    console.error("Error getting barber stats:", error);
    throw new Error("Failed to get barber statistics");
  }
}
