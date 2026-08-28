-- A progress update can carry several photos.
--
-- The single imageUrl is folded into the new array before the column is
-- dropped, so updates that already have a photo keep it.

ALTER TABLE "ProgressEntry"
  ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "ProgressEntry"
  SET "imageUrls" = ARRAY["imageUrl"]
  WHERE "imageUrl" IS NOT NULL AND "imageUrl" <> '';

ALTER TABLE "ProgressEntry" DROP COLUMN "imageUrl";
