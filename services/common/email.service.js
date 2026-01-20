const nodemailer = require('nodemailer');
const config = require('../../config/config');

// Create reusable transporter
const createTransporter = () => {
  const transportConfig = {
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
  };

  // Use service if provided, otherwise use host/port
  if (config.email.service) {
    transportConfig.service = config.email.service;
  } else if (config.email.host) {
    transportConfig.host = config.email.host;
    transportConfig.port = config.email.port;
    transportConfig.secure = config.email.secure;
  }

  return nodemailer.createTransport(transportConfig);
};

// Get the from address
const getFromAddress = () => {
  return `"${config.email.fromName}" <${config.email.user}>`;
};

/**
 * Send plain text email
 * @param {string} email - Recipient email
 * @param {string} message - Email message (plain text)
 * @param {string} subject - Email subject
 * @returns {Promise}
 */
exports.sendEmail = async (email, message, subject) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: getFromAddress(),
    to: email,
    subject,
    text: message,
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log('Error sending email:', error);
        reject(error);
      } else {
        console.log('Email sent:', info.response);
        resolve(info);
      }
    });
  });
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
  const transporter = createTransporter();

  const mailOptions = {
    from: getFromAddress(),
    to: email,
    subject,
    html,
    text: text || subject,
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log('Error sending HTML email:', error);
        reject(error);
      } else {
        console.log('HTML email sent:', info.response);
        resolve(info);
      }
    });
  });
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
  const transporter = createTransporter();

  const mailOptions = {
    from: getFromAddress(),
    to: email,
    subject,
    html,
    attachments,
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log('Error sending email with attachment:', error);
        reject(error);
      } else {
        console.log('Email with attachment sent:', info.response);
        resolve(info);
      }
    });
  });
};
