/* eslint-disable no-console */
const { sequelize } = require('../models');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.');

    await sequelize.query(
      `ALTER TABLE "Invoices" ADD ("isCompanyInvoice" NUMBER(1) DEFAULT 0)`,
    );
    console.log('Column "isCompanyInvoice" added to Invoices table.');
  } catch (error) {
    if (
      error.message &&
      error.message.includes('ORA-01430') // column already exists
    ) {
      console.log('Column already exists, skipping.');
    } else {
      console.error('Error:', error.message);
      process.exit(1);
    }
  } finally {
    await sequelize.close();
    console.log('Done.');
  }
}

run();
