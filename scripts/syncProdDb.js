/* eslint-disable no-console */
/**
 * Production DB sync script — safely adds all new columns from recent changes.
 * Each ALTER TABLE is wrapped so ORA-01430 (column already exists) is silently skipped.
 */
const { sequelize } = require('../models');

const alterations = [
  // ── ParticipationTypes ──────────────────────────────────────────────────────
  {
    description: 'ParticipationTypes.discount',
    sql: `ALTER TABLE "ParticipationTypes" ADD ("discount" NUMBER(10,2))`,
  },
  {
    description: 'ParticipationTypes.discountValidDate',
    sql: `ALTER TABLE "ParticipationTypes" ADD ("discountValidDate" DATE)`,
  },

  // ── MeetingRoomInvoices ─────────────────────────────────────────────────────
  {
    description: 'MeetingRoomInvoices.fawaterkomInvoiceId',
    sql: `ALTER TABLE "MeetingRoomInvoices" ADD ("fawaterkomInvoiceId" VARCHAR2(255))`,
  },
  {
    description: "MeetingRoomInvoices.fawaterkomStatus (default 'PENDING')",
    sql: `ALTER TABLE "MeetingRoomInvoices" ADD ("fawaterkomStatus" VARCHAR2(50) DEFAULT 'PENDING')`,
  },
  {
    description: 'MeetingRoomInvoices.qrCode',
    sql: `ALTER TABLE "MeetingRoomInvoices" ADD ("qrCode" CLOB)`,
  },
  {
    description: 'MeetingRoomInvoices.discountDisclosure',
    sql: `ALTER TABLE "MeetingRoomInvoices" ADD ("discountDisclosure" VARCHAR2(500))`,
  },
  {
    description: 'MeetingRoomInvoices.paymentSource',
    sql: `ALTER TABLE "MeetingRoomInvoices" ADD ("paymentSource" VARCHAR2(20))`,
  },

  // ── RegistrationTokens ──────────────────────────────────────────────────────
  {
    description: 'RegistrationTokens.companyInvoiceId',
    sql: `ALTER TABLE "RegistrationTokens" ADD ("companyInvoiceId" NUMBER(10))`,
  },

  // ── Invoices ────────────────────────────────────────────────────────────────
  {
    description: 'Invoices.isCompanyInvoice (default 0)',
    sql: `ALTER TABLE "Invoices" ADD ("isCompanyInvoice" NUMBER(1) DEFAULT 0)`,
  },
  {
    description: "Invoices.fawaterkomStatus default 'PENDING' (update existing NULLs)",
    sql: `UPDATE "Invoices" SET "fawaterkomStatus" = 'PENDING' WHERE "fawaterkomStatus" IS NULL`,
    isUpdate: true,
  },
];

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.\n');

    // Step 1: Create any missing tables (safe mode — does NOT alter existing tables)
    console.log('Creating missing tables...');
    await sequelize.sync({ force: false, alter: false });
    console.log('Tables check complete.\n');

    // Step 2: Add new columns to existing tables
    console.log('Adding new columns...');
    for (const item of alterations) {
      try {
        await sequelize.query(item.sql);
        if (item.isUpdate) {
          console.log(`  ✓ Updated:  ${item.description}`);
        } else {
          console.log(`  ✓ Added:    ${item.description}`);
        }
      } catch (err) {
        // ORA-01430: column already exists — safe to skip
        // ORA-00957: duplicate column name
        if (
          err.message &&
          (err.message.includes('ORA-01430') ||
            err.message.includes('ORA-00957'))
        ) {
          console.log(`  – Skipped:  ${item.description} (already exists)`);
        } else {
          console.error(`  ✗ Failed:   ${item.description}`);
          console.error(`    Error: ${err.message}`);
        }
      }
    }

    console.log('\nSync complete.');
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
