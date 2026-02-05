/* eslint-disable no-console */
const axios = require('axios');
const querystring = require('querystring');
const config = require('../config/config');
const { Invoice, Registration, Company, Country } = require('./db.service');

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

  let fawaterkomResult = null;

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

    // Submit to Jordan Fawaterkom e-invoice system
    try {
      const invoiceService = require('./invoice.service');
      fawaterkomResult = await invoiceService.submitToFawaterkom(
        invoiceId,
        paidAmount,
        paidCurrency,
      );
      console.log(
        'Fawaterkom submission completed:',
        fawaterkomResult.fawaterkomResult?.success,
      );
    } catch (fawaterkomError) {
      // Log error but don't fail payment - payment was successful
      console.error('Fawaterkom submission error:', fawaterkomError.message);
      fawaterkomResult = { success: false, error: fawaterkomError.message };
    }
  }

  return {
    success: isPaid,
    status: orderData['order.status'] || orderData.result,
    orderId,
    fawaterkomResult,
  };
};

module.exports = {
  createCheckoutSession,
  retrieveOrder,
  verifyAndUpdatePayment,
};
