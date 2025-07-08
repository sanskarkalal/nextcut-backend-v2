-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inQueue" BOOLEAN NOT NULL DEFAULT false,
    "queuedBarberId" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Barber" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "long" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Barber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Queue" (
    "id" SERIAL NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "barberId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_queuedBarberId_idx" ON "User"("queuedBarberId");

-- CreateIndex
CREATE UNIQUE INDEX "Barber_username_key" ON "Barber"("username");

-- CreateIndex
CREATE INDEX "Queue_barberId_enteredAt_idx" ON "Queue"("barberId", "enteredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Queue_userId_key" ON "Queue"("userId");

-- AddForeignKey
ALTER TABLE "Queue" ADD CONSTRAINT "Queue_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Queue" ADD CONSTRAINT "Queue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
