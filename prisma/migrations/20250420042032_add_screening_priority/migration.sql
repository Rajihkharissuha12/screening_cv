-- CreateTable
CREATE TABLE "Prioritycv" (
    "id" SERIAL NOT NULL,
    "tanggal" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prioritycv_pkey" PRIMARY KEY ("id")
);
