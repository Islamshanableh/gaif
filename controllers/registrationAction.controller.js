const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
// const { registrationService } = require('../services');
const registrationTokenService = require('../services/registrationToken.service');
const registrationNotificationService = require('../services/registrationNotification.service');
const invoiceService = require('../services/invoice.service');
const {
  Registration,
  Company,
  Country,
  ParticipationType,
  Spouse,
  Trip,
  RegistrationTrip,
  Accommodation,
  HotelRoom,
  TransportationSchedule,
  File,
} = require('../services/db.service');

// File attributes for includes
const fileAttributes = ['id', 'fileKey', 'fileName', 'fileType', 'fileSize'];

/**
 * Get full registration with all associations
 */
const getFullRegistration = async id => {
  const registration = await Registration.findByPk(id, {
    include: [
      {
        model: Company,
        as: 'company',
        include: [
          { model: Country, as: 'country' },
          { model: File, as: 'logo', attributes: fileAttributes },
        ],
      },
      {
        model: ParticipationType,
        as: 'participation',
        include: [{ model: Country, as: 'countries' }],
      },
      { model: Country, as: 'nationality' },
      {
        model: Spouse,
        as: 'spouse',
        include: [
          { model: Country, as: 'nationality' },
          { model: File, as: 'passportCopy', attributes: fileAttributes },
          { model: File, as: 'residency', attributes: fileAttributes },
          { model: File, as: 'visaForm', attributes: fileAttributes },
        ],
      },
      {
        model: RegistrationTrip,
        as: 'trips',
        include: [
          {
            model: Trip,
            as: 'trip',
            include: [{ model: File, as: 'image', attributes: fileAttributes }],
          },
        ],
      },
      {
        model: Accommodation,
        as: 'ammanHotel',
        include: [{ model: HotelRoom, as: 'hotelRooms' }],
      },
      { model: HotelRoom, as: 'ammanRoom' },
      {
        model: Accommodation,
        as: 'deadSeaHotel',
        include: [{ model: HotelRoom, as: 'hotelRooms' }],
      },
      { model: HotelRoom, as: 'deadSeaRoom' },
      { model: TransportationSchedule, as: 'toDeadSeaSchedule' },
      { model: TransportationSchedule, as: 'fromDeadSeaSchedule' },
      { model: File, as: 'participantPicture', attributes: fileAttributes },
      { model: File, as: 'passportCopy', attributes: fileAttributes },
      { model: File, as: 'residency', attributes: fileAttributes },
      { model: File, as: 'visaForm', attributes: fileAttributes },
    ],
  });

  return registration;
};

/**
 * Generate result page HTML for company actions
 */
function generateResultPage(action, registration) {
  const participantName = `${registration.firstName || ''} ${
    registration.lastName || ''
  }`.trim();

  let title;
  let message;
  let bgColor;

  switch (action) {
    case 'confirmed':
      title = 'Registration Confirmed';
      message = `You have successfully confirmed the registration for <strong>${participantName}</strong>. An email has been sent to the participant with their registration details.`;
      bgColor = '#28a745';
      break;
    case 'declined':
      title = 'Registration Declined';
      message = `You have declined the registration for <strong>${participantName}</strong>. The participant has been notified.`;
      bgColor = '#dc3545';
      break;
    case 'already_confirmed':
      title = 'Already Confirmed';
      message = `This registration for <strong>${participantName}</strong> has already been confirmed.`;
      bgColor = '#17a2b8';
      break;
    case 'already_declined':
      title = 'Already Declined';
      message = `This registration for <strong>${participantName}</strong> has already been declined.`;
      bgColor = '#6c757d';
      break;
    default:
      title = 'Action Completed';
      message = 'The action has been completed.';
      bgColor = '#333';
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GAIF 2026 - ${title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f5f5f5;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 500px;
      margin: 0 auto;
      background: white;
      border-radius: 10px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background-color: ${bgColor};
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 30px;
      text-align: center;
    }
    .content p {
      color: #333;
      font-size: 16px;
      line-height: 1.6;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">${action.includes('confirm') ? '✓' : '✗'}</div>
      <h1>${title}</h1>
    </div>
    <div class="content">
      <p>${message}</p>
      <p style="color: #666; font-size: 14px; margin-top: 30px;">
        You can close this window.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate registration details page
 */
function generateRegistrationDetailsPage(registration) {
  const participantName = `${registration.firstName || ''} ${
    registration.middleName || ''
  } ${registration.lastName || ''}`.trim();

  // Build trip list
  let tripsHtml = '<p style="color: #666;">No trips selected</p>';
  if (registration.trips && registration.trips.length > 0) {
    tripsHtml = '<ul style="margin: 0; padding-left: 20px;">';
    registration.trips.forEach(regTrip => {
      if (regTrip.trip) {
        tripsHtml += `<li>${regTrip.trip.name}${
          regTrip.forSpouse ? ' (Spouse)' : ''
        }</li>`;
      }
    });
    tripsHtml += '</ul>';
  }

  // Build accommodation info
  let accommodationHtml = '';
  if (registration.accommodationInAmman && registration.ammanHotel) {
    accommodationHtml += `
      <tr><td style="color: #666; padding: 8px 0;">Amman Hotel</td><td>${
        registration.ammanHotel.hotelName || ''
      }</td></tr>
      <tr><td style="color: #666; padding: 8px 0;">Amman Room</td><td>${
        registration.ammanRoom?.roomCategory || ''
      }</td></tr>
      <tr><td style="color: #666; padding: 8px 0;">Amman Check-in</td><td>${
        registration.ammanCheckIn
          ? new Date(registration.ammanCheckIn).toLocaleDateString()
          : ''
      }</td></tr>
      <tr><td style="color: #666; padding: 8px 0;">Amman Check-out</td><td>${
        registration.ammanCheckOut
          ? new Date(registration.ammanCheckOut).toLocaleDateString()
          : ''
      }</td></tr>
    `;
  }
  if (registration.accommodationInDeadSea && registration.deadSeaHotel) {
    accommodationHtml += `
      <tr><td style="color: #666; padding: 8px 0;">Dead Sea Hotel</td><td>${
        registration.deadSeaHotel.hotelName || ''
      }</td></tr>
      <tr><td style="color: #666; padding: 8px 0;">Dead Sea Room</td><td>${
        registration.deadSeaRoom?.roomCategory || ''
      }</td></tr>
      <tr><td style="color: #666; padding: 8px 0;">Dead Sea Check-in</td><td>${
        registration.deadSeaCheckIn
          ? new Date(registration.deadSeaCheckIn).toLocaleDateString()
          : ''
      }</td></tr>
      <tr><td style="color: #666; padding: 8px 0;">Dead Sea Check-out</td><td>${
        registration.deadSeaCheckOut
          ? new Date(registration.deadSeaCheckOut).toLocaleDateString()
          : ''
      }</td></tr>
    `;
  }

  if (!accommodationHtml) {
    accommodationHtml =
      '<tr><td colspan="2" style="color: #666; padding: 8px 0;">No accommodation selected</td></tr>';
  }

  // Build spouse info
  let spouseHtml = '<p style="color: #666;">No spouse registered</p>';
  if (registration.hasSpouse && registration.spouse) {
    const spouseName = `${registration.spouse.firstName || ''} ${
      registration.spouse.lastName || ''
    }`.trim();
    spouseHtml = `
      <table style="width: 100%;">
        <tr><td style="color: #666; padding: 8px 0; width: 150px;">Name</td><td>${spouseName}</td></tr>
        <tr><td style="color: #666; padding: 8px 0;">Nationality</td><td>${
          registration.spouse.nationality?.name || ''
        }</td></tr>
        <tr><td style="color: #666; padding: 8px 0;">WhatsApp</td><td>${
          registration.spouse.whatsapp || ''
        }</td></tr>
      </table>
    `;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GAIF 2026 - Registration Details</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 10px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1a5276 0%, #2874a6 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 24px;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
    }
    .content {
      padding: 30px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      color: #1a5276;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #1a5276;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    table td {
      padding: 8px 0;
      vertical-align: top;
    }
    table td:first-child {
      color: #666;
      width: 180px;
    }
    .status-badge {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: bold;
    }
    .status-confirmed { background: #d4edda; color: #155724; }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-draft { background: #e2e3e5; color: #383d41; }
    .status-cancelled { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>GAIF 2026 Registration Details</h1>
      <p>Registration ID: ${registration.id}</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="section-title">Registration Status</div>
        <span class="status-badge status-${(
          registration.registrationStatus || 'draft'
        ).toLowerCase()}">${registration.registrationStatus || 'DRAFT'}</span>
      </div>

      <div class="section">
        <div class="section-title">Personal Information</div>
        <table>
          <tr><td>Name</td><td>${participantName}</td></tr>
          <tr><td>Title</td><td>${registration.title || ''}</td></tr>
          <tr><td>Position</td><td>${registration.position || ''}</td></tr>
          <tr><td>Nationality</td><td>${
            registration.nationality?.name || ''
          }</td></tr>
          <tr><td>Email</td><td>${registration.email || ''}</td></tr>
          <tr><td>Mobile</td><td>${registration.mobile || ''}</td></tr>
          <tr><td>WhatsApp</td><td>${registration.whatsapp || ''}</td></tr>
        </table>
      </div>

      <div class="section">
        <div class="section-title">Company & Participation</div>
        <table>
          <tr><td>Company</td><td>${registration.company?.name || ''}</td></tr>
          <tr><td>Participation Type</td><td>${
            registration.participation?.title || ''
          }</td></tr>
        </table>
      </div>

      <div class="section">
        <div class="section-title">Spouse Information</div>
        ${spouseHtml}
      </div>

      <div class="section">
        <div class="section-title">Trips</div>
        ${tripsHtml}
      </div>

      <div class="section">
        <div class="section-title">Accommodation</div>
        <table>
          ${accommodationHtml}
        </table>
      </div>

      <div class="section">
        <div class="section-title">Flight Details</div>
        <table>
          <tr><td>Airport Pickup</td><td>${
            registration.airportPickupOption || ''
          }</td></tr>
          <tr><td>Arrival Date</td><td>${
            registration.arrivalDate
              ? new Date(registration.arrivalDate).toLocaleDateString()
              : ''
          }</td></tr>
          <tr><td>Arrival Airline</td><td>${
            registration.arrivalAirline || ''
          }</td></tr>
          <tr><td>Arrival Flight</td><td>${
            registration.arrivalFlightNumber || ''
          }</td></tr>
          <tr><td>Departure Date</td><td>${
            registration.departureDate
              ? new Date(registration.departureDate).toLocaleDateString()
              : ''
          }</td></tr>
          <tr><td>Departure Airline</td><td>${
            registration.departureAirline || ''
          }</td></tr>
          <tr><td>Departure Flight</td><td>${
            registration.departureFlightNumber || ''
          }</td></tr>
        </table>
      </div>

      <div class="section">
        <div class="section-title">Additional Information</div>
        <table>
          <tr><td>Transportation to Venue</td><td>${
            registration.needsVenueTransportation ? 'Yes' : 'No'
          }</td></tr>
          <tr><td>Needs Visa</td><td>${
            registration.needsVisa ? 'Yes' : 'No'
          }</td></tr>
          <tr><td>Photography Consent</td><td>${
            registration.photographyConsent ? 'Yes' : 'No'
          }</td></tr>
          <tr><td>Special Request</td><td>${
            registration.specialRequest || 'None'
          }</td></tr>
        </table>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Handle company confirmation of registration
 * GET /api/v1/registration/company-action/confirm?token=xxx
 */
exports.companyConfirm = catchAsync(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Token is required');
  }

  // Verify token (marks as used for one-time tokens)
  let decoded;
  try {
    decoded = await registrationTokenService.verifyCompanyConfirmToken(token);
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, error.message);
  }

  const { registrationId, companyId } = decoded;

  // Get registration
  const registration = await getFullRegistration(registrationId);

  if (!registration) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Registration not found');
  }

  // Verify company matches
  if (registration.companyId !== companyId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Company mismatch');
  }

  // Check if already processed
  if (registration.registrationStatus === 'CONFIRMED') {
    // Return success page for already confirmed
    return res.send(generateResultPage('already_confirmed', registration));
  }

  if (registration.registrationStatus === 'CANCELLED') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Registration has been cancelled',
    );
  }

  // Update registration status
  await Registration.update(
    { registrationStatus: 'CONFIRMED' },
    { where: { id: registrationId } },
  );

  // Send approved email to participant
  const updatedRegistration = await getFullRegistration(registrationId);
  const regData = updatedRegistration.toJSON();

  // Create invoice on confirmation
  try {
    await invoiceService.createInvoice(regData);
  } catch (invoiceError) {
    console.error('Error creating invoice on confirm:', invoiceError);
  }

  await registrationNotificationService.handleCompanyConfirm(regData);

  // Return success page
  res.send(generateResultPage('confirmed', updatedRegistration));
});

/**
 * Handle company decline of registration
 * GET /api/v1/registration/company-action/decline?token=xxx
 */
exports.companyDecline = catchAsync(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Token is required');
  }

  // Verify token (marks as used for one-time tokens)
  let decoded;
  try {
    decoded = await registrationTokenService.verifyCompanyDeclineToken(token);
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, error.message);
  }

  const { registrationId, companyId } = decoded;

  // Get registration
  const registration = await getFullRegistration(registrationId);

  if (!registration) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Registration not found');
  }

  // Verify company matches
  if (registration.companyId !== companyId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Company mismatch');
  }

  // Check if already processed
  if (registration.registrationStatus === 'CANCELLED') {
    return res.send(generateResultPage('already_declined', registration));
  }

  if (registration.registrationStatus === 'CONFIRMED') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Registration has already been confirmed',
    );
  }

  // Update registration status
  await Registration.update(
    { registrationStatus: 'CANCELLED' },
    { where: { id: registrationId } },
  );

  // Send declined email to participant
  await registrationNotificationService.handleCompanyDecline(
    registration.toJSON(),
  );

  // Return success page
  res.send(generateResultPage('declined', registration));
});

/**
 * View registration details via secure token
 * GET /api/v1/registration/view?token=xxx
 * Returns JSON data with all registration details including files
 */
exports.viewRegistration = catchAsync(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Token is required');
  }

  // Verify token
  let decoded;
  try {
    decoded = await registrationTokenService.verifyViewRegistrationToken(token);
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, error.message);
  }

  const { registrationId } = decoded;

  // Get full registration
  const registration = await getFullRegistration(registrationId);

  if (!registration) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Registration not found');
  }

  // Return registration data as JSON
  res.status(httpStatus.OK).json(registration.toJSON());
});

/**
 * View/Download invoice via secure token
 * GET /api/v1/registration/invoice?token=xxx
 */
exports.viewInvoice = catchAsync(async (req, res) => {
  const { token } = req.query;
  const { download } = req.query;

  if (!token) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Token is required');
  }

  // Verify token
  let decoded;
  try {
    decoded = await registrationTokenService.verifyViewInvoiceToken(token);
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, error.message);
  }

  const { registrationId } = decoded;

  // Get full registration
  const registration = await getFullRegistration(registrationId);

  if (!registration) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Registration not found');
  }

  // Fetch stored invoice, or create on-demand if missing
  const regData = registration.toJSON();
  let invoice = await invoiceService.getInvoiceByRegistrationId(
    registrationId,
  );
  if (!invoice) {
    invoice = await invoiceService.createInvoice(regData);
  }

  // Generate PDF with stored invoice data
  const pdfBuffer = await invoiceService.generateInvoicePDF(regData, invoice);

  // Set headers
  const filename = `GAIF_Invoice_${registration.id}.pdf`;
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition':
      download === 'true'
        ? `attachment; filename="${filename}"`
        : `inline; filename="${filename}"`,
    'Content-Length': pdfBuffer.length,
  });

  res.send(pdfBuffer);
});
