const Joi = require('joi');

// Enum values
const titleEnum = ['MR', 'MRS', 'MS', 'DR', 'PROF'];
const airportPickupOptions = ['NEED_PICKUP', 'NO_PICKUP', 'PROVIDE_LATER'];
const transportationTypes = ['BY_COACH', 'OWN_TRANSPORTATION'];

// Step 1: Registration Type
exports.createRegistrationStep1 = {
  body: Joi.object().keys({
    participationId: Joi.number().required(),
    companyId: Joi.number().required(),
  }),
};

// Step 2: Personal Information
exports.updateRegistrationStep2 = {
  body: Joi.object().keys({
    title: Joi.string()
      .valid(...titleEnum)
      .optional(),
    firstName: Joi.string().max(100).required(),
    middleName: Joi.string().max(100).allow('', null).optional(),
    lastName: Joi.string().max(100).required(),
    position: Joi.string().max(200).required(),
    nationalityId: Joi.number().optional(),
    email: Joi.string().email().max(320).required(),
    telephone: Joi.string().max(20).allow('', null).optional(),
    mobile: Joi.string().max(20).required(),
    whatsapp: Joi.string().max(20).required(),
    // participantPicture is handled via file upload
  }),
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

// Step 3: Spouse Information
exports.updateRegistrationStep3 = {
  body: Joi.object().keys({
    hasSpouse: Joi.boolean().required(),
    spouse: Joi.when('hasSpouse', {
      is: true,
      then: Joi.object()
        .keys({
          title: Joi.string()
            .valid(...titleEnum)
            .optional(),
          firstName: Joi.string().max(100).required(),
          middleName: Joi.string().max(100).allow('', null).optional(),
          lastName: Joi.string().max(100).required(),
          nationalityId: Joi.number().optional(),
          needsVisaHelp: Joi.boolean().optional(),
        })
        .required(),
      otherwise: Joi.forbidden(),
    }),
  }),
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

// Step 4: Trips Selection
exports.updateRegistrationStep4 = {
  body: Joi.object().keys({
    trips: Joi.array()
      .items(
        Joi.object().keys({
          tripId: Joi.number().required(),
          forSpouse: Joi.boolean().default(false),
        }),
      )
      .optional(),
  }),
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

// Step 5: Accommodation
exports.updateRegistrationStep5 = {
  body: Joi.object().keys({
    accommodationInAmman: Joi.boolean().optional(),
    ammanHotelId: Joi.when('accommodationInAmman', {
      is: true,
      then: Joi.number().required(),
      otherwise: Joi.number().allow(null).optional(),
    }),
    ammanRoomId: Joi.when('accommodationInAmman', {
      is: true,
      then: Joi.number().required(),
      otherwise: Joi.number().allow(null).optional(),
    }),
    ammanCheckIn: Joi.when('accommodationInAmman', {
      is: true,
      then: Joi.date().required(),
      otherwise: Joi.date().allow(null).optional(),
    }),
    ammanCheckOut: Joi.when('accommodationInAmman', {
      is: true,
      then: Joi.date().required(),
      otherwise: Joi.date().allow(null).optional(),
    }),
    ammanPartnerProfileId: Joi.string().max(100).allow('', null).optional(),
    accommodationInDeadSea: Joi.boolean().optional(),
    deadSeaHotelId: Joi.when('accommodationInDeadSea', {
      is: true,
      then: Joi.number().required(),
      otherwise: Joi.number().allow(null).optional(),
    }),
    deadSeaRoomId: Joi.when('accommodationInDeadSea', {
      is: true,
      then: Joi.number().required(),
      otherwise: Joi.number().allow(null).optional(),
    }),
    deadSeaCheckIn: Joi.when('accommodationInDeadSea', {
      is: true,
      then: Joi.date().required(),
      otherwise: Joi.date().allow(null).optional(),
    }),
    deadSeaCheckOut: Joi.when('accommodationInDeadSea', {
      is: true,
      then: Joi.date().required(),
      otherwise: Joi.date().allow(null).optional(),
    }),
    deadSeaPartnerProfileId: Joi.string().max(100).allow('', null).optional(),
  }),
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

// Step 6: Book Flight (informational only, no data to save)

// Step 7: Airport Pickup & Flight Details
exports.updateRegistrationStep7 = {
  body: Joi.object().keys({
    airportPickupOption: Joi.string()
      .valid(...airportPickupOptions)
      .required(),
    arrivalDate: Joi.when('airportPickupOption', {
      is: 'NEED_PICKUP',
      then: Joi.date().required(),
      otherwise: Joi.date().allow(null).optional(),
    }),
    arrivalAirline: Joi.when('airportPickupOption', {
      is: 'NEED_PICKUP',
      then: Joi.string().max(100).required(),
      otherwise: Joi.string().max(100).allow('', null).optional(),
    }),
    arrivalFlightNumber: Joi.when('airportPickupOption', {
      is: 'NEED_PICKUP',
      then: Joi.string().max(50).required(),
      otherwise: Joi.string().max(50).allow('', null).optional(),
    }),
    arrivalTime: Joi.when('airportPickupOption', {
      is: 'NEED_PICKUP',
      then: Joi.string().max(10).required(),
      otherwise: Joi.string().max(10).allow('', null).optional(),
    }),
    departureDate: Joi.date().allow(null).optional(),
    departureAirline: Joi.string().max(100).allow('', null).optional(),
    departureFlightNumber: Joi.string().max(50).allow('', null).optional(),
    departureTime: Joi.string().max(10).allow('', null).optional(),
    flightDetailsForSpouse: Joi.boolean().optional(),
  }),
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

// Step 8: Transportation to/from Dead Sea
exports.updateRegistrationStep8 = {
  body: Joi.object().keys({
    transportationToDeadSea: Joi.string()
      .valid(...transportationTypes)
      .allow(null)
      .optional(),
    toDeadSeaScheduleId: Joi.when('transportationToDeadSea', {
      is: 'BY_COACH',
      then: Joi.number().required(),
      otherwise: Joi.number().allow(null).optional(),
    }),
    transportationFromDeadSea: Joi.string()
      .valid(...transportationTypes)
      .allow(null)
      .optional(),
    fromDeadSeaScheduleId: Joi.when('transportationFromDeadSea', {
      is: 'BY_COACH',
      then: Joi.number().required(),
      otherwise: Joi.number().allow(null).optional(),
    }),
  }),
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

// Step 9: Special Request
exports.updateRegistrationStep9 = {
  body: Joi.object().keys({
    specialRequest: Joi.string().max(2000).allow('', null).optional(),
    photographyConsent: Joi.boolean().optional(),
  }),
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

// Upload visa documents
exports.uploadVisaDocuments = {
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
  body: Joi.object().keys({
    needsVisa: Joi.boolean().optional(),
  }),
};

// Get registration by ID
exports.getById = {
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

// Submit registration (final step)
exports.submitRegistration = {
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

// Get all registrations (with filters)
exports.getRegistrations = {
  query: Joi.object().keys({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(10),
    companyId: Joi.number().optional(),
    participationId: Joi.number().optional(),
    status: Joi.string()
      .valid('DRAFT', 'SUBMITTED', 'CONFIRMED', 'CANCELLED')
      .optional(),
    paymentStatus: Joi.string()
      .valid('PENDING', 'PAID', 'PARTIAL', 'REFUNDED')
      .optional(),
  }),
};

// Full registration (all steps at once for API convenience)
exports.createFullRegistration = {
  body: Joi.object().keys({
    // Step 1
    participationId: Joi.number().required(),
    companyId: Joi.number().optional(), // Optional if isNewCompany is true
    // New Company fields (when user wants to add a new company)
    isNewCompany: Joi.boolean().optional(),
    newCompanyName: Joi.when('isNewCompany', {
      is: true,
      then: Joi.string().max(320).required(),
      otherwise: Joi.string().max(320).allow('', null).optional(),
    }),
    newCompanyEmail: Joi.when('isNewCompany', {
      is: true,
      then: Joi.string().email().max(320).required(),
      otherwise: Joi.string().email().max(320).allow('', null).optional(),
    }),
    // newCompanyLogo is handled via file upload
    // Step 2
    title: Joi.string()
      .valid(...titleEnum)
      .optional(),
    firstName: Joi.string().max(100).required(),
    middleName: Joi.string().max(100).allow('', null).optional(),
    lastName: Joi.string().max(100).required(),
    position: Joi.string().max(200).required(),
    nationalityId: Joi.number().optional(),
    email: Joi.string().email().max(320).required(),
    telephone: Joi.string().max(20).allow('', null).optional(),
    mobile: Joi.string().max(20).required(),
    whatsapp: Joi.string().max(20).required(),
    // Step 3
    hasSpouse: Joi.boolean().optional(),
    spouse: Joi.object()
      .keys({
        title: Joi.string()
          .valid(...titleEnum)
          .optional(),
        firstName: Joi.string().max(100).required(),
        middleName: Joi.string().max(100).allow('', null).optional(),
        lastName: Joi.string().max(100).required(),
        nationalityId: Joi.number().optional(),
        needsVisaHelp: Joi.boolean().optional(),
      })
      .when('hasSpouse', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
    // Step 4
    trips: Joi.array()
      .items(
        Joi.object().keys({
          tripId: Joi.number().required(),
          forSpouse: Joi.boolean().default(false),
        }),
      )
      .optional(),
    // Step 5
    accommodationInAmman: Joi.boolean().optional(),
    ammanHotelId: Joi.number().allow(null).optional(),
    ammanRoomId: Joi.number().allow(null).optional(),
    ammanCheckIn: Joi.date().allow(null).optional(),
    ammanCheckOut: Joi.date().allow(null).optional(),
    ammanPartnerProfileId: Joi.string().max(100).allow('', null).optional(),
    accommodationInDeadSea: Joi.boolean().optional(),
    deadSeaHotelId: Joi.number().allow(null).optional(),
    deadSeaRoomId: Joi.number().allow(null).optional(),
    deadSeaCheckIn: Joi.date().allow(null).optional(),
    deadSeaCheckOut: Joi.date().allow(null).optional(),
    deadSeaPartnerProfileId: Joi.string().max(100).allow('', null).optional(),
    // Step 7
    airportPickupOption: Joi.string()
      .valid(...airportPickupOptions)
      .optional(),
    arrivalDate: Joi.date().allow(null).optional(),
    arrivalAirline: Joi.string().max(100).allow('', null).optional(),
    arrivalFlightNumber: Joi.string().max(50).allow('', null).optional(),
    arrivalTime: Joi.string().max(10).allow('', null).optional(),
    departureDate: Joi.date().allow(null).optional(),
    departureAirline: Joi.string().max(100).allow('', null).optional(),
    departureFlightNumber: Joi.string().max(50).allow('', null).optional(),
    departureTime: Joi.string().max(10).allow('', null).optional(),
    flightDetailsForSpouse: Joi.boolean().optional(),
    // Step 8
    transportationToDeadSea: Joi.string()
      .valid(...transportationTypes)
      .allow(null)
      .optional(),
    toDeadSeaScheduleId: Joi.number().allow(null).optional(),
    transportationFromDeadSea: Joi.string()
      .valid(...transportationTypes)
      .allow(null)
      .optional(),
    fromDeadSeaScheduleId: Joi.number().allow(null).optional(),
    // Step 9
    specialRequest: Joi.string().max(2000).allow('', null).optional(),
    photographyConsent: Joi.boolean().optional(),
    // Visa
    needsVisa: Joi.boolean().optional(),
  }),
};
