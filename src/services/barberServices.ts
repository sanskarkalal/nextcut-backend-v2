// src/services/barberServices.ts
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
    include: { user: { select: { id: true; name: true } } };
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
      include: { user: { select: { id: true, name: true } } },
    });
  } catch (error) {
    console.error("Error getting queue:", error);
    throw new Error("Failed to get queue");
  }
}

export async function removeUserFromQueue(barberId: number, userId: number) {
  try {
    // Check if the queue entry exists and belongs to this barber
    const queueEntry = await prisma.queue.findFirst({
      where: {
        barberId,
        userId,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    if (!queueEntry) {
      return {
        success: false,
        message: "User is not in this barber's queue",
        data: null,
      };
    }

    // Remove user from queue in a transaction
    const [deletedEntry] = await prisma.$transaction([
      // 1) Delete the queue entry
      prisma.queue.delete({
        where: { id: queueEntry.id },
        include: {
          user: { select: { id: true, name: true } },
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
      message: `Successfully removed ${deletedEntry.user.name} from queue`,
      data: {
        removedUser: deletedEntry.user,
        removedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Error removing user from queue:", error);
    throw new Error("Failed to remove user from queue");
  }
}
