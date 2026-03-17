/* eslint-disable no-console */
const puppeteer = require('puppeteer');
const moment = require('moment');
const path = require('path');
const fs = require('fs');
const httpStatus = require('http-status');
const config = require('../config/config');
const { MeetingRoomInvoice, sequelize } = require('./db.service');
const { sendEmailWithAttachment } = require('./common/email.service');
const ApiError = require('../utils/ApiError');

const EXCHANGE_RATE = 0.709; // USD 1 = JD 0.709

const HTML_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'meetingRoomInvoicePDF.html',
);

const RECEIPT_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'meetingRoomReceiptPDF.html',
);

const HEADER_IMAGE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'emailHeader.png',
);

// Serial number format: GAIF26CM0001
const getNextSerialNumber = async () => {
  const [results] = await sequelize.query(
    'SELECT MAX("serialNumber") AS "maxSerial" FROM "MeetingRoomInvoices"',
    { raw: true },
  );

  let nextNum = 1;
  if (results && results.length > 0 && results[0].maxSerial) {
    const numericPart = results[0].maxSerial.substring(5); // strip "G26CM"
    nextNum = parseInt(numericPart, 10) + 1;
  }

  return `G26CM${String(nextNum).padStart(4, '0')}`;
};

const generateMeetingRoomInvoicePDF = async invoice => {
  const invoiceDate = moment(invoice.createdAt || new Date()).format(
    'DD/MM/YYYY',
  );

  const netJD = parseFloat(invoice.netAmountJD) || 0;
  const totalUSD =
    parseFloat(invoice.totalValueUSD) ||
    Math.round((netJD / EXCHANGE_RATE) * 100) / 100;
  const discount = parseFloat(invoice.discount) || 0;

  let html = fs.readFileSync(HTML_TEMPLATE_PATH, 'utf8');

  const headerImageBase64 = fs
    .readFileSync(HEADER_IMAGE_PATH)
    .toString('base64');
  const headerImageSrc = `data:image/png;base64,${headerImageBase64}`;

  html = html
    .replace('{{HEADER_IMAGE_PATH}}', headerImageSrc)
    .replace('{{SERIAL_NUMBER}}', invoice.serialNumber || '')
    .replace('{{TAX_NUMBER}}', config.taxNumber || '')
    .replace('{{COMPANY_NAME}}', invoice.company || '')
    .replace('{{COUNTRY_NAME}}', invoice.country || '')
    .replace('{{INVOICE_DATE}}', invoiceDate)
    .replace('{{DESCRIPTION}}', invoice.description || '')
    .replace('{{DISCOUNT_JD}}', `${discount.toFixed(2)} USD`)
    .replace('{{TOTAL_USD}}', `${totalUSD.toFixed(2)} USD`)
    .replace('{{TOTAL_JD}}', `${netJD.toFixed(2)} JD`);

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

const generateMeetingRoomReceiptPDF = async (invoice, qrCode) => {
  const invoiceDate = moment(invoice.createdAt || new Date()).format(
    'DD/MM/YYYY',
  );

  const netJD = parseFloat(invoice.netAmountJD) || 0;
  const totalUSD =
    parseFloat(invoice.totalValueUSD) ||
    Math.round((netJD / EXCHANGE_RATE) * 100) / 100;
  const discount = parseFloat(invoice.discount) || 0;

  let html = fs.readFileSync(RECEIPT_TEMPLATE_PATH, 'utf8');

  const headerImageBase64 = fs
    .readFileSync(HEADER_IMAGE_PATH)
    .toString('base64');
  const headerImageSrc = `data:image/png;base64,${headerImageBase64}`;

  const qrSection = qrCode
    ? `<div class="qr-section"><div class="qr-box"><div class="qr-label">E-Invoice QR Code</div><img class="qr-img" src="data:image/png;base64,${qrCode}" /></div></div>`
    : '';

  html = html
    .replace('{{HEADER_IMAGE_PATH}}', headerImageSrc)
    .replace('{{SERIAL_NUMBER}}', invoice.serialNumber || '')
    .replace('{{TAX_NUMBER}}', config.taxNumber || '')
    .replace('{{COMPANY_NAME}}', invoice.company || '')
    .replace('{{COUNTRY_NAME}}', invoice.country || '')
    .replace('{{INVOICE_DATE}}', invoiceDate)
    .replace('{{DESCRIPTION}}', invoice.description || '')
    .replace('{{DISCOUNT_JD}}', `${discount.toFixed(2)} USD`)
    .replace('{{TOTAL_USD}}', `${totalUSD.toFixed(2)} USD`)
    .replace('{{TOTAL_JD}}', `${netJD.toFixed(2)} JD`)
    .replace('{{QR_SECTION}}', qrSection);

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

const sendMeetingRoomInvoiceEmail = async invoice => {
  const emailTemplatePath = path.join(
    __dirname,
    '..',
    'templates',
    'emails',
    'meetingRoomInvoice.html',
  );

  const paymentUrl = `${config.urls.api}/payment/meeting-room-checkout?invoiceId=${invoice.id}`;

  let html = fs.readFileSync(emailTemplatePath, 'utf8');
  html = html
    .replace(/{{contactPerson}}/g, invoice.contactPerson || '')
    .replace(/{{paymentUrl}}/g, paymentUrl);

  const pdfBuffer = await generateMeetingRoomInvoicePDF(invoice);

  const attachments = [
    {
      filename: 'emailHeader.png',
      path: HEADER_IMAGE_PATH,
      cid: 'emailHeader',
    },
    {
      filename: `GAIF_MeetingRoom_Invoice_${invoice.serialNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    },
  ];

  await sendEmailWithAttachment(
    invoice.email,
    `Meeting Room Invoice - ${invoice.company} - GAIF35 Conference`,
    html,
    attachments,
  );

  await MeetingRoomInvoice.update(
    { emailSentAt: new Date() },
    { where: { id: invoice.id } },
  );

  console.log(`Meeting room invoice email sent to ${invoice.email}`);

  return { success: true, emailSentTo: invoice.email };
};

exports.createMeetingRoomInvoice = async (data, userId) => {
  const {
    country,
    company,
    contactPerson,
    email,
    mobile,
    amountJD,
    discount = 0,
    description,
  } = data;

  const serialNumber = await getNextSerialNumber();

  // Admin sends amount and discount in USD — USD is primary, JD is derived
  const amountUSD = parseFloat(amountJD); // field named amountJD but contains USD value
  const discountUSD = parseFloat(discount);
  const netAmountUSD = Math.round((amountUSD - discountUSD) * 100) / 100;
  const totalValueUSD = netAmountUSD;
  const totalValueJD = Math.round(netAmountUSD * EXCHANGE_RATE * 100) / 100;

  const invoice = await MeetingRoomInvoice.create({
    serialNumber,
    country,
    company,
    contactPerson,
    email,
    mobile,
    amountJD: amountUSD,
    discount: discountUSD,
    netAmountJD: netAmountUSD,
    totalValueJD,
    totalValueUSD,
    description,
  });

  const invoiceData = invoice.toJSON();

  // Send email immediately after creation
  await sendMeetingRoomInvoiceEmail(invoiceData);

  return invoiceData;
};

exports.updateMeetingRoomInvoice = async (id, data) => {
  const invoice = await MeetingRoomInvoice.findByPk(id);
  if (!invoice) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Meeting room invoice not found');
  }

  const updateData = { ...data };

  // Admin sends amount and discount in USD — USD is primary, JD is derived
  const amountUSD = parseFloat(data.amountJD ?? invoice.amountJD);
  const discountUSD = parseFloat(data.discount ?? invoice.discount ?? 0);
  const netAmountUSD = Math.round((amountUSD - discountUSD) * 100) / 100;
  const totalValueUSD = netAmountUSD;
  const totalValueJD = Math.round(netAmountUSD * EXCHANGE_RATE * 100) / 100;

  updateData.amountJD = amountUSD;
  updateData.discount = discountUSD;
  updateData.netAmountJD = netAmountUSD;
  updateData.totalValueJD = totalValueJD;
  updateData.totalValueUSD = totalValueUSD;

  await MeetingRoomInvoice.update(updateData, { where: { id } });

  const updated = await MeetingRoomInvoice.findByPk(id);
  const inv = updated.toJSON();
  inv.fawaterkomStatus = inv.fawaterkomStatus || 'PENDING';

  // Resend invoice email with updated values
  await sendMeetingRoomInvoiceEmail(inv);

  return inv;
};

exports.getMeetingRoomInvoiceList = async ({
  page = 1,
  limit = 20,
  status,
}) => {
  const where = {};
  if (status) where.status = status;

  const offset = (page - 1) * limit;

  const { count: total, rows } = await MeetingRoomInvoice.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    offset,
    limit,
  });

  return {
    data: rows.map(r => {
      const inv = r.toJSON();
      inv.fawaterkomStatus = inv.fawaterkomStatus || 'PENDING';
      return inv;
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

exports.getMeetingRoomInvoiceById = async id => {
  const invoice = await MeetingRoomInvoice.findByPk(id);
  if (!invoice) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Meeting room invoice not found');
  }
  const inv = invoice.toJSON();
  inv.fawaterkomStatus = inv.fawaterkomStatus || 'PENDING';
  return inv;
};

exports.downloadMeetingRoomInvoicePDF = async id => {
  const invoice = await MeetingRoomInvoice.findByPk(id);
  if (!invoice) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Meeting room invoice not found');
  }
  return generateMeetingRoomInvoicePDF(invoice.toJSON());
};

exports.resendMeetingRoomInvoiceEmail = async id => {
  const invoice = await MeetingRoomInvoice.findByPk(id);
  if (!invoice) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Meeting room invoice not found');
  }
  return sendMeetingRoomInvoiceEmail(invoice.toJSON());
};

exports.deleteMeetingRoomInvoice = async id => {
  const invoice = await MeetingRoomInvoice.findByPk(id);
  if (!invoice) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Meeting room invoice not found');
  }
  await invoice.destroy();
  return { success: true };
};

const submitMeetingRoomToFawaterkom = async invoiceId => {
  const {
    sendInvoiceToFawaterkom,
    getFawaterkomConfig,
  } = require('./jordanEinvoise.service');

  const invoice = await MeetingRoomInvoice.findByPk(invoiceId);
  if (!invoice)
    throw new ApiError(httpStatus.NOT_FOUND, 'Meeting room invoice not found');

  const fawaterkomConfig = getFawaterkomConfig();
  const inv = invoice.toJSON();

  const taxRatePercent = 16;
  const taxRate = taxRatePercent / 100;
  const total = parseFloat(inv.totalValueJD) || 0;
  const discountInclTax = parseFloat(inv.discount) || 0;

  const round = (value, decimals = 9) =>
    Number(Number(value).toFixed(decimals));
  const totalExcAfterDiscount = round(total / (1 + taxRate));
  const discountExc = round(discountInclTax / (1 + taxRate));
  const itemPriceExc = round(totalExcAfterDiscount + discountExc);
  const fawaterkomTax = round(totalExcAfterDiscount * taxRate);
  const fawaterkomDiscount = round(discountExc);

  const { v4: uuidv4 } = require('uuid');

  const invoiceData = {
    TransactionNumber: inv.serialNumber,
    UUID: uuidv4(),
    TransactionDate: new Date().toISOString().split('T')[0],
    TransactionType: '1',
    PaymentMethod: '022',
    TaxNumber: fawaterkomConfig.taxNumber,
    ActivityNumber: fawaterkomConfig.activityNumber,
    ClientName: fawaterkomConfig.companyName,
    BuyerName: inv.contactPerson,
    Currency: 'JOD',
    Total: totalExcAfterDiscount,
    TotalDiscount: 0,
    TotalTax: fawaterkomTax,
    SpecialTax: 0,
    Note: `GAIF 2026 Meeting Room - ${inv.company}`,
    Items: [
      {
        RowNum: 1,
        ItemName: 'Meeting Room',
        ItemQty: 1,
        ItemSalePriceExc: itemPriceExc,
        ItemDiscExc: fawaterkomDiscount,
        ItemTotal: totalExcAfterDiscount,
        ItemTax: fawaterkomTax,
        ItemTaxRate: taxRatePercent,
      },
    ],
  };

  const result = await sendInvoiceToFawaterkom(invoiceData);

  const updateData = {};
  if (result.success) {
    updateData.fawaterkomInvoiceId = result.data?.EINV_INV_UUID || null;
    updateData.fawaterkomStatus = 'SUBMITTED';
    updateData.qrCode = result.data?.EINV_QR || null;
  } else {
    updateData.fawaterkomStatus = 'FAILED';
    console.error(
      'Meeting room Fawaterkom submission failed:',
      JSON.stringify(result.error),
    );
  }

  await MeetingRoomInvoice.update(updateData, { where: { id: invoiceId } });
  const updated = await MeetingRoomInvoice.findByPk(invoiceId);
  const updatedData = updated.toJSON();

  // Send email with QR code
  if (result.success) {
    try {
      await sendMeetingRoomPaymentEmail(updatedData);
    } catch (emailErr) {
      console.error(
        'Error sending meeting room payment email:',
        emailErr.message,
      );
    }
  }

  return { invoice: updatedData, fawaterkomResult: result };
};

const sendMeetingRoomPaymentEmail = async invoice => {
  const emailTemplatePath = path.join(
    __dirname,
    '..',
    'templates',
    'emails',
    'meetingRoomInvoice.html',
  );

  let html = fs.readFileSync(emailTemplatePath, 'utf8');
  html = html
    .replace(/{{contactPerson}}/g, invoice.contactPerson || '')
    .replace(/{{paymentUrl}}/g, '');

  const pdfBuffer = await generateMeetingRoomReceiptPDF(
    invoice,
    invoice.qrCode || null,
  );

  const attachments = [
    {
      filename: 'emailHeader.png',
      path: HEADER_IMAGE_PATH,
      cid: 'emailHeader',
    },
    {
      filename: `GAIF_MeetingRoom_Receipt_${invoice.serialNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    },
  ];

  await sendEmailWithAttachment(
    invoice.email,
    `Meeting Room Payment Receipt - ${invoice.company} - GAIF35 Conference`,
    html,
    attachments,
  );
};

const reverseMeetingRoomFawaterkom = async invoiceId => {
  const {
    reverseInvoiceToFawaterkom,
    getFawaterkomConfig,
  } = require('./jordanEinvoise.service');

  const invoice = await MeetingRoomInvoice.findByPk(invoiceId);
  if (!invoice)
    throw new ApiError(httpStatus.NOT_FOUND, 'Meeting room invoice not found');

  const inv = invoice.toJSON();
  if (!inv.fawaterkomInvoiceId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Invoice not submitted to Fawaterkom yet',
    );
  }

  const fawaterkomConfig = getFawaterkomConfig();
  const taxRatePercent = 16;
  const taxRate = taxRatePercent / 100;
  const total = parseFloat(inv.totalValueJD) || 0;
  const discountInclTax = parseFloat(inv.discount) || 0;

  const round = (value, decimals = 9) =>
    Number(Number(value).toFixed(decimals));
  const totalExcAfterDiscount = round(total / (1 + taxRate));
  const discountExc = round(discountInclTax / (1 + taxRate));
  const itemPriceExc = round(totalExcAfterDiscount + discountExc);
  const fawaterkomTax = round(totalExcAfterDiscount * taxRate);
  const fawaterkomDiscount = round(discountExc);

  const { v4: uuidv4 } = require('uuid');

  const reverseData = {
    TransactionNumber: `CN-${inv.serialNumber}`,
    UUID: uuidv4(),
    TransactionDate: new Date().toISOString().split('T')[0],
    TransactionType: '2',
    PaymentMethod: '022',
    OriginalInvoiceNumber: inv.serialNumber,
    OriginalInvoiceUUID: inv.fawaterkomInvoiceId,
    TaxNumber: fawaterkomConfig.taxNumber,
    ActivityNumber: fawaterkomConfig.activityNumber,
    ClientName: fawaterkomConfig.companyName,
    BuyerName: inv.contactPerson,
    Currency: 'JOD',
    Total: totalExcAfterDiscount,
    TotalDiscount: 0,
    TotalTax: fawaterkomTax,
    SpecialTax: 0,
    Note: `Reversal - GAIF 2026 Meeting Room - ${inv.company}`,
    Items: [
      {
        RowNum: 1,
        ItemName: 'Meeting Room',
        ItemQty: 1,
        ItemSalePriceExc: itemPriceExc,
        ItemDiscExc: fawaterkomDiscount,
        ItemTotal: totalExcAfterDiscount,
        ItemTax: fawaterkomTax,
        ItemTaxRate: taxRatePercent,
      },
    ],
  };

  const result = await reverseInvoiceToFawaterkom(reverseData);

  if (result.success) {
    await MeetingRoomInvoice.update(
      { fawaterkomStatus: 'REVERSED' },
      { where: { id: invoiceId } },
    );
  }

  return { success: result.success, result };
};

exports.sendMeetingRoomReceiptEmail = sendMeetingRoomPaymentEmail;

exports.sendMeetingRoomInvoicesToFawaterkom = async invoiceIds => {
  const results = [];
  for (const invoiceId of invoiceIds) {
    try {
      const result = await submitMeetingRoomToFawaterkom(invoiceId);
      results.push({
        invoiceId,
        success: true,
        fawaterkomResult: result.fawaterkomResult,
      });
    } catch (err) {
      results.push({ invoiceId, success: false, error: err.message });
    }
  }
  return results;
};

exports.reverseMeetingRoomInvoicesFromFawaterkom = async invoiceIds => {
  const results = [];
  for (const invoiceId of invoiceIds) {
    try {
      const result = await reverseMeetingRoomFawaterkom(invoiceId);
      results.push({ invoiceId, success: result.success, result });
    } catch (err) {
      results.push({ invoiceId, success: false, error: err.message });
    }
  }
  return results;
};
