-- Simplify UserRole enum: remove super_admin and operator
-- super_admin capabilities merged into admin
-- operator capabilities merged into developer

-- Step 1: Migrate existing users to the consolidated roles
UPDATE "User" SET "role" = 'admin' WHERE "role" = 'super_admin';
UPDATE "User" SET "role" = 'developer' WHERE "role" = 'operator';

-- Step 2: Drop the default before changing the type
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

-- Step 3: Create new enum without the removed values
CREATE TYPE "UserRole_new" AS ENUM ('admin', 'developer', 'viewer');

-- Step 4: Swap the enum
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- Step 5: Re-set the default
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'viewer'::"UserRole";
