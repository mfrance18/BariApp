ALTER TABLE `vitamins_meds` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `vitamins_meds` SET `sort_order` = `id`;