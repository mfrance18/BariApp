-- 0009 shipped two ALTER TABLE statements without a statement-breakpoint
-- between them, so drizzle's expo-sqlite migrator (which splits migration
-- files only on that marker) ran them as one combined string — SQLite's
-- prepare step silently executes just the first statement and drops the
-- rest, so `ble_scale_device_id` was added but `ble_scale_device_name`
-- never was on any device that already ran 0009. Rebuilding the table with
-- the full correct schema (rather than another ALTER TABLE ADD COLUMN,
-- which SQLite has no "IF NOT EXISTS" form for) fixes already-affected
-- devices and is a no-op-equivalent for anyone running every migration
-- fresh, since `ble_scale_device_name` is left NULL either way — nobody
-- has successfully paired a scale yet.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_app_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`daily_fluid_goal_ml` real DEFAULT 1500 NOT NULL,
	`daily_protein_goal_g` real DEFAULT 60 NOT NULL,
	`daily_calorie_goal` real DEFAULT 1000 NOT NULL,
	`vesync_email` text,
	`vesync_connected` integer DEFAULT false NOT NULL,
	`weight_unit` text DEFAULT 'lb' NOT NULL,
	`theme_accent` text DEFAULT 'blue' NOT NULL,
	`theme_base` text DEFAULT 'blue' NOT NULL,
	`ble_scale_device_id` text,
	`ble_scale_device_name` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_app_settings` ("id", "daily_fluid_goal_ml", "daily_protein_goal_g", "daily_calorie_goal", "vesync_email", "vesync_connected", "weight_unit", "theme_accent", "theme_base", "ble_scale_device_id", "created_at", "updated_at")
SELECT "id", "daily_fluid_goal_ml", "daily_protein_goal_g", "daily_calorie_goal", "vesync_email", "vesync_connected", "weight_unit", "theme_accent", "theme_base", "ble_scale_device_id", "created_at", "updated_at" FROM `app_settings`;--> statement-breakpoint
DROP TABLE `app_settings`;--> statement-breakpoint
ALTER TABLE `__new_app_settings` RENAME TO `app_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
