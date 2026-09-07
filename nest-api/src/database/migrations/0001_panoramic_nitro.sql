CREATE TABLE IF NOT EXISTS `topbar_announcements` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`icon` varchar(100),
	`link_url` varchar(500),
	`status` enum('inactive','active') NOT NULL DEFAULT 'active',
	CONSTRAINT `topbar_announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `carts` MODIFY COLUMN `price` decimal(10,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `categories` ADD `hsn` varchar(15);--> statement-breakpoint
ALTER TABLE `categories` ADD `cgst` decimal(5,2);--> statement-breakpoint
ALTER TABLE `categories` ADD `sgst` decimal(5,2);--> statement-breakpoint
ALTER TABLE `categories` ADD `igst` decimal(5,2);