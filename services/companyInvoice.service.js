/* eslint-disable no-console */
const PDFDocument = require('pdfkit');
const moment = require('moment');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const { Op } = require('sequelize');
const {
  CompanyInvoice,
  Company,
  Country,
  ParticipationType,
  sequelize,
} = require('./db.service');
const { sendEmailWithAttachment } = require('./common/email.service');

// Exchange rate configuration (same as invoice.service.js)
const EXCHANGE_RATE = 0.7; // USD 1 = JD 0.70

// Template image path (using existing invoice template)
const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'invoice-template.jpg',
);

/**
 * Get next serial number for company invoices in format C26XXXX
 * @returns {Promise<string>} Next serial number
 */
const getNextSerialNumber = async () => {
  const [results] = await sequelize.query(
    'SELECT MAX("serialNumber") AS "maxSerial" FROM "CompanyInvoices"',
    { raw: true },
  );

  let nextNum = 1;
  if (results && results.length > 0 && results[0].maxSerial) {
    // Parse the numeric part from C26XXXX
    const numericPart = results[0].maxSerial.substring(3);
    nextNum = parseInt(numericPart, 10) + 1;
  }

  return `C26${String(nextNum).padStart(4, '0')}`;
};

/**
 * Calculate both JOD and USD totals based on currency and exchange rate
 * @param {number} netAmount - The net amount
 * @param {string} currency - The source currency (JD or USD)
 * @returns {Object} { totalValueJD, totalValueUSD }
 */
const calculateDualTotals = (netAmount, currency) => {
  let totalValueJD = 0;
  let totalValueUSD = 0;

  if (currency === 'USD') {
    totalValueUSD = parseFloat(netAmount);
    totalValueJD = Math.round(totalValueUSD * EXCHANGE_RATE * 100) / 100;
  } else {
    // Default to JD
    totalValueJD = parseFloat(netAmount);
    totalValueUSD = Math.round((totalValueJD / EXCHANGE_RATE) * 100) / 100;
  }

  return { totalValueJD, totalValueUSD };
};

/**
 * Create a company invoice
 * @param {Object} data - Invoice data
 * @param {number} data.companyId - Company ID
 * @param {number} data.totalAmount - Total amount before discount
 * @param {number} data.discount - Discount amount
 * @param {string} data.description - Invoice description
 * @param {Date} data.invoiceDate - Invoice date
 * @param {Date} data.dueDate - Due date (optional)
 * @param {number} userId - ID of user creating the invoice
 * @returns {Promise<Object>} Created invoice
 */
const createCompanyInvoice = async (data, userId) => {
  const {
    companyId,
    totalAmount,
    discount = 0,
    description,
    invoiceDate,
    dueDate,
  } = data;

  // Fetch company with participation type to get currency
  const company = await Company.findByPk(companyId, {
    include: [
      {
        model: ParticipationType,
        as: 'participation',
        attributes: ['currency'],
      },
    ],
  });

  if (!company) {
    throw new Error('Company not found');
  }

  // Get currency from company's participation type (default to JD)
  const currency = company.participation?.currency || 'JD';

  // Calculate net amount
  const netAmount = totalAmount - discount;

  // Calculate both JOD and USD totals
  const { totalValueJD, totalValueUSD } = calculateDualTotals(
    netAmount,
    currency,
  );

  // Generate serial number
  const serialNumber = await getNextSerialNumber();

  const invoice = await CompanyInvoice.create({
    companyId,
    serialNumber,
    totalAmount,
    discount,
    netAmount,
    currency,
    totalValueJD,
    totalValueUSD,
    exchangeRate: EXCHANGE_RATE,
    description,
    invoiceDate,
    dueDate,
    status: 'PENDING',
    createdBy: userId,
  });

  return invoice;
};

/**
 * Get company invoice by ID with company details
 * @param {number} id - Invoice ID
 * @returns {Promise<Object|null>}
 */
const getCompanyInvoiceById = async id => {
  return CompanyInvoice.findByPk(id, {
    include: [
      {
        model: Company,
        as: 'company',
        include: [
          { model: Country, as: 'country' },
          { model: ParticipationType, as: 'participation' },
        ],
      },
    ],
  });
};

/**
 * Get all invoices for a company
 * @param {number} companyId - Company ID
 * @returns {Promise<Array>}
 */
const getCompanyInvoices = async companyId => {
  return CompanyInvoice.findAll({
    where: { companyId },
    order: [['createdAt', 'DESC']],
    include: [
      {
        model: Company,
        as: 'company',
        include: [
          { model: Country, as: 'country' },
          { model: ParticipationType, as: 'participation' },
        ],
      },
    ],
  });
};

/**
 * Get all company invoices with filters
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated results
 */
const getCompanyInvoiceList = async filters => {
  const { companyId, status, dateFrom, dateTo, page = 1, limit = 20 } = filters;

  const where = {};

  if (companyId) {
    where.companyId = companyId;
  }

  if (status) {
    where.status = status;
  }

  if (dateFrom || dateTo) {
    where.invoiceDate = {};
    if (dateFrom) {
      where.invoiceDate[Op.gte] = dateFrom;
    }
    if (dateTo) {
      where.invoiceDate[Op.lte] = dateTo;
    }
  }

  const offset = (page - 1) * limit;

  const { count: total, rows: invoices } = await CompanyInvoice.findAndCountAll(
    {
      where,
      offset,
      limit,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Company,
          as: 'company',
          include: [
            { model: Country, as: 'country' },
            { model: ParticipationType, as: 'participation' },
          ],
        },
      ],
    },
  );

  return {
    data: invoices.map(inv => inv.toJSON()),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Update company invoice status
 * @param {number} id - Invoice ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>}
 */
const updateCompanyInvoice = async (id, data) => {
  await CompanyInvoice.update(data, { where: { id } });
  return getCompanyInvoiceById(id);
};

/**
 * Format currency value
 * @param {number} value - The value to format
 * @param {string} currency - Currency suffix
 * @returns {string} Formatted string
 */
const formatCurrency = (value, currency = 'JD') => {
  const num = parseFloat(value) || 0;
  return `${num.toFixed(2)} ${currency}`;
};

/**
 * Generate company invoice PDF
 * @param {Object} invoice - Invoice with company data
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateCompanyInvoicePDF = async invoice => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        bufferPages: true,
        info: {
          Title: `GAIF Company Invoice - ${invoice.serialNumber}`,
          Author: 'GAIF 2026',
        },
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      const company = invoice.company;
      const invoiceDate = moment(invoice.invoiceDate).format('DD/MM/YYYY');

      // Add the template image as background (full page)
      doc.image(TEMPLATE_PATH, 0, 0, {
        width: 595.28, // A4 width in points
        height: 841.89, // A4 height in points
      });

      // Set font color for all text
      const textColor = '#333333';
      doc.fillColor(textColor);

      // ============================================================
      // HEADER SECTION
      // ============================================================
      doc.fontSize(10).font('Helvetica');

      // SERIAL NUMBER
      doc.text(invoice.serialNumber, 40, 130, { width: 200 });

      // TAX NUMBER
      if (config.taxNumber) {
        doc.text(config.taxNumber, 450, 130, { width: 200 });
      }

      // COMPANY NAME
      doc.text(company?.name || '', 42, 183, { width: 200 });

      // INVOICE DATE
      doc.text(invoiceDate, 450, 183, { width: 90 });

      // ============================================================
      // DESCRIPTION SECTION
      // ============================================================
      doc.fontSize(9).font('Helvetica');

      // Description text (multi-line support)
      if (invoice.description) {
        doc.text(invoice.description, 42, 270, {
          width: 400,
          height: 60,
          lineGap: 3,
        });
      }

      // ============================================================
      // AMOUNTS SECTION
      // ============================================================
      const valueX = 162;
      const valueWidth = 70;

      // Total Amount
      doc.text(
        formatCurrency(invoice.totalAmount, invoice.currency),
        valueX,
        355,
        { width: valueWidth, align: 'right' },
      );

      // Discount (if any)
      if (parseFloat(invoice.discount) > 0) {
        doc.text(
          `-${formatCurrency(invoice.discount, invoice.currency)}`,
          valueX,
          385,
          { width: valueWidth, align: 'right' },
        );
      }

      // ============================================================
      // TOTAL SECTION - Show both JOD and USD totals
      // ============================================================
      doc.font('Helvetica-Bold');

      // Total in JD
      const totalJD = invoice.totalValueJD || invoice.netAmount;
      doc.text(formatCurrency(totalJD, 'JD'), valueX, 540, {
        width: valueWidth,
        align: 'right',
      });

      // Total in USD
      const totalUSD =
        invoice.totalValueUSD ||
        Math.round((totalJD / EXCHANGE_RATE) * 100) / 100;
      doc.text(formatCurrency(totalUSD, 'USD'), valueX, 560, {
        width: valueWidth,
        align: 'right',
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get email header attachment for CID embedding
 * @returns {Object} Attachment object
 */
const getEmailHeaderAttachment = () => ({
  filename: 'emailHeader.png',
  path: path.join(__dirname, '..', 'templates', 'emailHeader.png'),
  cid: 'emailHeader',
});

/**
 * Load and process email template
 * @param {string} templateName - Template file name
 * @param {Object} variables - Variables to replace
 * @returns {string} Processed HTML
 */
const loadAndProcessTemplate = (templateName, variables) => {
  const templatePath = path.join(
    __dirname,
    '..',
    'templates',
    'emails',
    `${templateName}.html`,
  );
  let template = fs.readFileSync(templatePath, 'utf8');

  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    template = template.replace(regex, variables[key] || '');
  });

  return template;
};

/**
 * Send company invoice email with PDF attachment
 * @param {Object} invoice - Invoice with company data
 * @returns {Promise<Object>} Send result
 */
const sendCompanyInvoiceEmail = async invoice => {
  const company = invoice.company;

  if (!company || !company.email) {
    throw new Error('Company email not found');
  }

  // Generate payment URL
  const paymentUrl = `${config.urls.api}/payment/company-checkout?invoiceId=${invoice.id}`;

  // Load and process email template
  const html = loadAndProcessTemplate('companyInvoice', {
    companyName: company.name,
    paymentUrl,
  });

  // Generate invoice PDF
  const pdfBuffer = await generateCompanyInvoicePDF(invoice);

  // Prepare attachments
  const attachments = [
    getEmailHeaderAttachment(),
    {
      filename: `GAIF_Invoice_${invoice.serialNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    },
  ];

  // Send email
  await sendEmailWithAttachment(
    company.email,
    `Registration Invoice - ${company.name} - GAIF35 Conference`,
    html,
    attachments,
  );

  // Update invoice with email sent timestamp
  await CompanyInvoice.update(
    { emailSentAt: new Date() },
    { where: { id: invoice.id } },
  );

  console.log(`Company invoice email sent to ${company.email}`);

  return { success: true, emailSentTo: company.email };
};

/**
 * Create company invoice and send email
 * @param {Object} data - Invoice data
 * @param {number} userId - User ID creating the invoice
 * @param {boolean} sendEmail - Whether to send email after creation
 * @returns {Promise<Object>} Created invoice and email status
 */
const createAndSendCompanyInvoice = async (data, userId, sendEmail = true) => {
  // Create the invoice
  const invoice = await createCompanyInvoice(data, userId);

  // Fetch with company details
  const fullInvoice = await getCompanyInvoiceById(invoice.id);

  let emailResult = null;
  if (sendEmail) {
    try {
      emailResult = await sendCompanyInvoiceEmail(fullInvoice);
    } catch (emailError) {
      console.error('Error sending company invoice email:', emailError);
      emailResult = { success: false, error: emailError.message };
    }
  }

  return {
    invoice: fullInvoice.toJSON(),
    emailSent: emailResult?.success || false,
    emailError: emailResult?.error || null,
  };
};

/**
 * Admin Save Company Invoice - Consolidated endpoint that handles:
 * - Update total amount and discount
 * - Update description and dates
 * - Mark as paid if specified
 * - Send email with updated invoice
 * @param {number} invoiceId - Invoice ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated invoice with status
 */
const adminSaveCompanyInvoice = async (invoiceId, data) => {
  const {
    totalAmount,
    discount = 0,
    description,
    invoiceDate,
    dueDate,
    // Payment fields
    markAsPaid = false,
    paidAmount,
    paidCurrency,
    paymentReference,
    // Email option
    sendEmail = false,
  } = data;

  // Get current invoice with company details
  const currentInvoice = await getCompanyInvoiceById(invoiceId);
  if (!currentInvoice) {
    throw new Error('Invoice not found');
  }

  // Build update object
  const updateData = {};

  // Update amounts if provided
  if (totalAmount !== undefined) {
    updateData.totalAmount = totalAmount;
  }
  if (discount !== undefined) {
    updateData.discount = discount;
  }

  // Calculate net amount if total or discount changed
  const newTotal =
    totalAmount !== undefined ? totalAmount : currentInvoice.totalAmount;
  const newDiscount =
    discount !== undefined ? discount : currentInvoice.discount;
  updateData.netAmount = parseFloat(newTotal) - parseFloat(newDiscount);

  // Recalculate both JOD and USD totals when amounts change
  if (totalAmount !== undefined || discount !== undefined) {
    // Use the currency stored on the invoice (from company's participation type)
    const invoiceCurrency = currentInvoice.currency || 'JD';
    const { totalValueJD, totalValueUSD } = calculateDualTotals(
      updateData.netAmount,
      invoiceCurrency,
    );
    updateData.totalValueJD = totalValueJD;
    updateData.totalValueUSD = totalValueUSD;
    updateData.exchangeRate = EXCHANGE_RATE;
  }

  // Update other fields if provided
  if (description !== undefined) {
    updateData.description = description;
  }
  if (invoiceDate !== undefined) {
    updateData.invoiceDate = invoiceDate;
  }
  if (dueDate !== undefined) {
    updateData.dueDate = dueDate;
  }

  // Handle payment if marking as paid
  if (markAsPaid) {
    updateData.status = 'PAID';
    updateData.paidAmount = paidAmount || updateData.netAmount;
    updateData.paidCurrency = paidCurrency || currentInvoice.currency || 'JD';
    updateData.paidAt = new Date();
    if (paymentReference) {
      updateData.paymentReference = paymentReference;
    }
  }

  // Update the invoice
  await CompanyInvoice.update(updateData, { where: { id: invoiceId } });

  // Fetch updated invoice with company details
  const updatedInvoice = await getCompanyInvoiceById(invoiceId);

  // Send email if requested
  let emailResult = null;
  if (sendEmail) {
    try {
      emailResult = await sendCompanyInvoiceEmail(updatedInvoice);
    } catch (emailError) {
      console.error('Error sending company invoice email:', emailError);
      emailResult = { success: false, error: emailError.message };
    }
  }

  return {
    success: true,
    message: 'Invoice updated successfully',
    invoice: updatedInvoice.toJSON(),
    emailSent: emailResult?.success || false,
    emailError: emailResult?.error || null,
  };
};

module.exports = {
  getNextSerialNumber,
  createCompanyInvoice,
  getCompanyInvoiceById,
  getCompanyInvoices,
  getCompanyInvoiceList,
  updateCompanyInvoice,
  generateCompanyInvoicePDF,
  sendCompanyInvoiceEmail,
  createAndSendCompanyInvoice,
  adminSaveCompanyInvoice,
};
