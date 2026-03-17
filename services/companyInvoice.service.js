/* eslint-disable no-console */
const puppeteer = require('puppeteer');
const moment = require('moment');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const { Op } = require('sequelize');
const {
  CompanyInvoice,
  CompanyInvoiceRegistration,
  Company,
  Country,
  Registration,
  Invoice,
  ParticipationType,
  Spouse,
  RegistrationTrip,
  Trip,
  Accommodation,
  HotelRoom,
  sequelize,
} = require('./db.service');
const { sendEmailWithAttachment } = require('./common/email.service');

// Exchange rate configuration (same as invoice.service.js)
const EXCHANGE_RATE = 0.709; // USD 1 = JD 0.70

// Template paths
const HTML_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'companyInvoicePDF.html',
);

const HEADER_IMAGE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'emailHeader.png',
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
    // Parse the numeric part from G26CPXXXX
    const numericPart = results[0].maxSerial.substring(5);
    nextNum = parseInt(numericPart, 10) + 1;
  }

  return `G26CP${String(nextNum).padStart(4, '0')}`;
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
 * @param {number[]} [data.registrationIds] - Registration IDs to include (totals computed automatically)
 * @param {number} [data.totalAmount] - Manual total (used only if no registrationIds)
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
    registrationIds,
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

  // Build per-registration items if registrationIds provided
  let registrationItems = [];
  let computedTotalAmount = parseFloat(totalAmount) || 0;

  if (registrationIds && registrationIds.length > 0) {
    // Fetch registrations without nested invoice include (avoid Oracle issues with separate+limit)
    const registrations = await Registration.findAll({
      where: { id: { [Op.in]: registrationIds }, companyId },
      attributes: ['id', 'firstName', 'lastName', 'position'],
    });

    // Fetch latest invoice for each registration in parallel
    const latestInvoices = await Promise.all(
      registrations.map(reg =>
        Invoice.findOne({
          where: { registrationId: reg.id },
          order: [['createdAt', 'DESC']],
          attributes: ['id', 'totalValueJD', 'totalValueUSD', 'serialNumber'],
        }),
      ),
    );

    // Build a map: registrationId → { reg, invoice }
    const regMap = {};
    registrations.forEach((reg, idx) => {
      regMap[reg.id] = { reg, invoice: latestInvoices[idx] };
    });

    // Preserve order from registrationIds input
    registrationItems = registrationIds
      .filter(rid => regMap[rid])
      .map(rid => {
        const { reg, invoice: latestInvoice } = regMap[rid];
        return {
          registrationId: reg.id,
          invoiceId: latestInvoice?.id || null,
          totalJD: parseFloat(latestInvoice?.totalValueJD) || 0,
          totalUSD: parseFloat(latestInvoice?.totalValueUSD) || 0,
          name: `${reg.firstName} ${reg.lastName}`,
          position: reg.position,
        };
      });

    // Sum grand total from per-registration JD totals
    computedTotalAmount = registrationItems.reduce(
      (sum, item) => sum + item.totalJD,
      0,
    );
  }

  // Calculate net amount
  const netAmount = computedTotalAmount - discount;

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
    totalAmount: computedTotalAmount,
    discount,
    netAmount,
    currency,
    totalValueJD,
    totalValueUSD,
    exchangeRate: EXCHANGE_RATE,
    description,
    invoiceDate: invoiceDate || new Date(),
    dueDate,
    status: 'PENDING',
    createdBy: userId,
  });

  // Create junction records linking invoice to each registration
  if (registrationItems.length > 0) {
    await CompanyInvoiceRegistration.bulkCreate(
      registrationItems.map(item => ({
        companyInvoiceId: invoice.id,
        registrationId: item.registrationId,
        invoiceId: item.invoiceId,
        totalJD: item.totalJD,
        totalUSD: item.totalUSD,
      })),
    );

    // Flag all linked registration invoices as part of a company invoice
    const invoiceIdsToFlag = registrationItems
      .map(item => item.invoiceId)
      .filter(Boolean);
    if (invoiceIdsToFlag.length > 0) {
      await Invoice.update(
        { isCompanyInvoice: true },
        { where: { id: { [Op.in]: invoiceIdsToFlag } } },
      );
    }
  }

  return invoice;
};

/**
 * Get company invoice by ID with company details and registration items
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
      {
        model: CompanyInvoiceRegistration,
        as: 'registrationItems',
        include: [
          {
            model: Registration,
            as: 'registration',
            attributes: [
              'id',
              'profileId',
              'firstName',
              'lastName',
              'position',
              'createdAt',
            ],
          },
          {
            model: Invoice,
            as: 'invoice',
            attributes: ['id', 'serialNumber', 'totalValueJD', 'totalValueUSD'],
          },
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
      {
        model: CompanyInvoiceRegistration,
        as: 'registrationItems',
        include: [
          {
            model: Registration,
            as: 'registration',
            attributes: [
              'id',
              'profileId',
              'firstName',
              'lastName',
              'position',
            ],
          },
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
 * Build the HTML table rows for registrations
 * @param {Array} registrationItems - Registration items with linked registration/invoice
 * @returns {string} HTML string for tbody rows
 */
const MIN_TABLE_ROWS = 3;

const buildTableRows = registrationItems => {
  const dataRows = (registrationItems || []).map(item => {
    const reg = item.registration;
    const inv = item.invoice;
    const profileId = reg?.profileId || item.registrationId || '';
    const name = reg ? `${reg.firstName} ${reg.lastName}` : '';
    const invoiceSerial = inv?.serialNumber || '';
    const regDate = reg?.createdAt
      ? moment(reg.createdAt).format('DD/MM/YYYY')
      : '';
    const amountUSD = parseFloat(item.totalUSD) || 0;
    const amountJD = parseFloat(item.totalJD) || 0;

    return `<tr>
      <td>${profileId}</td>
      <td class="left">${name}</td>
      <td>${invoiceSerial}</td>
      <td>${regDate}</td>
      <td class="right">${amountUSD > 0 ? amountUSD.toFixed(2) : ''}</td>
      <td class="right">${amountJD > 0 ? amountJD.toFixed(2) : ''}</td>
    </tr>`;
  });

  // Pad to minimum row count so the table always looks full
  const emptyCount = Math.max(0, MIN_TABLE_ROWS - dataRows.length);
  const emptyRows = Array(emptyCount).fill(
    `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`,
  );

  return [...dataRows, ...emptyRows].join('\n');
};

/**
 * Generate company invoice PDF using HTML → Puppeteer
 * @param {Object} invoice - Invoice with company data and registrationItems
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateCompanyInvoicePDF = async invoice => {
  const company = invoice.company;
  const registrationItems = invoice.registrationItems || [];

  const invoiceDate = moment(invoice.invoiceDate).format('DD/MM/YYYY');
  const countryName = company?.country?.name || '';

  const totalJD =
    parseFloat(invoice.totalValueJD) || parseFloat(invoice.netAmount) || 0;
  const totalUSD =
    parseFloat(invoice.totalValueUSD) ||
    Math.round((totalJD / EXCHANGE_RATE) * 100) / 100;

  // Read HTML template
  let html = fs.readFileSync(HTML_TEMPLATE_PATH, 'utf8');

  // Convert header image to base64 so puppeteer can render it in any environment
  const headerImageBase64 = fs
    .readFileSync(HEADER_IMAGE_PATH)
    .toString('base64');
  const headerImageSrc = `data:image/png;base64,${headerImageBase64}`;

  // Build table rows
  const tableRows = buildTableRows(registrationItems);

  // Replace template placeholders
  html = html
    .replace('{{HEADER_IMAGE_PATH}}', headerImageSrc)
    .replace('{{SERIAL_NUMBER}}', invoice.serialNumber || '')
    .replace('{{TAX_NUMBER}}', config.taxNumber || '')
    .replace('{{COMPANY_NAME}}', company?.name || '')
    .replace('{{COUNTRY_NAME}}', countryName)
    .replace('{{INVOICE_DATE}}', invoiceDate)
    .replace('{{TABLE_ROWS}}', tableRows)
    .replace('{{TOTAL_USD}}', `${totalUSD.toFixed(2)} USD`)
    .replace('{{TOTAL_JD}}', `${totalJD.toFixed(2)} JD`);

  // Launch puppeteer and render to PDF
  // Use system Chromium when PUPPETEER_EXECUTABLE_PATH is set (Docker environments)
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
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
  const invoiceData =
    typeof invoice.toJSON === 'function' ? invoice.toJSON() : invoice;
  const pdfBuffer = await generateCompanyInvoicePDF(invoiceData);

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
 * Update registrations linked to a company invoice (add/remove)
 * @param {number} invoiceId - Company invoice ID
 * @param {number[]} registrationIds - New complete list of registration IDs
 * @returns {Promise<Object>} Updated invoice
 */
const updateCompanyInvoiceRegistrations = async (
  invoiceId,
  registrationIds,
) => {
  const invoice = await getCompanyInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Current registration IDs in the invoice
  const currentIds = (invoice.registrationItems || []).map(
    item => item.registrationId,
  );

  const toAdd = registrationIds.filter(id => !currentIds.includes(id));
  const toRemove = currentIds.filter(id => !registrationIds.includes(id));

  // Remove junction records for removed registrations
  if (toRemove.length > 0) {
    // Get the invoice IDs before destroying so we can reset the flag
    const removedItems = await CompanyInvoiceRegistration.findAll({
      where: {
        companyInvoiceId: invoiceId,
        registrationId: { [Op.in]: toRemove },
      },
      attributes: ['invoiceId'],
    });

    await CompanyInvoiceRegistration.destroy({
      where: {
        companyInvoiceId: invoiceId,
        registrationId: { [Op.in]: toRemove },
      },
    });

    // Reset isCompanyInvoice flag for removed invoices
    const removedInvoiceIds = removedItems
      .map(item => item.invoiceId)
      .filter(Boolean);
    if (removedInvoiceIds.length > 0) {
      await Invoice.update(
        { isCompanyInvoice: false },
        { where: { id: { [Op.in]: removedInvoiceIds } } },
      );
    }
  }

  // Add junction records for new registrations
  if (toAdd.length > 0) {
    const newRegistrations = await Registration.findAll({
      where: { id: { [Op.in]: toAdd } },
      attributes: ['id', 'firstName', 'lastName', 'position'],
    });

    const newInvoices = await Promise.all(
      newRegistrations.map(reg =>
        Invoice.findOne({
          where: { registrationId: reg.id },
          order: [['createdAt', 'DESC']],
          attributes: ['id', 'totalValueJD', 'totalValueUSD', 'serialNumber'],
        }),
      ),
    );

    await CompanyInvoiceRegistration.bulkCreate(
      newRegistrations.map((reg, idx) => ({
        companyInvoiceId: invoiceId,
        registrationId: reg.id,
        invoiceId: newInvoices[idx]?.id || null,
        totalJD: parseFloat(newInvoices[idx]?.totalValueJD) || 0,
        totalUSD: parseFloat(newInvoices[idx]?.totalValueUSD) || 0,
      })),
    );

    // Flag newly added registration invoices as part of a company invoice
    const newInvoiceIds = newInvoices.map(inv => inv?.id).filter(Boolean);
    if (newInvoiceIds.length > 0) {
      await Invoice.update(
        { isCompanyInvoice: true },
        { where: { id: { [Op.in]: newInvoiceIds } } },
      );
    }
  }

  // Recalculate totals from all current junction records
  const allItems = await CompanyInvoiceRegistration.findAll({
    where: { companyInvoiceId: invoiceId },
    attributes: ['totalJD', 'totalUSD'],
  });

  const totalAmount = allItems.reduce(
    (sum, item) => sum + (parseFloat(item.totalJD) || 0),
    0,
  );
  const discount = parseFloat(invoice.discount) || 0;
  const netAmount = totalAmount - discount;
  const invoiceCurrency = invoice.currency || 'JD';
  const { totalValueJD, totalValueUSD } = calculateDualTotals(
    netAmount,
    invoiceCurrency,
  );

  await CompanyInvoice.update(
    {
      totalAmount,
      netAmount,
      totalValueJD,
      totalValueUSD,
      exchangeRate: EXCHANGE_RATE,
    },
    { where: { id: invoiceId } },
  );

  return getCompanyInvoiceById(invoiceId);
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

/**
 * Get registration items linked to a company invoice
 * @param {number} companyInvoiceId - Company invoice ID
 * @returns {Promise<Array>}
 */
const getRegistrationItemsByInvoice = async companyInvoiceId => {
  return CompanyInvoiceRegistration.findAll({
    where: { companyInvoiceId },
    include: [
      {
        model: Registration,
        as: 'registration',
        attributes: ['id', 'profileId', 'firstName', 'lastName', 'position'],
      },
      {
        model: Invoice,
        as: 'invoice',
        attributes: ['id', 'serialNumber', 'totalValueJD', 'totalValueUSD'],
      },
    ],
    order: [['id', 'ASC']],
  });
};

/**
 * Company Invoice Report — all registrations linked to company invoices
 * Supports filter by companyId / countryId and `all` flag to skip pagination
 */
const getCompanyInvoiceReport = async ({
  companyId,
  countryId,
  page = 1,
  limit = 20,
  all = false,
}) => {
  // Step 1: find junction records (filtered by company invoice / country)
  const companyInvoiceWhere = {};
  if (companyId) companyInvoiceWhere.companyId = companyId;

  const companyWhere = {};
  if (countryId) companyWhere.countryId = countryId;

  const junctionItems = await CompanyInvoiceRegistration.findAll({
    include: [
      {
        model: CompanyInvoice,
        as: 'companyInvoice',
        ...(Object.keys(companyInvoiceWhere).length > 0
          ? { where: companyInvoiceWhere, required: true }
          : { required: true }),
        include: [
          {
            model: Company,
            as: 'company',
            ...(Object.keys(companyWhere).length > 0
              ? { where: companyWhere, required: true }
              : {}),
            include: [{ model: Country, as: 'country' }],
          },
        ],
      },
    ],
    order: [['id', 'ASC']],
  });

  if (junctionItems.length === 0) {
    return {
      data: [],
      ...(all ? {} : { pagination: { page, limit, total: 0, totalPages: 0 } }),
    };
  }

  // Map: registrationId → companyInvoice JSON (keep last if duplicates)
  const companyInvoiceMap = {};
  junctionItems.forEach(j => {
    const jData = j.toJSON();
    companyInvoiceMap[j.registrationId] = jData.companyInvoice;
  });

  const registrationIds = [...new Set(junctionItems.map(j => j.registrationId))];

  // Step 2: fetch full registrations for those IDs
  const includes = [
    {
      model: Company,
      as: 'company',
      include: [
        { model: Country, as: 'country' },
        { model: ParticipationType, as: 'participation' },
      ],
    },
    { model: ParticipationType, as: 'participation' },
    { model: Country, as: 'nationality' },
    {
      model: Spouse,
      as: 'spouse',
      include: [{ model: Country, as: 'nationality' }],
      required: false,
    },
    {
      model: RegistrationTrip,
      as: 'trips',
      include: [{ model: Trip, as: 'trip' }],
      required: false,
    },
    { model: Accommodation, as: 'ammanHotel', required: false },
    { model: HotelRoom, as: 'ammanRoom', required: false },
    { model: Accommodation, as: 'deadSeaHotel', required: false },
    { model: HotelRoom, as: 'deadSeaRoom', required: false },
    {
      model: Invoice,
      as: 'invoices',
      required: false,
      separate: true,
      order: [['createdAt', 'DESC']],
    },
  ];

  const queryOptions = {
    where: { id: { [Op.in]: registrationIds } },
    include: includes,
    order: [['createdAt', 'DESC']],
    distinct: true,
  };

  if (!all) {
    queryOptions.offset = (page - 1) * limit;
    queryOptions.limit = limit;
  }

  const { count: total, rows: registrations } =
    await Registration.findAndCountAll(queryOptions);

  const data = registrations.map(reg => {
    const regData = reg.toJSON();

    // Build latestInvoice with qrCode and fawaterkomStatus
    let latestInvoice = null;
    if (regData.invoices && regData.invoices.length > 0) {
      const inv = regData.invoices[0];
      latestInvoice = {
        id: inv.id,
        serialNumber: inv.serialNumber,
        participationFees: parseFloat(inv.participationFees) || 0,
        participationCurrency: inv.participationCurrency || 'USD',
        participationDiscount: parseFloat(inv.participationDiscount) || 0,
        participationPaid: inv.participationPaid || false,
        spouseFees: parseFloat(inv.spouseFees) || 0,
        spouseCurrency: inv.spouseCurrency || 'USD',
        spouseDiscount: parseFloat(inv.spouseDiscount) || 0,
        spousePaid: inv.spousePaid || false,
        tripFees: parseFloat(inv.tripFees) || 0,
        tripCurrency: inv.tripCurrency || 'USD',
        tripDiscount: parseFloat(inv.tripDiscount) || 0,
        tripPaid: inv.tripPaid || false,
        spouseTripFees: parseFloat(inv.spouseTripFees) || 0,
        spouseTripCurrency: inv.spouseTripCurrency || 'USD',
        spouseTripDiscount: parseFloat(inv.spouseTripDiscount) || 0,
        spouseTripPaid: inv.spouseTripPaid || false,
        ammanTotal: parseFloat(inv.ammanTotal) || 0,
        ammanCurrency: inv.ammanCurrency || 'USD',
        ammanDiscount: parseFloat(inv.ammanDiscount) || 0,
        ammanPaid: inv.ammanPaid || false,
        deadSeaTotal: parseFloat(inv.deadSeaTotal) || 0,
        deadSeaCurrency: inv.deadSeaCurrency || 'USD',
        deadSeaDiscount: parseFloat(inv.deadSeaDiscount) || 0,
        deadSeaPaid: inv.deadSeaPaid || false,
        totalDiscount: parseFloat(inv.totalDiscount) || 0,
        totalValueJD: parseFloat(inv.totalValueJD) || 0,
        totalValueUSD: parseFloat(inv.totalValueUSD) || 0,
        paidAmount: parseFloat(inv.paidAmount) || 0,
        balance: parseFloat(inv.balance) || 0,
        isCompanyInvoice: inv.isCompanyInvoice || false,
        invoiceStatus: inv.invoiceStatus,
        fawaterkomStatus: inv.fawaterkomStatus || 'PENDING',
        qrCode: inv.qrCode || null,
        paidAt: inv.paidAt,
        paymentSource: inv.paymentSource,
        createdAt: inv.createdAt,
      };
    }

    delete regData.invoices;

    return {
      ...regData,
      latestInvoice,
      companyInvoice: companyInvoiceMap[reg.id] || null,
    };
  });

  return {
    data,
    ...(all
      ? {}
      : {
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        }),
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
  updateCompanyInvoiceRegistrations,
  getRegistrationItemsByInvoice,
  getCompanyInvoiceReport,
};
