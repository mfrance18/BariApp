ALTER TABLE `foods` ADD `serving_amount` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `foods` ADD `serving_unit` text DEFAULT 'g' NOT NULL;--> statement-breakpoint
-- Old per_serving foods are migrated to the generic non-weighable unit
-- "serving" (amount 1) rather than carrying over their gram-based serving
-- size as a "g"/"oz" unit — the whole point of per_serving foods was to
-- skip weighing at log time, and a food stored as e.g. "591 g" would
-- otherwise become weighable again post-migration, silently undoing that.
-- Their nutrition values already represent "per 1 serving", so no rescaling
-- is needed — only per_100g foods keep a real weight unit. The old columns
-- (basis_type, serving_size_g, ...) are kept until 0003 has used them to
-- backfill meal_log_entries, then dropped there.
UPDATE `foods` SET
  `serving_amount` = CASE
    WHEN `basis_type` = 'per_100g' THEN 100
    ELSE 1
  END,
  `serving_unit` = CASE
    WHEN `basis_type` = 'per_100g' THEN 'g'
    ELSE 'serving'
  END;
