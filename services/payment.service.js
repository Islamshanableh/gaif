/* eslint-disable no-console */
const axios = require('axios');
const querystring = require('querystring');
const config = require('../config/config');
const {
  Invoice,
  Registration,
  Company,
  Country,
  CompanyInvoice,
  CompanyInvoiceRegistration,
  MeetingRoomInvoice,
} = require('./db.service');
// eslint-disable-next-line import/no-cycle
const invoiceService = require('./invoice.service');

const { meps } = config;

/**
 * Parse NVP (Name-Value Pair) response from MEPS into an object
 * @param {string} nvpString - e.g. "result=SUCCESS&session.id=XXX&..."
 * @returns {Object}
 */
const parseNvpResponse = nvpString => {
  const params = {};
  nvpString.split('&').forEach(pair => {
    const [key, ...rest] = pair.split('=');
    params[key] = rest.join('=');
  });
  return params;
};

/**
 * Create a Hosted Checkout session using MEPS NVP API
 * @param {number} registrationId - Registration ID
 * @returns {Promise<Object>} Session data with sessionId and successIndicator
 */
const createCheckoutSession = async registrationId => {
  const invoice = await Invoice.findOne({
    where: { registrationId },
    order: [['createdAt', 'DESC']],
  });

  if (!invoice) {
    throw new Error('No invoice found for this registration');
  }

  // Get registration with company and country to determine currency
  const registration = await Registration.findByPk(registrationId, {
    include: [
      {
        model: Company,
        as: 'company',
        include: [
          {
            model: Country,
            as: 'country',
            attributes: ['id', 'name'],
          },
        ],
      },
    ],
  });

  if (!registration) {
    throw new Error('Registration not found');
  }

  // Determine currency based on company's country
  // If Jordan -> JOD and totalValueJD, otherwise -> USD and totalValueUSD
  const companyCountry = registration.company?.country?.name?.toLowerCase();
  const isJordan = companyCountry === 'jordan';

  const currency = isJordan ? 'JOD' : 'USD';
  const amount = isJordan
    ? parseFloat(invoice.totalValueJD) || 0
    : parseFloat(invoice.totalValueUSD) || 0;

  if (amount <= 0) {
    throw new Error('Invoice amount must be greater than zero');
  }

  const orderId = `${registrationId}-${invoice.id}`;
  const returnUrl = `${config.urls.api}/payment/result?registrationId=${registrationId}&invoiceId=${invoice.id}`;

  // Build NVP POST body for MEPS Hosted Checkout
  // For MPGS version 67+, all interaction/display settings must be in INITIATE_CHECKOUT
  const postData = querystring.stringify({
    apiOperation: 'INITIATE_CHECKOUT',
    apiUsername: `merchant.${meps.merchantId}`,
    apiPassword: meps.apiPassword,
    merchant: meps.merchantId,
    'interaction.operation': 'PURCHASE',
    'interaction.returnUrl': returnUrl,
    'interaction.merchant.name': 'GAIF 2026',
    'interaction.displayControl.billingAddress': 'HIDE',
    'interaction.displayControl.customerEmail': 'HIDE',
    'interaction.displayControl.shipping': 'HIDE',
    'order.id': orderId,
    'order.amount': amount.toFixed(2),
    'order.currency': currency,
    'order.description': `GAIF 2026 Conference Registration - Invoice ${invoice.serialNumber}`,
  });

  const url = `${meps.gatewayUrl}/api/nvp/version/${meps.apiVersion}`;

  const response = await axios.post(url, postData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const parsed = parseNvpResponse(response.data);

  if (parsed.result !== 'SUCCESS') {
    console.error('MEPS session creation failed:', parsed);
    throw new Error(
      `Failed to create checkout session: ${
        parsed['error.explanation'] || parsed.result
      }`,
    );
  }

  return {
    sessionId: parsed['session.id'],
    successIndicator: parsed.successIndicator,
    orderId,
    amount,
    currency,
    serialNumber: invoice.serialNumber,
  };
};

/**
 * Retrieve order status from MEPS gateway using NVP API
 * @param {string} orderId - The order ID used when creating the session
 * @returns {Promise<Object>} Parsed order details from gateway
 */
const retrieveOrder = async orderId => {
  const postData = querystring.stringify({
    apiOperation: 'RETRIEVE_ORDER',
    apiUsername: `merchant.${meps.merchantId}`,
    apiPassword: meps.apiPassword,
    merchant: meps.merchantId,
    'order.id': orderId,
  });

  const url = `${meps.gatewayUrl}/api/nvp/version/${meps.apiVersion}`;

  const response = await axios.post(url, postData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return parseNvpResponse(response.data);
};

/**
 * Verify payment after redirect and update registration payment status
 * Also submits e-invoice to Jordan Fawaterkom system
 * @param {number} registrationId
 * @param {number} invoiceId
 * @returns {Promise<Object>} Payment verification result
 */
const verifyAndUpdatePayment = async (registrationId, invoiceId) => {
  const invoice = await Invoice.findByPk(invoiceId);
  if (!invoice || invoice.registrationId !== registrationId) {
    throw new Error('Invoice not found or does not match registration');
  }

  const orderId = `${registrationId}-${invoiceId}`;

  const orderData = await retrieveOrder(orderId);

  const isPaid =
    orderData.result === 'SUCCESS' &&
    (orderData.status === 'CAPTURED' || orderData.status === 'PURCHASED');

  if (isPaid) {
    // Update registration payment status
    await Registration.update(
      { paymentStatus: 'PAID' },
      { where: { id: registrationId } },
    );

    // Get paid amount and currency from order data
    const paidAmount =
      parseFloat(orderData['order.amount']) ||
      parseFloat(invoice.totalValueJD) ||
      0;
    const paidCurrency = orderData['order.currency'] || 'JOD';

    // Update invoice with payment source (ONLINE = MEPS gateway)
    await Invoice.update(
      { paymentSource: 'ONLINE' },
      { where: { id: invoiceId } },
    );
  }

  return {
    success: isPaid,
    status: orderData['order.status'] || orderData.result,
    orderId,
  };
};

/**
 * Create a Hosted Checkout session for a company invoice
 * @param {number} companyInvoiceId - CompanyInvoice ID
 * @returns {Promise<Object>} Session data
 */
const createCompanyCheckoutSession = async companyInvoiceId => {
  const invoice = await CompanyInvoice.findByPk(companyInvoiceId, {
    include: [
      {
        model: Company,
        as: 'company',
        include: [
          { model: Country, as: 'country', attributes: ['id', 'name'] },
        ],
      },
    ],
  });

  if (!invoice) {
    throw new Error('Company invoice not found');
  }

  if (invoice.status === 'PAID') {
    throw new Error('This invoice has already been paid');
  }

  // Determine currency based on company country (Jordan → JOD, otherwise → USD)
  const companyCountry = invoice.company?.country?.name?.toLowerCase();
  const isJordan = companyCountry === 'jordan';
  const currency = isJordan ? 'JOD' : 'USD';
  const amount = isJordan
    ? parseFloat(invoice.totalValueJD) || 0
    : parseFloat(invoice.totalValueUSD) || 0;

  if (amount <= 0) {
    throw new Error('Invoice amount must be greater than zero');
  }

  const orderId = `CI-${companyInvoiceId}`;
  const returnUrl = `${config.urls.api}/payment/company-result?companyInvoiceId=${companyInvoiceId}`;

  const postData = querystring.stringify({
    apiOperation: 'INITIATE_CHECKOUT',
    apiUsername: `merchant.${meps.merchantId}`,
    apiPassword: meps.apiPassword,
    merchant: meps.merchantId,
    'interaction.operation': 'PURCHASE',
    'interaction.returnUrl': returnUrl,
    'interaction.merchant.name': 'GAIF 2026',
    'interaction.displayControl.billingAddress': 'HIDE',
    'interaction.displayControl.customerEmail': 'HIDE',
    'interaction.displayControl.shipping': 'HIDE',
    'order.id': orderId,
    'order.amount': amount.toFixed(2),
    'order.currency': currency,
    'order.description': `GAIF 2026 - Company Invoice ${invoice.serialNumber}`,
  });

  const url = `${meps.gatewayUrl}/api/nvp/version/${meps.apiVersion}`;
  const response = await axios.post(url, postData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const parsed = parseNvpResponse(response.data);

  if (parsed.result !== 'SUCCESS') {
    console.error('MEPS company session creation failed:', parsed);
    throw new Error(
      `Failed to create checkout session: ${
        parsed['error.explanation'] || parsed.result
      }`,
    );
  }

  return {
    sessionId: parsed['session.id'],
    successIndicator: parsed.successIndicator,
    orderId,
    amount,
    currency,
    serialNumber: invoice.serialNumber,
    companyName: invoice.company?.name || '',
  };
};

/**
 * Verify company invoice payment and process per-registration receipts
 * Called after MEPS redirects back with payment result
 * @param {number} companyInvoiceId - CompanyInvoice ID
 * @returns {Promise<Object>} Payment result
 */
const verifyAndUpdateCompanyPayment = async companyInvoiceId => {
  // Fetch company invoice with all linked registration items
  const companyInvoice = await CompanyInvoice.findByPk(companyInvoiceId, {
    include: [
      {
        model: Company,
        as: 'company',
        include: [
          { model: Country, as: 'country', attributes: ['id', 'name'] },
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
              'firstName',
              'lastName',
              'email',
              'profileId',
              'position',
              'companyId',
            ],
          },
          {
            model: Invoice,
            as: 'invoice',
            attributes: [
              'id',
              'registrationId',
              'totalValueJD',
              'totalValueUSD',
            ],
          },
        ],
      },
    ],
  });

  if (!companyInvoice) {
    throw new Error('Company invoice not found');
  }

  const orderId = `CI-${companyInvoiceId}`;
  const orderData = await retrieveOrder(orderId);

  const isPaid =
    orderData.result === 'SUCCESS' &&
    (orderData['order.status'] === 'CAPTURED' ||
      orderData['order.status'] === 'PURCHASED');

  if (!isPaid) {
    return {
      success: false,
      status: orderData['order.status'] || orderData.result,
      orderId,
    };
  }

  // Determine currency
  const companyCountry = companyInvoice.company?.country?.name?.toLowerCase();
  const isJordan = companyCountry === 'jordan';
  const paidCurrency = isJordan ? 'JOD' : 'USD';
  const paidAmount =
    parseFloat(orderData['order.amount']) ||
    (isJordan
      ? parseFloat(companyInvoice.totalValueJD)
      : parseFloat(companyInvoice.totalValueUSD)) ||
    0;

  // 1. Mark company invoice as PAID
  await CompanyInvoice.update(
    {
      status: 'PAID',
      paidAmount,
      paidCurrency,
      paidAt: new Date(),
      paymentReference: orderId,
    },
    { where: { id: companyInvoiceId } },
  );

  // 2. Process each registration: update invoice + registration, submit to Fawaterkom, send receipt
  const processRegistrationItem = async item => {
    const { invoice: individualInvoice, registration } = item;

    if (!individualInvoice || !registration) {
      return {
        registrationId: item.registrationId,
        success: false,
        error: 'Missing invoice or registration data',
      };
    }

    const itemAmount = isJordan
      ? parseFloat(individualInvoice.totalValueJD) || 0
      : parseFloat(individualInvoice.totalValueUSD) || 0;

    // Update individual invoice with payment details
    await Invoice.update(
      {
        paidAmount: itemAmount,
        paidCurrency,
        paidAt: new Date(),
        paymentSource: 'ONLINE',
      },
      { where: { id: individualInvoice.id } },
    );

    // Mark registration as PAID
    await Registration.update(
      { paymentStatus: 'PAID' },
      { where: { id: registration.id } },
    );

    return {
      registrationId: registration.id,
      invoiceId: individualInvoice.id,
      success: true,
    };
  };

  const settled = await Promise.allSettled(
    companyInvoice.registrationItems.map(item =>
      processRegistrationItem(item).catch(err => {
        console.error(
          `Error processing registration ${item.registrationId}:`,
          err.message,
        );
        return {
          registrationId: item.registrationId,
          success: false,
          error: err.message,
        };
      }),
    ),
  );

  const results = settled.map(s =>
    s.status === 'fulfilled'
      ? s.value
      : { success: false, error: s.reason?.message },
  );

  return {
    success: true,
    status: 'PAID',
    orderId,
    companyInvoiceId,
    registrationsProcessed: results.length,
    results,
  };
};

/**
 * Create a Hosted Checkout session for a meeting room invoice
 * @param {number} meetingRoomInvoiceId
 * @returns {Promise<Object>} Session data
 */
const createMeetingRoomCheckoutSession = async meetingRoomInvoiceId => {
  const invoice = await MeetingRoomInvoice.findByPk(meetingRoomInvoiceId);

  if (!invoice) {
    throw new Error('Meeting room invoice not found');
  }

  if (invoice.status === 'paid') {
    throw new Error('This invoice has already been paid');
  }

  const amount = parseFloat(invoice.totalValueJD) || 0;
  const currency = 'JOD';

  if (amount <= 0) {
    throw new Error('Invoice amount must be greater than zero');
  }

  const orderId = `MRI-${meetingRoomInvoiceId}`;
  const returnUrl = `${config.urls.api}/payment/meeting-room-result?meetingRoomInvoiceId=${meetingRoomInvoiceId}`;

  const postData = querystring.stringify({
    apiOperation: 'INITIATE_CHECKOUT',
    apiUsername: `merchant.${meps.merchantId}`,
    apiPassword: meps.apiPassword,
    merchant: meps.merchantId,
    'interaction.operation': 'PURCHASE',
    'interaction.returnUrl': returnUrl,
    'interaction.merchant.name': 'GAIF 2026',
    'interaction.displayControl.billingAddress': 'HIDE',
    'interaction.displayControl.customerEmail': 'HIDE',
    'interaction.displayControl.shipping': 'HIDE',
    'order.id': orderId,
    'order.amount': amount.toFixed(2),
    'order.currency': currency,
    'order.description': `GAIF 2026 - Meeting Room Invoice ${invoice.serialNumber}`,
  });

  const url = `${meps.gatewayUrl}/api/nvp/version/${meps.apiVersion}`;
  const response = await axios.post(url, postData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const parsed = parseNvpResponse(response.data);

  if (parsed.result !== 'SUCCESS') {
    console.error('MEPS meeting room session creation failed:', parsed);
    throw new Error(
      `Failed to create checkout session: ${
        parsed['error.explanation'] || parsed.result
      }`,
    );
  }

  return {
    sessionId: parsed['session.id'],
    successIndicator: parsed.successIndicator,
    orderId,
    amount,
    currency,
    serialNumber: invoice.serialNumber,
    company: invoice.company,
  };
};

/**
 * Verify meeting room invoice payment and update status
 * @param {number} meetingRoomInvoiceId
 * @returns {Promise<Object>} Payment result
 */
const verifyAndUpdateMeetingRoomPayment = async meetingRoomInvoiceId => {
  const invoice = await MeetingRoomInvoice.findByPk(meetingRoomInvoiceId);

  if (!invoice) {
    throw new Error('Meeting room invoice not found');
  }

  const orderId = `MRI-${meetingRoomInvoiceId}`;
  const orderData = await retrieveOrder(orderId);

  const isPaid =
    orderData.result === 'SUCCESS' &&
    (orderData['order.status'] === 'CAPTURED' ||
      orderData['order.status'] === 'PURCHASED');

  if (!isPaid) {
    return {
      success: false,
      status: orderData['order.status'] || orderData.result,
      orderId,
    };
  }

  const paidAmount =
    parseFloat(orderData['order.amount']) ||
    parseFloat(invoice.totalValueJD) ||
    0;

  await MeetingRoomInvoice.update(
    {
      status: 'paid',
      paidAmount,
      paidCurrency: 'JOD',
      paidAt: new Date(),
    },
    { where: { id: meetingRoomInvoiceId } },
  );

  console.log(`Meeting room invoice ${invoice.serialNumber} marked as PAID`);

  // Send receipt email after payment success
  try {
    const meetingRoomInvoiceService = require('./meetingRoomInvoice.service');
    const updatedInvoice = await MeetingRoomInvoice.findByPk(
      meetingRoomInvoiceId,
    );
    await meetingRoomInvoiceService.sendMeetingRoomReceiptEmail(
      updatedInvoice.toJSON(),
    );
  } catch (emailErr) {
    console.error(
      'Error sending meeting room receipt email:',
      emailErr.message,
    );
  }

  return {
    success: true,
    status: 'paid',
    orderId,
    meetingRoomInvoiceId,
    serialNumber: invoice.serialNumber,
  };
};

module.exports = {
  createCheckoutSession,
  retrieveOrder,
  verifyAndUpdatePayment,
  createCompanyCheckoutSession,
  verifyAndUpdateCompanyPayment,
  createMeetingRoomCheckoutSession,
  verifyAndUpdateMeetingRoomPayment,
};
