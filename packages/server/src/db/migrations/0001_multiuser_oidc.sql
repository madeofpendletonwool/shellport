ALTER TABLE `users` ADD COLUMN `email` text;
--> statement-breakpoint
CREATE TABLE `oidc_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`issuer` text NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text NOT NULL,
	`scopes` text NOT NULL DEFAULT 'openid email profile',
	`default_role` text NOT NULL DEFAULT 'user',
	`enabled` integer NOT NULL DEFAULT 1,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oidc_providers_issuer_unique` ON `oidc_providers` (`issuer`);
--> statement-breakpoint
CREATE TABLE `oidc_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`provider_id` text NOT NULL,
	`subject` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	FOREIGN KEY (`provider_id`) REFERENCES `oidc_providers`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oidc_identities_provider_subject` ON `oidc_identities` (`provider_id`, `subject`);
--> statement-breakpoint
CREATE TABLE `oidc_states` (
	`state` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `oidc_providers`(`id`) ON DELETE CASCADE
);
