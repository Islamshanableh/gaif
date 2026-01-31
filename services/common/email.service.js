const axios = require('axios');
const fs = require('fs');
const config = require('../../config/config');

// Cache access token to avoid refreshing on every email
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Get a valid access token using the refresh token
 * Caches the token until it expires
 */
const getAccessToken = async () => {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  const tenantId = config.email.tenantId || 'common';
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: config.email.clientId,
    client_secret: config.email.clientSecret,
    refresh_token: config.email.refreshToken,
    grant_type: 'refresh_token',
    scope: 'https://graph.microsoft.com/Mail.Send',
  });

  const response = await axios.post(tokenUrl, params);
  cachedToken = response.data.access_token;
  tokenExpiry = Date.now() + response.data.expires_in * 1000;

  return cachedToken;
};

/**
 * Send email via Microsoft Graph API
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} [options.text] - Plain text body
 * @param {string} [options.html] - HTML body
 * @param {Array} [options.attachments] - Attachments array
 */
const sendViaGraph = async ({ to, subject, text, html, attachments = [] }) => {
  const accessToken = await getAccessToken();

  const message = {
    subject,
    body: {
      contentType: html ? 'HTML' : 'Text',
      content: html || text || '',
    },
    from: {
      emailAddress: {
        name: config.email.fromName,
        address: config.email.user,
      },
    },
    toRecipients: [
      {
        emailAddress: { address: to },
      },
    ],
  };

  // Add attachments if provided
  if (attachments.length > 0) {
    message.attachments = attachments.map(att => {
      let contentBytes;

      if (att.content && Buffer.isBuffer(att.content)) {
        // Buffer content (e.g. generated PDF)
        contentBytes = att.content.toString('base64');
      } else if (att.content) {
        contentBytes = Buffer.from(att.content).toString('base64');
      } else if (att.path) {
        // File path (e.g. nodemailer-style attachment)
        contentBytes = fs.readFileSync(att.path).toString('base64');
      }

      const graphAttachment = {
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.filename || att.name || 'attachment',
        contentType: att.contentType || att.type || 'application/octet-stream',
        contentBytes,
      };

      // Handle inline/CID attachments for embedded images
      if (att.cid) {
        graphAttachment.contentId = att.cid;
        graphAttachment.isInline = true;
      }

      return graphAttachment;
    });
  }

  const response = await axios.post(
    `https://graph.microsoft.com/v1.0/users/${config.email.user}/sendMail`,
    { message, saveToSentItems: true },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );

  return response;
};

/**
 * Send plain text email
 * @param {string} email - Recipient email
 * @param {string} message - Email message (plain text)
 * @param {string} subject - Email subject
 * @returns {Promise}
 */
exports.sendEmail = async (email, message, subject) => {
  try {
    const result = await sendViaGraph({
      to: email,
      subject,
      text: message,
    });
    console.log('Email sent via Graph API to:', email);
    return result;
  } catch (error) {
    console.log('Error sending email:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Send HTML email
 * @param {string} email - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content
 * @param {string} [text] - Plain text fallback
 * @returns {Promise}
 */
exports.sendHtmlEmail = async (email, subject, html, text = '') => {
  try {
    const result = await sendViaGraph({
      to: email,
      subject,
      html,
      text: text || subject,
    });
    console.log('HTML email sent via Graph API to:', email);
    return result;
  } catch (error) {
    console.log(
      'Error sending HTML email:',
      error.response?.data || error.message,
    );
    throw error;
  }
};

/**
 * Send email with attachment
 * @param {string} email - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content
 * @param {Array} attachments - Array of attachment objects
 * @returns {Promise}
 */
exports.sendEmailWithAttachment = async (
  email,
  subject,
  html,
  attachments = [],
) => {
  try {
    const result = await sendViaGraph({
      to: email,
      subject,
      html,
      attachments,
    });
    console.log('Email with attachment sent via Graph API to:', email);
    return result;
  } catch (error) {
    console.log(
      'Error sending email with attachment:',
      error.response?.data || error.message,
    );
    throw error;
  }
};
