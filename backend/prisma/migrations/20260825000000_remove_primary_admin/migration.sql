-- Migration: Remove PRIMARY_ADMIN from UserRole enum safely
-- Step 1: Update any existing PRIMARY_ADMIN users to ADMIN
UPDATE "User" SET "role" = 'ADMIN' WHERE "role"::text = 'PRIMARY_ADMIN';

-- Step 2: Create new enum type without PRIMARY_ADMIN
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'USER');

-- Step 3: Update User table default value and column type
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER'::"UserRole_new";

-- Step 4: Drop old enum type and rename new enum type
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
