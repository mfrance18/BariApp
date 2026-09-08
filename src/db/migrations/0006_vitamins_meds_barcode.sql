ALTER TABLE `vitamins_meds` ADD `barcode` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_vitamins_meds_barcode` ON `vitamins_meds` (`barcode`);
