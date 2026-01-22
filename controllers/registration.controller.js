const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { registrationService } = require('../services');
const { uploadFileToDb } = require('../utils/fileUpload');

// Create full registration in one API call
exports.createRegistration = catchAsync(async (req, res) => {
  const payload = req?.body;

  // Handle file uploads - store in database
  if (req.files) {
    // Participant picture
    if (req.files.participantPicture) {
      const uploadedFile = await uploadFileToDb(
        req.files.participantPicture,
        'registration',
        null,
        'participantPicture',
      );
      payload.participantPictureId = uploadedFile.id;
    }

    // Passport copy
    if (req.files.passportCopy) {
      const uploadedFile = await uploadFileToDb(
        req.files.passportCopy,
        'registration',
        null,
        'passportCopy',
      );
      payload.passportCopyId = uploadedFile.id;
    }

    // Residency document
    if (req.files.residency) {
      const uploadedFile = await uploadFileToDb(
        req.files.residency,
        'registration',
        null,
        'residency',
      );
      payload.residencyId = uploadedFile.id;
    }

    // Visa form
    if (req.files.visaForm) {
      const uploadedFile = await uploadFileToDb(
        req.files.visaForm,
        'registration',
        null,
        'visaForm',
      );
      payload.visaFormId = uploadedFile.id;
    }

    // Spouse passport copy
    if (req.files.spousePassportCopy && payload.spouse) {
      const uploadedFile = await uploadFileToDb(
        req.files.spousePassportCopy,
        'spouse',
        null,
        'passportCopy',
      );
      payload.spouse.passportCopyId = uploadedFile.id;
    }

    // Spouse residency document
    if (req.files.spouseResidency && payload.spouse) {
      const uploadedFile = await uploadFileToDb(
        req.files.spouseResidency,
        'spouse',
        null,
        'residency',
      );
      payload.spouse.residencyId = uploadedFile.id;
    }

    // Spouse visa form
    if (req.files.spouseVisaForm && payload.spouse) {
      const uploadedFile = await uploadFileToDb(
        req.files.spouseVisaForm,
        'spouse',
        null,
        'visaForm',
      );
      payload.spouse.visaFormId = uploadedFile.id;
    }
  }

  // Parse JSON fields if they come as strings (for multipart/form-data)
  if (typeof payload.spouse === 'string') {
    payload.spouse = JSON.parse(payload.spouse);
  }
  if (typeof payload.trips === 'string') {
    payload.trips = JSON.parse(payload.trips);
  }

  // Convert string numbers to actual numbers
  if (payload.participationId)
    payload.participationId = parseInt(payload.participationId, 10);
  if (payload.companyId) payload.companyId = parseInt(payload.companyId, 10);
  if (payload.nationalityId)
    payload.nationalityId = parseInt(payload.nationalityId, 10);
  if (payload.ammanHotelId)
    payload.ammanHotelId = parseInt(payload.ammanHotelId, 10);
  if (payload.ammanRoomId)
    payload.ammanRoomId = parseInt(payload.ammanRoomId, 10);
  if (payload.deadSeaHotelId)
    payload.deadSeaHotelId = parseInt(payload.deadSeaHotelId, 10);
  if (payload.deadSeaRoomId)
    payload.deadSeaRoomId = parseInt(payload.deadSeaRoomId, 10);
  if (payload.toDeadSeaScheduleId) {
    payload.toDeadSeaScheduleId = parseInt(payload.toDeadSeaScheduleId, 10);
  }
  if (payload.fromDeadSeaScheduleId) {
    payload.fromDeadSeaScheduleId = parseInt(payload.fromDeadSeaScheduleId, 10);
  }

  // Convert string booleans
  if (typeof payload.hasSpouse === 'string') {
    payload.hasSpouse = payload.hasSpouse === 'true';
  }
  if (typeof payload.accommodationInAmman === 'string') {
    payload.accommodationInAmman = payload.accommodationInAmman === 'true';
  }
  if (typeof payload.accommodationInDeadSea === 'string') {
    payload.accommodationInDeadSea = payload.accommodationInDeadSea === 'true';
  }
  if (typeof payload.flightDetailsForSpouse === 'string') {
    payload.flightDetailsForSpouse = payload.flightDetailsForSpouse === 'true';
  }
  if (typeof payload.photographyConsent === 'string') {
    payload.photographyConsent = payload.photographyConsent === 'true';
  }
  if (typeof payload.needsVisa === 'string') {
    payload.needsVisa = payload.needsVisa === 'true';
  }
  if (typeof payload.needsVenueTransportation === 'string') {
    payload.needsVenueTransportation =
      payload.needsVenueTransportation === 'true';
  }

  const result = await registrationService.createFullRegistration(payload);
  res.status(httpStatus.CREATED).send({ result });
});

// Update registration
exports.updateRegistration = catchAsync(async (req, res) => {
  const id = parseInt(req?.query?.id, 10);
  const payload = req?.body;

  // Handle file uploads - store in database
  if (req.files) {
    if (req.files.participantPicture) {
      const uploadedFile = await uploadFileToDb(
        req.files.participantPicture,
        'registration',
        id,
        'participantPicture',
      );
      payload.participantPictureId = uploadedFile.id;
    }

    if (req.files.passportCopy) {
      const uploadedFile = await uploadFileToDb(
        req.files.passportCopy,
        'registration',
        id,
        'passportCopy',
      );
      payload.passportCopyId = uploadedFile.id;
    }

    if (req.files.residency) {
      const uploadedFile = await uploadFileToDb(
        req.files.residency,
        'registration',
        id,
        'residency',
      );
      payload.residencyId = uploadedFile.id;
    }

    if (req.files.visaForm) {
      const uploadedFile = await uploadFileToDb(
        req.files.visaForm,
        'registration',
        id,
        'visaForm',
      );
      payload.visaFormId = uploadedFile.id;
    }
  }

  // Parse JSON fields
  if (typeof payload.spouse === 'string') {
    payload.spouse = JSON.parse(payload.spouse);
  }
  if (typeof payload.trips === 'string') {
    payload.trips = JSON.parse(payload.trips);
  }

  // Update each section that has data
  let result;

  // Update personal info (Step 2)
  if (payload.firstName || payload.lastName || payload.email) {
    result = await registrationService.updatePersonalInfo(id, payload);
  }

  // Update spouse info (Step 3)
  if (payload.hasSpouse !== undefined) {
    result = await registrationService.updateSpouseInfo(id, payload);
  }

  // Update trips (Step 4)
  if (payload.trips) {
    result = await registrationService.updateTrips(id, payload);
  }

  // Update accommodation (Step 5)
  if (
    payload.accommodationInAmman !== undefined ||
    payload.accommodationInDeadSea !== undefined
  ) {
    result = await registrationService.updateAccommodation(id, payload);
  }

  // Update airport pickup (Step 7)
  if (payload.airportPickupOption) {
    result = await registrationService.updateAirportPickup(id, payload);
  }

  // Update transportation (Step 8)
  if (
    payload.transportationToDeadSea !== undefined ||
    payload.transportationFromDeadSea !== undefined
  ) {
    result = await registrationService.updateTransportation(id, payload);
  }

  // Update special request (Step 9)
  if (
    payload.specialRequest !== undefined ||
    payload.photographyConsent !== undefined
  ) {
    result = await registrationService.updateSpecialRequest(id, payload);
  }

  // Update visa documents
  if (
    payload.needsVisa !== undefined ||
    payload.passportCopyId ||
    payload.residencyId ||
    payload.visaFormId
  ) {
    result = await registrationService.uploadVisaDocuments(id, payload);
  }

  // Get full registration data
  result = await registrationService.getRegistrationById(id);
  res.status(httpStatus.OK).send({ result });
});

// Get registration by ID
exports.getRegistrationById = catchAsync(async (req, res) => {
  const id = parseInt(req?.query?.id, 10);
  const result = await registrationService.getRegistrationById(id);
  res.status(httpStatus.OK).send({ result });
});

// Get all registrations
exports.getRegistrations = catchAsync(async (req, res) => {
  const query = req?.query;
  const result = await registrationService.getRegistrations(query);
  res.status(httpStatus.OK).send({ result });
});

// Submit registration (final step)
exports.submitRegistration = catchAsync(async (req, res) => {
  const id = parseInt(req?.query?.id, 10);
  const result = await registrationService.submitRegistration(id);
  res.status(httpStatus.OK).send({ result });
});

// Delete registration
exports.deleteRegistration = catchAsync(async (req, res) => {
  const id = parseInt(req?.query?.id, 10);
  const result = await registrationService.deleteRegistration(id);
  res.status(httpStatus.OK).send({ result });
});

// Upload visa documents separately
exports.uploadVisaDocuments = catchAsync(async (req, res) => {
  const id = parseInt(req?.query?.id, 10);
  const payload = req?.body || {};

  if (req.files) {
    if (req.files.passportCopy) {
      const uploadedFile = await uploadFileToDb(
        req.files.passportCopy,
        'registration',
        id,
        'passportCopy',
      );
      payload.passportCopyId = uploadedFile.id;
    }

    if (req.files.residency) {
      const uploadedFile = await uploadFileToDb(
        req.files.residency,
        'registration',
        id,
        'residency',
      );
      payload.residencyId = uploadedFile.id;
    }

    if (req.files.visaForm) {
      const uploadedFile = await uploadFileToDb(
        req.files.visaForm,
        'registration',
        id,
        'visaForm',
      );
      payload.visaFormId = uploadedFile.id;
    }
  }

  if (typeof payload.needsVisa === 'string') {
    payload.needsVisa = payload.needsVisa === 'true';
  }

  const result = await registrationService.uploadVisaDocuments(id, payload);
  res.status(httpStatus.OK).send({ result });
});

// Upload spouse visa documents
exports.uploadSpouseVisaDocuments = catchAsync(async (req, res) => {
  const id = parseInt(req?.query?.id, 10);
  const payload = {};

  if (req.files) {
    if (req.files.passportCopy) {
      const uploadedFile = await uploadFileToDb(
        req.files.passportCopy,
        'spouse',
        id,
        'passportCopy',
      );
      payload.passportCopyId = uploadedFile.id;
    }

    if (req.files.residency) {
      const uploadedFile = await uploadFileToDb(
        req.files.residency,
        'spouse',
        id,
        'residency',
      );
      payload.residencyId = uploadedFile.id;
    }

    if (req.files.visaForm) {
      const uploadedFile = await uploadFileToDb(
        req.files.visaForm,
        'spouse',
        id,
        'visaForm',
      );
      payload.visaFormId = uploadedFile.id;
    }
  }

  const result = await registrationService.uploadSpouseVisaDocuments(
    id,
    payload,
  );
  res.status(httpStatus.OK).send({ result });
});

// Get confirmed registration for roommate selection
exports.getConfirmedRegistrationForRoommate = catchAsync(async (req, res) => {
  const id = parseInt(req?.query?.id, 10);
  const result = await registrationService.getConfirmedRegistrationForRoommate(
    id,
  );
  res.status(httpStatus.OK).send({ result });
});

// Check WhatsApp uniqueness
exports.checkWhatsappUniqueness = catchAsync(async (req, res) => {
  const { whatsapp, excludeRegistrationId } = req?.query;
  const excludeId = excludeRegistrationId
    ? parseInt(excludeRegistrationId, 10)
    : null;
  const result = await registrationService.checkWhatsappUniqueness(
    whatsapp,
    excludeId,
  );
  res.status(httpStatus.OK).send({ result });
});
