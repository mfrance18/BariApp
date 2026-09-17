PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_med_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`med_schedule_id` integer NOT NULL,
	`scheduled_date` text NOT NULL,
	`status` text,
	`taken_at` text,
	`rescheduled_time_of_day` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`med_schedule_id`) REFERENCES `med_schedule`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_med_log`("id", "med_schedule_id", "scheduled_date", "status", "taken_at", "created_at") SELECT "id", "med_schedule_id", "scheduled_date", "status", "taken_at", "created_at" FROM `med_log`;--> statement-breakpoint
DROP TABLE `med_log`;--> statement-breakpoint
ALTER TABLE `__new_med_log` RENAME TO `med_log`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_med_log_schedule_date` ON `med_log` (`med_schedule_id`,`scheduled_date`);