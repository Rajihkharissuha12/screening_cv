-- CreateTable
CREATE TABLE "Screeningcv" (
    "id" SERIAL NOT NULL,
    "tanggal" TEXT NOT NULL,
    "nama_file" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "url_cv" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Screeningcv_pkey" PRIMARY KEY ("id")
);
