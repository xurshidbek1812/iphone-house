/*
  Warnings:

  - You are about to drop the column `mfyId` on the `CustomerAddress` table. All the data in the column will be lost.
  - You are about to drop the `MFY` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MFY" DROP CONSTRAINT "MFY_districtId_fkey";

-- AlterTable
ALTER TABLE "CustomerAddress" DROP COLUMN "mfyId",
ADD COLUMN     "mfy" TEXT;

-- DropTable
DROP TABLE "MFY";
