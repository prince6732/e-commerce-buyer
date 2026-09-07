import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/mysql2';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import * as mysql from 'mysql2/promise';
import * as schema from './schema';
import { getDbConfig } from './db-config';

export const DRIZZLE = 'DRIZZLE_CONNECTION';

export type DrizzleDB = MySql2Database<typeof schema>;

const logger = new Logger('DatabaseProvider');

export const databaseProvider: Provider = {
  provide: DRIZZLE,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const dbConfig = getDbConfig();
    const hasUrlConfig = Boolean(
      configService.get<string>('MASTER_DATABASE_URL') ||
      configService.get<string>('DATABASE_URL') ||
      configService.get<string>('DB_URL') ||
      process.env.MASTER_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.DB_URL
    );

    const host = hasUrlConfig ? dbConfig.host : configService.get<string>('DB_HOST', dbConfig.host);
    const port = hasUrlConfig ? dbConfig.port : configService.get<number>('DB_PORT', dbConfig.port);
    const user = hasUrlConfig ? dbConfig.user : configService.get<string>('DB_USERNAME', dbConfig.user);
    const password = hasUrlConfig ? dbConfig.password : configService.get<string>('DB_PASSWORD', dbConfig.password);
    const database = hasUrlConfig ? dbConfig.database : configService.get<string>('DB_DATABASE', dbConfig.database);

    const connection = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: '+05:30',
    });

    try {
      (connection as any).pool?.on('connection', (conn: any) => {
        conn.query("SET time_zone = '+05:30'");
      });
      await connection.query("SET time_zone = '+05:30'").catch(() => {});
      await connection.query("SET GLOBAL time_zone = '+05:30'").catch(() => {});
    } catch (tzErr: any) {
      logger.warn(`Could not set database timezone: ${tzErr.message}`);
    }

    // Auto-create/sync notification tables & columns if not exist in MySQL
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`notifications\` (
          \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
          \`user_id\` bigint unsigned DEFAULT NULL,
          \`recipient_group\` varchar(50) NOT NULL DEFAULT 'admin',
          \`title\` varchar(255) NOT NULL,
          \`message\` text NOT NULL,
          \`type\` varchar(50) NOT NULL DEFAULT 'system',
          \`priority\` varchar(20) NOT NULL DEFAULT 'NORMAL',
          \`entity_type\` varchar(50) DEFAULT NULL,
          \`entity_id\` bigint unsigned DEFAULT NULL,
          \`link\` varchar(500) DEFAULT NULL,
          \`is_read\` boolean NOT NULL DEFAULT false,
          \`read_at\` timestamp NULL DEFAULT NULL,
          \`reference_key\` varchar(255) DEFAULT NULL,
          \`metadata\` json DEFAULT NULL,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Add missing columns if notifications table existed previously without them
      const [cols]: any = await connection.query(`SHOW COLUMNS FROM \`notifications\``);
      const colNames = (cols || []).map((c: any) => c.Field);

      if (!colNames.includes('recipient_group')) {
        await connection.query(`ALTER TABLE \`notifications\` ADD COLUMN \`recipient_group\` varchar(50) NOT NULL DEFAULT 'admin'`);
      }
      if (!colNames.includes('priority')) {
        await connection.query(`ALTER TABLE \`notifications\` ADD COLUMN \`priority\` varchar(20) NOT NULL DEFAULT 'NORMAL'`);
      }
      if (!colNames.includes('entity_type')) {
        await connection.query(`ALTER TABLE \`notifications\` ADD COLUMN \`entity_type\` varchar(50) DEFAULT NULL`);
      }
      if (!colNames.includes('entity_id')) {
        await connection.query(`ALTER TABLE \`notifications\` ADD COLUMN \`entity_id\` bigint unsigned DEFAULT NULL`);
      }
      if (!colNames.includes('read_at')) {
        await connection.query(`ALTER TABLE \`notifications\` ADD COLUMN \`read_at\` timestamp NULL DEFAULT NULL`);
      }
      if (!colNames.includes('reference_key')) {
        await connection.query(`ALTER TABLE \`notifications\` ADD COLUMN \`reference_key\` varchar(255) DEFAULT NULL`);
      }

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`notification_preferences\` (
          \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
          \`user_id\` bigint unsigned NOT NULL UNIQUE,
          \`in_app_orders\` boolean NOT NULL DEFAULT true,
          \`in_app_payments\` boolean NOT NULL DEFAULT true,
          \`in_app_shipping\` boolean NOT NULL DEFAULT true,
          \`in_app_returns\` boolean NOT NULL DEFAULT true,
          \`in_app_products\` boolean NOT NULL DEFAULT true,
          \`in_app_marketing\` boolean NOT NULL DEFAULT true,
          \`email_orders\` boolean NOT NULL DEFAULT true,
          \`email_payments\` boolean NOT NULL DEFAULT true,
          \`email_shipping\` boolean NOT NULL DEFAULT true,
          \`email_returns\` boolean NOT NULL DEFAULT true,
          \`email_products\` boolean NOT NULL DEFAULT true,
          \`email_marketing\` boolean NOT NULL DEFAULT true,
          \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`admin_notification_preferences\` (
          \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
          \`user_id\` bigint unsigned NOT NULL UNIQUE,
          \`in_app_orders\` boolean NOT NULL DEFAULT true,
          \`in_app_payments\` boolean NOT NULL DEFAULT true,
          \`in_app_inventory\` boolean NOT NULL DEFAULT true,
          \`in_app_returns\` boolean NOT NULL DEFAULT true,
          \`in_app_shipping\` boolean NOT NULL DEFAULT true,
          \`in_app_customers\` boolean NOT NULL DEFAULT true,
          \`in_app_system\` boolean NOT NULL DEFAULT true,
          \`email_orders\` boolean NOT NULL DEFAULT false,
          \`email_payments\` boolean NOT NULL DEFAULT true,
          \`email_inventory\` boolean NOT NULL DEFAULT true,
          \`email_returns\` boolean NOT NULL DEFAULT true,
          \`email_shipping\` boolean NOT NULL DEFAULT true,
          \`email_customers\` boolean NOT NULL DEFAULT true,
          \`email_system\` boolean NOT NULL DEFAULT true,
          \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`carts\` (
          \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
          \`user_id\` bigint unsigned NOT NULL,
          \`product_id\` bigint unsigned NOT NULL,
          \`variant_id\` bigint unsigned NOT NULL,
          \`quantity\` int NOT NULL DEFAULT 1,
          \`price\` decimal(10,2) DEFAULT '0.00',
          \`selected_attributes\` json DEFAULT NULL,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      try {
        const [cartCols]: any = await connection.query(`SHOW COLUMNS FROM \`carts\``);
        const cartColNames = (cartCols || []).map((c: any) => c.Field);
        if (cartColNames.includes('price')) {
          await connection.query(`ALTER TABLE \`carts\` MODIFY COLUMN \`price\` decimal(10,2) DEFAULT '0.00'`);
        } else {
          await connection.query(`ALTER TABLE \`carts\` ADD COLUMN \`price\` decimal(10,2) DEFAULT '0.00'`);
        }
        if (!cartColNames.includes('selected_attributes')) {
          await connection.query(`ALTER TABLE \`carts\` ADD COLUMN \`selected_attributes\` json DEFAULT NULL`);
        }
      } catch (colErr: any) {
        logger.warn(`Carts column sync note: ${colErr.message}`);
      }

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`topbar_announcements\` (
          \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
          \`title\` varchar(255) NOT NULL,
          \`icon\` varchar(100) DEFAULT NULL,
          \`link_url\` varchar(500) DEFAULT NULL,
          \`status\` enum('inactive', 'active') NOT NULL DEFAULT 'active',
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Auto-create Return Requests table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`return_requests\` (
          \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
          \`return_number\` varchar(255) NOT NULL UNIQUE,
          \`order_id\` bigint unsigned NOT NULL,
          \`user_id\` bigint unsigned NOT NULL,
          \`status\` enum('requested','approved','rejected','pickup_scheduled','picked_up','in_transit','received_at_warehouse','qc_pending','qc_passed','qc_failed','refund_pending','refund_processing','refunded','exchange_processing','completed','cancelled') NOT NULL DEFAULT 'requested',
          \`return_type\` enum('return','exchange') NOT NULL DEFAULT 'return',
          \`reason\` enum('defective_damaged','wrong_item_received','size_fit_issue','quality_not_expected','different_from_description','missing_parts','product_not_as_expected','other') NOT NULL DEFAULT 'defective_damaged',
          \`reason_details\` text DEFAULT NULL,
          \`customer_images\` json DEFAULT NULL,
          \`refund_mode\` enum('original_source','bank_transfer_upi','store_credit','manual_cash') NOT NULL DEFAULT 'original_source',
          \`refund_status\` enum('not_applicable','pending','processing','processed','failed','cancelled') NOT NULL DEFAULT 'pending',
          \`bank_details\` json DEFAULT NULL,
          \`pickup_address\` json DEFAULT NULL,
          \`reverse_waybill\` varchar(255) DEFAULT NULL,
          \`reverse_courier_name\` varchar(255) DEFAULT 'Delhivery Reverse',
          \`reverse_pickup_date\` timestamp NULL DEFAULT NULL,
          \`refund_amount\` decimal(10,2) DEFAULT '0.00',
          \`refund_transaction_id\` varchar(255) DEFAULT NULL,
          \`refund_failure_reason\` text DEFAULT NULL,
          \`refund_attempts\` int NOT NULL DEFAULT 0,
          \`refunded_at\` timestamp NULL DEFAULT NULL,
          \`qc_status\` enum('pending','passed','failed') NOT NULL DEFAULT 'pending',
          \`qc_remarks\` text DEFAULT NULL,
          \`qc_passed_at\` timestamp NULL DEFAULT NULL,
          \`qc_failed_at\` timestamp NULL DEFAULT NULL,
          \`exchange_requested\` boolean NOT NULL DEFAULT false,
          \`replacement_order_id\` bigint unsigned DEFAULT NULL,
          \`admin_notes\` text DEFAULT NULL,
          \`rejection_reason\` text DEFAULT NULL,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_return_order_id\` (\`order_id\`),
          KEY \`idx_return_user_id\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Auto-create Return Request Items table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`return_request_items\` (
          \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
          \`return_request_id\` bigint unsigned NOT NULL,
          \`order_item_id\` bigint unsigned NOT NULL,
          \`product_id\` bigint unsigned NOT NULL,
          \`variant_id\` bigint unsigned NOT NULL,
          \`quantity\` int NOT NULL,
          \`price\` decimal(10,2) NOT NULL,
          \`exchange_variant_id\` bigint unsigned DEFAULT NULL,
          \`qc_status\` enum('pending','passed','failed') NOT NULL DEFAULT 'pending',
          \`qc_remarks\` text DEFAULT NULL,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_rri_return_id\` (\`return_request_id\`),
          KEY \`idx_rri_order_item_id\` (\`order_item_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Auto-create Return Tracking Events table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`return_tracking_events\` (
          \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
          \`return_request_id\` bigint unsigned NOT NULL,
          \`waybill\` varchar(255) NOT NULL,
          \`status\` varchar(255) NOT NULL,
          \`status_code\` varchar(100) DEFAULT NULL,
          \`location\` varchar(255) DEFAULT NULL,
          \`description\` text DEFAULT NULL,
          \`event_time\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`raw_response\` json DEFAULT NULL,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_rte_return_id\` (\`return_request_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Auto-create RTO Cases table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`rto_cases\` (
          \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
          \`rto_number\` varchar(255) NOT NULL UNIQUE,
          \`order_id\` bigint unsigned NOT NULL,
          \`waybill\` varchar(255) NOT NULL,
          \`status\` enum('ndr','reattempt_requested','rto_initiated','rto_in_transit','rto_received','qc_pending','qc_passed','qc_failed','restocked','completed') NOT NULL DEFAULT 'ndr',
          \`ndr_attempts\` int NOT NULL DEFAULT 1,
          \`first_ndr_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`last_ndr_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`next_reattempt_at\` timestamp NULL DEFAULT NULL,
          \`ndr_action_taken\` enum('reattempt_requested','address_updated','phone_updated','rto_approved','rescheduled') DEFAULT NULL,
          \`rto_reason\` enum('customer_refused','customer_unreachable','incorrect_address','door_locked','pincode_unserviceable','fake_delivery_attempt','customer_not_available','other') NOT NULL DEFAULT 'customer_unreachable',
          \`courier_status\` varchar(255) DEFAULT NULL,
          \`courier_remarks\` text DEFAULT NULL,
          \`rto_initiated_at\` timestamp NULL DEFAULT NULL,
          \`rto_received_at\` timestamp NULL DEFAULT NULL,
          \`warehouse_qc_status\` enum('pending','passed','failed') NOT NULL DEFAULT 'pending',
          \`warehouse_qc_remarks\` text DEFAULT NULL,
          \`inventory_action\` enum('pending','restocked','damaged') NOT NULL DEFAULT 'pending',
          \`inventory_action_at\` timestamp NULL DEFAULT NULL,
          \`admin_notes\` text DEFAULT NULL,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_rto_order_id\` (\`order_id\`),
          KEY \`idx_rto_waybill\` (\`waybill\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Auto-create RTO Tracking Events table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`rto_tracking_events\` (
          \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
          \`rto_case_id\` bigint unsigned NOT NULL,
          \`waybill\` varchar(255) NOT NULL,
          \`status\` varchar(255) NOT NULL,
          \`location\` varchar(255) DEFAULT NULL,
          \`description\` text DEFAULT NULL,
          \`event_time\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_rte_rto_id\` (\`rto_case_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Auto-create Inventory Transactions table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`inventory_transactions\` (
          \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
          \`product_id\` bigint unsigned NOT NULL,
          \`variant_id\` bigint unsigned NOT NULL,
          \`order_id\` bigint unsigned DEFAULT NULL,
          \`return_request_id\` bigint unsigned DEFAULT NULL,
          \`rto_case_id\` bigint unsigned DEFAULT NULL,
          \`transaction_type\` enum('sale','cancelled_order','rto_restock','return_restock','return_damaged','rto_damaged','manual_adjustment') NOT NULL,
          \`quantity\` int NOT NULL,
          \`previous_quantity\` int NOT NULL,
          \`new_quantity\` int NOT NULL,
          \`reason\` varchar(255) NOT NULL,
          \`notes\` text DEFAULT NULL,
          \`created_by\` bigint unsigned DEFAULT NULL,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_it_product_id\` (\`product_id\`),
          KEY \`idx_it_variant_id\` (\`variant_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Auto-create Admin Audit Logs table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`admin_audit_logs\` (
          \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
          \`admin_id\` bigint unsigned DEFAULT NULL,
          \`action\` varchar(255) NOT NULL,
          \`entity_type\` varchar(100) NOT NULL,
          \`entity_id\` bigint unsigned NOT NULL,
          \`old_value\` json DEFAULT NULL,
          \`new_value\` json DEFAULT NULL,
          \`reason\` text DEFAULT NULL,
          \`ip_address\` varchar(100) DEFAULT NULL,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_aal_entity\` (\`entity_type\`, \`entity_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Auto-create Courier Webhook Events table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`courier_webhook_events\` (
          \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
          \`courier\` varchar(100) NOT NULL DEFAULT 'Delhivery',
          \`event_id\` varchar(255) NOT NULL,
          \`waybill\` varchar(255) DEFAULT NULL,
          \`event_type\` varchar(100) NOT NULL,
          \`payload\` json DEFAULT NULL,
          \`processed\` boolean NOT NULL DEFAULT false,
          \`processed_at\` timestamp NULL DEFAULT NULL,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`courier_event_idx\` (\`courier\`, \`event_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      logger.log('✓ Database schema tables & columns verified/synchronized successfully.');
    } catch (e: any) {
      logger.warn(`Database table sync check warning: ${e.message}`);
    }

    return drizzle(connection, { schema, mode: 'default' });
  },
};
