-- Foods are now hard-deleted instead of soft-deleted, so the archived_at
-- column no longer has any purpose. deleteFood() (src/db/repositories/foodsRepo.ts)
-- refuses to delete a food still used by an active recipe rather than
-- leaving a dangling reference; a food used only in historical meal log
-- entries can still be deleted since those entries already snapshot their
-- own nutrition and fall back to "Unknown food" for display (see
-- listEntriesForDate in src/db/repositories/mealLogRepo.ts).
ALTER TABLE `foods` DROP COLUMN `archived_at`;
