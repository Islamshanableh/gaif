/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const { sendEmailWithAttachment } = require('./common/email.service');
const registrationTokenService = require('./registrationToken.service');
const invoiceService = require('./invoice.service');

// Get email configuration from config
const getEmailConfig = () => ({
  // Base URLs for actions
  baseUrl: config.urls.frontend,
  apiBaseUrl: config.urls.api,

  // External links
  updateRegistrationUrl: config.urls.updateRegistration,
  paymentUrl: config.urls.payment,
  visaFormUrl: config.urls.visaForm,
  partnersUrl: config.urls.partners,
  partnershipOpportunitiesUrl: config.urls.partnershipOpportunities,
});

/**
 * Get the email header image attachment for CID embedding
 * @returns {Object} Nodemailer attachment object
 */
const getEmailHeaderAttachment = () => ({
  filename: 'emailHeader.png',
  path: path.join(__dirname, '..', 'templates', 'emailHeader.png'),
  cid: 'emailHeader',
});

/**
 * Load email template from file
 * @param {string} templateName - Template file name (without extension)
 * @returns {string} Template HTML
 */
const loadTemplate = templateName => {
  const templatePath = path.join(
    __dirname,
    '..',
    'templates',
    'emails',
    `${templateName}.html`,
  );
  return fs.readFileSync(templatePath, 'utf8');
};

/**
 * Replace template variables with actual values
 * @param {string} template - HTML template
 * @param {Object} variables - Variables to replace
 * @returns {string} Processed template
 */
const processTemplate = (template, variables) => {
  let processed = template;
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processed = processed.replace(regex, variables[key] || '');
  });
  return processed;
};

/**
 * Send confirmation request email to company
 * @param {Object} registration - Registration data with associations
 * @returns {Promise}
 */
const sendCompanyConfirmationEmail = async registration => {
  try {
    if (!registration.company || !registration.company.email) {
      console.log('No company email found for registration:', registration.id);
      return;
    }

    const emailConfig = getEmailConfig();

    // Generate secure tokens for confirm/decline actions (stored in DB)
    const confirmToken =
      await registrationTokenService.generateCompanyConfirmToken(
        registration.id,
        registration.companyId,
      );
    const declineToken =
      await registrationTokenService.generateCompanyDeclineToken(
        registration.id,
        registration.companyId,
      );

    // Build action URLs
    const confirmUrl = `${emailConfig.apiBaseUrl}/registration/company-action/confirm?token=${confirmToken}`;
    const declineUrl = `${emailConfig.apiBaseUrl}/registration/company-action/decline?token=${declineToken}`;

    // Load and process template
    const template = loadTemplate('companyConfirmation');
    const participantName = `${registration.firstName || ''} ${
      registration.middleName || ''
    } ${registration.lastName || ''}`.trim();

    const variables = {
      participantName,
      participantPosition: registration.position || '',
      participantNationality: registration.nationality?.name || '',
      participantMobile: registration.mobile || '',
      participantEmail: registration.email || '',
      participationType: registration.participation?.title || '',
      companyName: registration.company?.name || '',
      confirmUrl,
      declineUrl,
    };

    const html = processTemplate(template, variables);

    await sendEmailWithAttachment(
      registration.company.email,
      'GAIF 2026 - New Registration Confirmation Request',
      html,
      [getEmailHeaderAttachment()],
    );

    console.log(
      `Company confirmation email sent to ${registration.company.email} for registration ${registration.id}`,
    );
  } catch (error) {
    console.error('Error sending company confirmation email:', error);
    throw error;
  }
};

/**
 * Send registration declined email to participant
 * @param {Object} registration - Registration data
 * @returns {Promise}
 */
const sendRegistrationDeclinedEmail = async registration => {
  try {
    if (!registration.email) {
      console.log(
        'No participant email found for registration:',
        registration.id,
      );
      return;
    }

    const template = loadTemplate('registrationDeclined');
    const html = processTemplate(template, {});

    await sendEmailWithAttachment(
      registration.email,
      'GAIF 2026 - Registration Status Update',
      html,
      [getEmailHeaderAttachment()],
    );

    console.log(
      `Declined email sent to ${registration.email} for registration ${registration.id}`,
    );
  } catch (error) {
    console.error('Error sending declined email:', error);
    throw error;
  }
};

/**
 * Send registration approved/confirmed email to participant
 * @param {Object} registration - Registration data with associations
 * @returns {Promise}
 */
const sendRegistrationApprovedEmail = async registration => {
  try {
    if (!registration.email) {
      console.log(
        'No participant email found for registration:',
        registration.id,
      );
      return;
    }

    const emailConfig = getEmailConfig();

    // Generate secure tokens for viewing registration and invoice (stored in DB)
    const viewRegistrationToken =
      await registrationTokenService.generateViewRegistrationToken(
        registration.id,
      );
    const viewInvoiceToken =
      await registrationTokenService.generateViewInvoiceToken(registration.id);
    const updateRegistrationToken =
      await registrationTokenService.generateUpdateRegistrationToken(
        registration.id,
      );

    // Build secure URLs
    const viewRegistrationUrl = `${emailConfig.baseUrl}/display-info?token=${viewRegistrationToken}`;
    const viewInvoiceUrl = `${emailConfig.apiBaseUrl}/registration/invoice?token=${viewInvoiceToken}`;
    const updateRegistrationUrl =
      emailConfig.updateRegistrationUrl ||
      `${emailConfig.baseUrl}/registration/update?token=${updateRegistrationToken}`;

    const template = loadTemplate('registrationApproved');
    const participantName = `${registration.firstName || ''} ${
      registration.lastName || ''
    }`.trim();

    // Build payment URL pointing to the checkout endpoint
    const paymentUrl = `${emailConfig.apiBaseUrl}/payment/checkout?registrationId=${registration.id}`;

    const variables = {
      participantName,
      registrationId: registration.profileId || registration.id,
      viewRegistrationUrl,
      viewInvoiceUrl,
      updateRegistrationUrl,
      paymentUrl,
      visaFormUrl: emailConfig.visaFormUrl || '#',
      partnersUrl: emailConfig.partnersUrl || '#',
      partnershipOpportunitiesUrl:
        emailConfig.partnershipOpportunitiesUrl || '#',
    };

    const html = processTemplate(template, variables);

    // Generate invoice PDF to attach (use stored invoice if available)
    const attachments = [getEmailHeaderAttachment()];
    try {
      let invoice = await invoiceService.getInvoiceByRegistrationId(
        registration.id,
      );
      if (!invoice) {
        invoice = await invoiceService.createInvoice(registration);
      }
      const invoicePdf = await invoiceService.generateInvoicePDF(
        registration,
        invoice,
      );
      attachments.push({
        filename: `GAIF_Pre_Invoice_${registration.id}.pdf`,
        content: invoicePdf,
        contentType: 'application/pdf',
      });
      console.log(
        `Pre-Invoice PDF generated for registration ${registration.id}`,
      );
    } catch (pdfError) {
      console.error('Error generating invoice PDF:', pdfError);
      // Continue without attachment if PDF generation fails
    }

    // Send email with invoice attachment
    await sendEmailWithAttachment(
      registration.email,
      'Thank you for your registration.',
      html,
      attachments,
    );

    console.log(
      `Approved email with invoice sent to ${registration.email} for registration ${registration.id}`,
    );
  } catch (error) {
    console.error('Error sending approved email:', error);
    throw error;
  }
};

/**
 * Handle registration completion - send appropriate emails based on participation type
 * @param {Object} registration - Full registration data with associations
 * @returns {Promise}
 */
const handleRegistrationComplete = async registration => {
  try {
    const requiresCompanyConfirmation =
      registration.participation?.requireConfirmationFromCompany === true;

    if (requiresCompanyConfirmation) {
      // Flow 1: Send email to company for confirmation
      await sendCompanyConfirmationEmail(registration);
    } else {
      // Flow 2: Auto-confirmed — create invoice before sending approval email
      try {
        await invoiceService.createInvoice(registration);
      } catch (invoiceError) {
        console.error(
          'Error creating invoice for auto-confirmed registration:',
          invoiceError,
        );
      }
      await sendRegistrationApprovedEmail(registration);
    }
  } catch (error) {
    console.error('Error handling registration completion:', error);
    // Don't throw - we don't want email failures to break registration
  }
};

/**
 * Handle company confirmation action
 * @param {Object} registration - Registration data
 * @returns {Promise}
 */
const handleCompanyConfirm = async registration => {
  try {
    // Send approved email to participant
    await sendRegistrationApprovedEmail(registration);
  } catch (error) {
    console.error('Error handling company confirmation:', error);
    throw error;
  }
};

/**
 * Handle company decline action
 * @param {Object} registration - Registration data
 * @returns {Promise}
 */
const handleCompanyDecline = async registration => {
  try {
    // Send declined email to participant
    await sendRegistrationDeclinedEmail(registration);
  } catch (error) {
    console.error('Error handling company decline:', error);
    throw error;
  }
};

/**
 * Send payment receipt email to participant after successful payment
 * @param {Object} registration - Registration data with associations
 * @param {Object} invoice - Invoice data with payment info and QR code
 * @returns {Promise}
 */
const sendPaymentReceiptEmail = async (registration, invoice) => {
  try {
    if (!registration.email) {
      console.log(
        'No participant email found for registration:',
        registration.id,
      );
      return;
    }

    const emailConfig = getEmailConfig();

    // Generate secure tokens for viewing registration and invoice
    const viewRegistrationToken =
      await registrationTokenService.generateViewRegistrationToken(
        registration.id,
      );
    const viewInvoiceToken =
      await registrationTokenService.generateViewInvoiceToken(registration.id);

    // Build secure URLs
    const viewRegistrationUrl = `${emailConfig.baseUrl}/display-info?token=${viewRegistrationToken}`;
    const viewInvoiceUrl = `${emailConfig.apiBaseUrl}/registration/invoice?token=${viewInvoiceToken}`;

    // Load and process template
    const template = loadTemplate('paymentReceipt');
    const participantName = `${registration.firstName || ''} ${
      registration.lastName || ''
    }`.trim();

    // Format payment date
    const moment = require('moment');
    const paymentDate = invoice.paidAt
      ? moment(invoice.paidAt).format('DD/MM/YYYY HH:mm')
      : moment().format('DD/MM/YYYY HH:mm');

    // Format paid amount with currency
    const paidAmount = `${parseFloat(invoice.paidAmount || 0).toFixed(2)} ${
      invoice.paidCurrency || 'USD'
    }`;

    const variables = {
      participantName,
      invoiceNumber: invoice.serialNumber || '',
      paidAmount,
      paymentDate,
      registrationId: registration.profileId || registration.id,
      viewRegistrationUrl,
      viewInvoiceUrl,
    };

    const html = processTemplate(template, variables);

    // Prepare attachments
    const attachments = [getEmailHeaderAttachment()];

    // Generate payment receipt PDF with QR code
    try {
      const receiptPdf = await invoiceService.generatePaymentReceiptPDF(
        registration,
        invoice,
      );
      attachments.push({
        filename: `GAIF_Invoice_${invoice.serialNumber || registration.id}.pdf`,
        content: receiptPdf,
        contentType: 'application/pdf',
      });
      console.log(`Invoice PDF generated for registration ${registration.id}`);
    } catch (pdfError) {
      console.error('Error generating payment receipt PDF:', pdfError);
      // Continue without attachment if PDF generation fails
    }

    // Send email
    await sendEmailWithAttachment(
      registration.email,
      'GAIF 2026 - Invoice',
      html,
      attachments,
    );

    console.log(
      `Invoice email sent to ${registration.email} for registration ${registration.id}`,
    );
  } catch (error) {
    console.error('Error sending payment receipt email:', error);
    throw error;
  }
};

/**
 * Resend confirmation email to a registration with the latest data and invoice
 * @param {number} registrationId - Registration ID
 * @returns {Promise<Object>} Result with success status
 */
const resendConfirmationEmail = async registrationId => {
  const {
    Registration,
    Company,
    Country,
    ParticipationType,
    Spouse,
    Accommodation,
    HotelRoom,
    RegistrationTrip,
    Trip,
  } = require('./db.service');

  // Get full registration data with all associations
  const registration = await Registration.findByPk(registrationId, {
    include: [
      {
        model: Company,
        as: 'company',
        include: [{ model: Country, as: 'country' }],
      },
      { model: Country, as: 'nationality' },
      { model: ParticipationType, as: 'participation' },
      { model: Spouse, as: 'spouse' },
      { model: Accommodation, as: 'ammanHotel' },
      { model: HotelRoom, as: 'ammanRoom' },
      { model: Accommodation, as: 'deadSeaHotel' },
      { model: HotelRoom, as: 'deadSeaRoom' },
      {
        model: RegistrationTrip,
        as: 'trips',
        include: [{ model: Trip, as: 'trip' }],
      },
    ],
  });

  if (!registration) {
    throw new Error('Registration not found');
  }

  if (!registration.email) {
    throw new Error('Registration has no email address');
  }

  const regData = registration.toJSON();

  // Get the latest invoice
  let invoice = await invoiceService.getInvoiceByRegistrationId(registrationId);
  if (!invoice) {
    // Create invoice if none exists
    invoice = await invoiceService.createInvoice(regData);
  }

  const emailConfig = getEmailConfig();

  // Generate secure tokens for viewing registration and invoice
  const viewRegistrationToken =
    await registrationTokenService.generateViewRegistrationToken(registrationId);
  const viewInvoiceToken =
    await registrationTokenService.generateViewInvoiceToken(registrationId);
  const updateRegistrationToken =
    await registrationTokenService.generateUpdateRegistrationToken(registrationId);

  // Build secure URLs
  const viewRegistrationUrl = `${emailConfig.baseUrl}/display-info?token=${viewRegistrationToken}`;
  const viewInvoiceUrl = `${emailConfig.apiBaseUrl}/registration/invoice?token=${viewInvoiceToken}`;
  const updateRegistrationUrl =
    emailConfig.updateRegistrationUrl ||
    `${emailConfig.baseUrl}/registration/update?token=${updateRegistrationToken}`;

  const template = loadTemplate('registrationApproved');
  const participantName = `${registration.firstName || ''} ${
    registration.lastName || ''
  }`.trim();

  // Build payment URL pointing to the checkout endpoint
  const paymentUrl = `${emailConfig.apiBaseUrl}/payment/checkout?registrationId=${registrationId}`;

  const variables = {
    participantName,
    registrationId: registration.profileId || registration.id,
    viewRegistrationUrl,
    viewInvoiceUrl,
    updateRegistrationUrl,
    paymentUrl,
    visaFormUrl: emailConfig.visaFormUrl || '#',
    partnersUrl: emailConfig.partnersUrl || '#',
    partnershipOpportunitiesUrl: emailConfig.partnershipOpportunitiesUrl || '#',
  };

  const html = processTemplate(template, variables);

  // Generate invoice PDF to attach
  const attachments = [getEmailHeaderAttachment()];
  try {
    const invoicePdf = await invoiceService.generateInvoicePDF(regData, invoice);
    attachments.push({
      filename: `GAIF_Pre_Invoice_${registration.id}.pdf`,
      content: invoicePdf,
      contentType: 'application/pdf',
    });
    console.log(`Pre-Invoice PDF generated for registration ${registration.id}`);
  } catch (pdfError) {
    console.error('Error generating invoice PDF:', pdfError);
    // Continue without attachment if PDF generation fails
  }

  // Send email with invoice attachment
  await sendEmailWithAttachment(
    registration.email,
    'Thank you for your registration.',
    html,
    attachments,
  );

  console.log(
    `Confirmation email resent to ${registration.email} for registration ${registration.id}`,
  );

  return {
    success: true,
    email: registration.email,
    registrationId: registration.id,
    profileId: registration.profileId,
    invoiceSerialNumber: invoice.serialNumber,
  };
};

module.exports = {
  getEmailConfig,
  sendCompanyConfirmationEmail,
  sendRegistrationDeclinedEmail,
  sendRegistrationApprovedEmail,
  sendPaymentReceiptEmail,
  handleRegistrationComplete,
  handleCompanyConfirm,
  handleCompanyDecline,
  loadTemplate,
  processTemplate,
  resendConfirmationEmail,
};
