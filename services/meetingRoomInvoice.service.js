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
    const numericPart = results[0].maxSerial.substring(8); // strip "GAIF26CM"
    nextNum = parseInt(numericPart, 10) + 1;
  }

  return `GAIF26CM${String(nextNum).padStart(4, '0')}`;
};

const generateMeetingRoomInvoicePDF = async invoice => {
  const invoiceDate = moment(invoice.createdAt || new Date()).format('DD/MM/YYYY');

  const netJD = parseFloat(invoice.netAmountJD) || 0;
  const totalUSD = parseFloat(invoice.totalValueUSD) || Math.round((netJD / EXCHANGE_RATE) * 100) / 100;
  const discount = parseFloat(invoice.discount) || 0;

  let html = fs.readFileSync(HTML_TEMPLATE_PATH, 'utf8');

  const headerImageBase64 = fs.readFileSync(HEADER_IMAGE_PATH).toString('base64');
  const headerImageSrc = `data:image/png;base64,${headerImageBase64}`;

  html = html
    .replace('{{HEADER_IMAGE_PATH}}', headerImageSrc)
    .replace('{{SERIAL_NUMBER}}', invoice.serialNumber || '')
    .replace('{{TAX_NUMBER}}', config.taxNumber || '')
    .replace('{{COMPANY_NAME}}', invoice.company || '')
    .replace('{{COUNTRY_NAME}}', invoice.country || '')
    .replace('{{INVOICE_DATE}}', invoiceDate)
    .replace('{{DESCRIPTION}}', invoice.description || '')
    .replace('{{DISCOUNT_JD}}', `${discount.toFixed(2)} JD`)
    .replace('{{TOTAL_USD}}', `${totalUSD.toFixed(2)} USD`)
    .replace('{{TOTAL_JD}}', `${netJD.toFixed(2)} JD`);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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
  const { country, company, contactPerson, email, mobile, amountJD, discount = 0, description } = data;

  const serialNumber = await getNextSerialNumber();

  const netAmountJD = Math.round((parseFloat(amountJD) - parseFloat(discount)) * 100) / 100;
  const totalValueJD = netAmountJD;
  const totalValueUSD = Math.round((netAmountJD / EXCHANGE_RATE) * 100) / 100;

  const invoice = await MeetingRoomInvoice.create({
    serialNumber,
    country,
    company,
    contactPerson,
    email,
    mobile,
    amountJD: parseFloat(amountJD),
    discount: parseFloat(discount),
    netAmountJD,
    totalValueJD,
    totalValueUSD,
    description,
  });

  const invoiceData = invoice.toJSON();

  // Send email immediately after creation
  await sendMeetingRoomInvoiceEmail(invoiceData);

  return invoiceData;
};

exports.getMeetingRoomInvoiceList = async ({ page = 1, limit = 20, status }) => {
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
    data: rows.map(r => r.toJSON()),
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
  return invoice.toJSON();
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
