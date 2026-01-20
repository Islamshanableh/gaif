/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
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
  HotelImages,
  TransportationSchedule,
  File,
  Op,
  sequelize,
} = require('./db.service');
const ApiError = require('../utils/ApiError');

// File attributes to include (without content)
const fileAttributes = ['id', 'fileKey', 'fileName', 'fileType', 'fileSize'];

// Common include configuration for registration queries
const getRegistrationIncludes = () => [
  {
    model: Company,
    as: 'company',
    include: [
      { model: Country, as: 'country' },
      { model: File, as: 'logo', attributes: fileAttributes },
    ],
  },
  { model: ParticipationType, as: 'participation' },
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
    include: [
      { model: HotelRoom, as: 'hotelRooms' },
      { model: HotelImages, as: 'hotelImages' },
    ],
  },
  { model: HotelRoom, as: 'ammanRoom' },
  {
    model: Accommodation,
    as: 'deadSeaHotel',
    include: [
      { model: HotelRoom, as: 'hotelRooms' },
      { model: HotelImages, as: 'hotelImages' },
    ],
  },
  { model: HotelRoom, as: 'deadSeaRoom' },
  { model: TransportationSchedule, as: 'toDeadSeaSchedule' },
  { model: TransportationSchedule, as: 'fromDeadSeaSchedule' },
  // Registration file associations
  { model: File, as: 'participantPicture', attributes: fileAttributes },
  { model: File, as: 'passportCopy', attributes: fileAttributes },
  { model: File, as: 'residency', attributes: fileAttributes },
  { model: File, as: 'visaForm', attributes: fileAttributes },
];

// Helper to process registration data
// Files are now stored in database, so no CDN prefix needed
// File data is included as associations with id, fileKey, fileName, fileType
const processRegistrationData = reg => {
  // No transformation needed - files are included as associations
  return reg;
};

// Step 1: Create initial registration (companyId is now required)
exports.createRegistration = async payload => {
  const result = await Registration.create({
    companyId: payload.companyId,
    participationId: payload.participationId,
    firstName: payload.firstName || '',
    lastName: payload.lastName || '',
    position: payload.position || '',
    email: payload.email || '',
    mobile: payload.mobile || '',
    whatsapp: payload.whatsapp || '',
    registrationStatus: 'DRAFT',
  });

  const registration = await Registration.findByPk(result.id, {
    include: [
      { model: Company, as: 'company' },
      { model: ParticipationType, as: 'participation' },
    ],
  });

  return registration.toJSON();
};

// Step 2: Update personal information
exports.updatePersonalInfo = async (id, payload) => {
  const registrationData = {
    title: payload.title,
    firstName: payload.firstName,
    middleName: payload.middleName,
    lastName: payload.lastName,
    position: payload.position,
    nationalityId: payload.nationalityId,
    email: payload.email,
    telephone: payload.telephone,
    mobile: payload.mobile,
    whatsapp: payload.whatsapp,
  };

  if (payload.participantPictureId) {
    registrationData.participantPictureId = payload.participantPictureId;
  }

  await Registration.update(registrationData, {
    where: { id },
  });

  const result = await Registration.findByPk(id, {
    include: [
      {
        model: Company,
        as: 'company',
        include: [{ model: File, as: 'logo', attributes: fileAttributes }],
      },
      { model: ParticipationType, as: 'participation' },
      { model: Country, as: 'nationality' },
      { model: File, as: 'participantPicture', attributes: fileAttributes },
    ],
  });

  return result.toJSON();
};

// Step 3: Update spouse information
exports.updateSpouseInfo = async (id, payload) => {
  const registration = await Registration.findByPk(id, {
    include: [{ model: Spouse, as: 'spouse' }],
  });

  if (!registration) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Registration not found');
  }

  // Update registration hasSpouse flag
  await Registration.update(
    { hasSpouse: payload.hasSpouse },
    { where: { id } },
  );

  if (payload.hasSpouse && payload.spouse) {
    const spouseData = {
      title: payload.spouse.title,
      firstName: payload.spouse.firstName,
      middleName: payload.spouse.middleName,
      lastName: payload.spouse.lastName,
      nationalityId: payload.spouse.nationalityId,
      whatsapp: payload.spouse.whatsapp,
      needsVisaHelp: payload.spouse.needsVisaHelp || false,
    };

    if (registration.spouse) {
      // Update existing spouse
      await Spouse.update(spouseData, {
        where: { registrationId: id },
      });
    } else {
      // Create new spouse
      await Spouse.create({
        ...spouseData,
        registrationId: id,
      });
    }
  } else if (!payload.hasSpouse && registration.spouse) {
    // Remove spouse if hasSpouse is false
    await Spouse.destroy({
      where: { registrationId: id },
    });
  }

  const result = await Registration.findByPk(id, {
    include: [
      { model: Company, as: 'company' },
      { model: ParticipationType, as: 'participation' },
      { model: Country, as: 'nationality' },
      {
        model: Spouse,
        as: 'spouse',
        include: [{ model: Country, as: 'nationality' }],
      },
    ],
  });

  return result.toJSON();
};

// Step 4: Update trips
exports.updateTrips = async (id, payload) => {
  // Delete existing trip selections
  await RegistrationTrip.destroy({
    where: { registrationId: id },
  });

  // Add new trip selections
  if (payload.trips && payload.trips.length > 0) {
    await RegistrationTrip.bulkCreate(
      payload.trips.map(trip => ({
        registrationId: id,
        tripId: trip.tripId,
        forSpouse: trip.forSpouse || false,
      })),
    );
  }

  const result = await Registration.findByPk(id, {
    include: [
      {
        model: RegistrationTrip,
        as: 'trips',
        include: [{ model: Trip, as: 'trip' }],
      },
    ],
  });

  return result.toJSON();
};

// Step 5: Update accommodation
exports.updateAccommodation = async (id, payload) => {
  await Registration.update(
    {
      accommodationInAmman: payload.accommodationInAmman || false,
      ammanHotelId: payload.accommodationInAmman ? payload.ammanHotelId : null,
      ammanRoomId: payload.accommodationInAmman ? payload.ammanRoomId : null,
      ammanCheckIn: payload.accommodationInAmman ? payload.ammanCheckIn : null,
      ammanCheckOut: payload.accommodationInAmman
        ? payload.ammanCheckOut
        : null,
      ammanPartnerProfileId: payload.ammanPartnerProfileId,
      accommodationInDeadSea: payload.accommodationInDeadSea || false,
      deadSeaHotelId: payload.accommodationInDeadSea
        ? payload.deadSeaHotelId
        : null,
      deadSeaRoomId: payload.accommodationInDeadSea
        ? payload.deadSeaRoomId
        : null,
      deadSeaCheckIn: payload.accommodationInDeadSea
        ? payload.deadSeaCheckIn
        : null,
      deadSeaCheckOut: payload.accommodationInDeadSea
        ? payload.deadSeaCheckOut
        : null,
      deadSeaPartnerProfileId: payload.deadSeaPartnerProfileId,
    },
    { where: { id } },
  );

  const result = await Registration.findByPk(id, {
    include: [
      { model: Accommodation, as: 'ammanHotel' },
      { model: HotelRoom, as: 'ammanRoom' },
      { model: Accommodation, as: 'deadSeaHotel' },
      { model: HotelRoom, as: 'deadSeaRoom' },
    ],
  });

  return result.toJSON();
};

// Step 7: Update airport pickup and flight details
exports.updateAirportPickup = async (id, payload) => {
  await Registration.update(
    {
      airportPickupOption: payload.airportPickupOption,
      arrivalDate: payload.arrivalDate,
      arrivalAirline: payload.arrivalAirline,
      arrivalFlightNumber: payload.arrivalFlightNumber,
      arrivalTime: payload.arrivalTime,
      departureDate: payload.departureDate,
      departureAirline: payload.departureAirline,
      departureFlightNumber: payload.departureFlightNumber,
      departureTime: payload.departureTime,
      flightDetailsForSpouse: payload.flightDetailsForSpouse || false,
    },
    { where: { id } },
  );

  const result = await Registration.findByPk(id);
  return result.toJSON();
};

// Step 5 (part): Update transportation/additional services
exports.updateTransportation = async (id, payload) => {
  await Registration.update(
    {
      needsVenueTransportation: payload.needsVenueTransportation || false,
      // Legacy fields for backward compatibility
      transportationToDeadSea: payload.transportationToDeadSea,
      toDeadSeaScheduleId:
        payload.transportationToDeadSea === 'BY_COACH'
          ? payload.toDeadSeaScheduleId
          : null,
      transportationFromDeadSea: payload.transportationFromDeadSea,
      fromDeadSeaScheduleId:
        payload.transportationFromDeadSea === 'BY_COACH'
          ? payload.fromDeadSeaScheduleId
          : null,
    },
    { where: { id } },
  );

  const result = await Registration.findByPk(id, {
    include: [
      { model: TransportationSchedule, as: 'toDeadSeaSchedule' },
      { model: TransportationSchedule, as: 'fromDeadSeaSchedule' },
    ],
  });

  return result.toJSON();
};

// Step 9: Update special request
exports.updateSpecialRequest = async (id, payload) => {
  await Registration.update(
    {
      specialRequest: payload.specialRequest,
      photographyConsent: payload.photographyConsent || false,
    },
    { where: { id } },
  );

  const result = await Registration.findByPk(id);
  return result.toJSON();
};

// Upload visa documents
exports.uploadVisaDocuments = async (id, payload) => {
  const updateData = {
    needsVisa: payload.needsVisa || false,
  };

  if (payload.passportCopyId) {
    updateData.passportCopyId = payload.passportCopyId;
  }

  if (payload.residencyId) {
    updateData.residencyId = payload.residencyId;
  }

  if (payload.visaFormId) {
    updateData.visaFormId = payload.visaFormId;
  }

  await Registration.update(updateData, { where: { id } });

  const result = await Registration.findByPk(id, {
    include: [
      { model: File, as: 'passportCopy', attributes: fileAttributes },
      { model: File, as: 'residency', attributes: fileAttributes },
      { model: File, as: 'visaForm', attributes: fileAttributes },
    ],
  });

  return result.toJSON();
};

// Upload spouse visa documents
exports.uploadSpouseVisaDocuments = async (registrationId, payload) => {
  const registration = await Registration.findByPk(registrationId, {
    include: [{ model: Spouse, as: 'spouse' }],
  });

  if (!registration || !registration.spouse) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Spouse not found');
  }

  const updateData = {};

  if (payload.passportCopyId) {
    updateData.passportCopyId = payload.passportCopyId;
  }

  if (payload.residencyId) {
    updateData.residencyId = payload.residencyId;
  }

  if (payload.visaFormId) {
    updateData.visaFormId = payload.visaFormId;
  }

  await Spouse.update(updateData, {
    where: { registrationId },
  });

  const result = await Spouse.findOne({
    where: { registrationId },
    include: [
      { model: Country, as: 'nationality' },
      { model: File, as: 'passportCopy', attributes: fileAttributes },
      { model: File, as: 'residency', attributes: fileAttributes },
      { model: File, as: 'visaForm', attributes: fileAttributes },
    ],
  });

  return result.toJSON();
};

// Get registration by ID
exports.getRegistrationById = async id => {
  const result = await Registration.findByPk(id, {
    include: getRegistrationIncludes(),
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Registration not found');
  }

  const data = result.toJSON();
  return processRegistrationData(data);
};

// Get all registrations with pagination and filters
exports.getRegistrations = async query => {
  const {
    page = 1,
    limit = 10,
    companyId,
    participationId,
    status,
    paymentStatus,
    search,
  } = query;
  const offset = (page - 1) * limit;

  const where = {
    isActive: true,
  };

  if (companyId) {
    where.companyId = companyId;
  }

  if (participationId) {
    where.participationId = participationId;
  }

  if (status) {
    where.registrationStatus = status;
  }

  if (paymentStatus) {
    where.paymentStatus = paymentStatus;
  }

  // Search by name or email
  if (search) {
    where[Op.or] = [
      { firstName: { [Op.like]: `%${search}%` } },
      { lastName: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { mobile: { [Op.like]: `%${search}%` } },
    ];
  }

  const { count: total, rows: registrations } =
    await Registration.findAndCountAll({
      where,
      offset,
      limit,
      order: [['createdAt', 'DESC']],
      include: getRegistrationIncludes(),
    });

  const data = registrations.map(reg => {
    const regData = reg.toJSON();
    return processRegistrationData(regData);
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Submit registration (final step)
exports.submitRegistration = async id => {
  const registration = await Registration.findByPk(id, {
    include: [
      { model: ParticipationType, as: 'participation' },
      { model: Spouse, as: 'spouse' },
      {
        model: RegistrationTrip,
        as: 'trips',
        include: [{ model: Trip, as: 'trip' }],
      },
      { model: HotelRoom, as: 'ammanRoom' },
      { model: HotelRoom, as: 'deadSeaRoom' },
    ],
  });

  if (!registration) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Registration not found');
  }

  const regData = registration.toJSON();

  // Calculate total price
  let totalPrice = 0;

  // Add participation fee
  if (regData.participation && regData.participation.price) {
    totalPrice += regData.participation.price;
  }

  // Add spouse fee if applicable
  if (regData.hasSpouse && regData.spouse && regData.participation?.spouse) {
    totalPrice += regData.participation.price || 0;
  }

  // Add trip fees
  if (regData.trips && regData.trips.length > 0) {
    regData.trips.forEach(regTrip => {
      if (regTrip.trip) {
        totalPrice += parseFloat(regTrip.trip.price) || 0;
      }
    });
  }

  // Add accommodation fees
  if (regData.accommodationInAmman && regData.ammanRoom) {
    totalPrice += regData.ammanRoom.double || regData.ammanRoom.single || 0;
  }

  if (regData.accommodationInDeadSea && regData.deadSeaRoom) {
    totalPrice += regData.deadSeaRoom.double || regData.deadSeaRoom.single || 0;
  }

  await Registration.update(
    {
      registrationStatus: 'SUBMITTED',
      totalPrice,
    },
    { where: { id } },
  );

  // Get full registration data with all associations for email
  const fullRegistration = await Registration.findByPk(id, {
    include: getRegistrationIncludes(),
  });

  // Send appropriate emails based on participation type
  // This is done asynchronously - don't wait for it
  const registrationNotificationService = require('./registrationNotification.service');
  registrationNotificationService
    .handleRegistrationComplete(fullRegistration.toJSON())
    .catch(err => console.error('Error sending registration emails:', err));

  return fullRegistration.toJSON();
};

// Delete registration (soft delete)
exports.deleteRegistration = async id => {
  await Registration.update({ isActive: false }, { where: { id } });

  const result = await Registration.findByPk(id);
  return result.toJSON();
};

// Create full registration (all steps at once)
exports.createFullRegistration = async payload => {
  const transaction = await sequelize.transaction();

  try {
    // Create registration with all data (companyId is now required)
    const registrationData = {
      companyId: payload.companyId,
      participationId: payload.participationId,
      title: payload.title,
      firstName: payload.firstName,
      middleName: payload.middleName,
      lastName: payload.lastName,
      position: payload.position,
      nationalityId: payload.nationalityId,
      email: payload.email,
      telephone: payload.telephone,
      mobile: payload.mobile,
      whatsapp: payload.whatsapp,
      hasSpouse: payload.hasSpouse || false,
      accommodationInAmman: payload.accommodationInAmman || false,
      ammanHotelId: payload.ammanHotelId,
      ammanRoomId: payload.ammanRoomId,
      ammanCheckIn: payload.ammanCheckIn,
      ammanCheckOut: payload.ammanCheckOut,
      ammanPartnerProfileId: payload.ammanPartnerProfileId,
      accommodationInDeadSea: payload.accommodationInDeadSea || false,
      deadSeaHotelId: payload.deadSeaHotelId,
      deadSeaRoomId: payload.deadSeaRoomId,
      deadSeaCheckIn: payload.deadSeaCheckIn,
      deadSeaCheckOut: payload.deadSeaCheckOut,
      deadSeaPartnerProfileId: payload.deadSeaPartnerProfileId,
      airportPickupOption: payload.airportPickupOption,
      arrivalDate: payload.arrivalDate,
      arrivalAirline: payload.arrivalAirline,
      arrivalFlightNumber: payload.arrivalFlightNumber,
      arrivalTime: payload.arrivalTime,
      departureDate: payload.departureDate,
      departureAirline: payload.departureAirline,
      departureFlightNumber: payload.departureFlightNumber,
      departureTime: payload.departureTime,
      flightDetailsForSpouse: payload.flightDetailsForSpouse || false,
      needsVenueTransportation: payload.needsVenueTransportation || false,
      transportationToDeadSea: payload.transportationToDeadSea,
      toDeadSeaScheduleId: payload.toDeadSeaScheduleId,
      transportationFromDeadSea: payload.transportationFromDeadSea,
      fromDeadSeaScheduleId: payload.fromDeadSeaScheduleId,
      specialRequest: payload.specialRequest,
      photographyConsent: payload.photographyConsent || false,
      needsVisa: payload.needsVisa || false,
      registrationStatus: 'DRAFT',
    };

    if (payload.participantPictureId) {
      registrationData.participantPictureId = payload.participantPictureId;
    }

    if (payload.passportCopyId) {
      registrationData.passportCopyId = payload.passportCopyId;
    }

    if (payload.residencyId) {
      registrationData.residencyId = payload.residencyId;
    }

    if (payload.visaFormId) {
      registrationData.visaFormId = payload.visaFormId;
    }

    const registration = await Registration.create(registrationData, {
      transaction,
    });

    // Create spouse if provided
    if (payload.hasSpouse && payload.spouse) {
      await Spouse.create(
        {
          registrationId: registration.id,
          title: payload.spouse.title,
          firstName: payload.spouse.firstName,
          middleName: payload.spouse.middleName,
          lastName: payload.spouse.lastName,
          nationalityId: payload.spouse.nationalityId,
          whatsapp: payload.spouse.whatsapp,
          needsVisaHelp: payload.spouse.needsVisaHelp || false,
          passportCopyId: payload.spouse.passportCopyId,
          residencyId: payload.spouse.residencyId,
          visaFormId: payload.spouse.visaFormId,
        },
        { transaction },
      );
    }

    // Create trips if provided
    if (payload.trips && payload.trips.length > 0) {
      await RegistrationTrip.bulkCreate(
        payload.trips.map(trip => ({
          registrationId: registration.id,
          tripId: trip.tripId,
          forSpouse: trip.forSpouse || false,
        })),
        { transaction },
      );
    }

    await transaction.commit();

    return exports.getRegistrationById(registration.id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
