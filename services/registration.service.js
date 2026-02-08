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
  File,
  RegistrationToken,
  Invoice,
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
  // Roommate associations (self-referencing)
  {
    model: Registration,
    as: 'ammanRoommate',
    attributes: ['id', 'firstName', 'middleName', 'lastName'],
  },
  {
    model: Registration,
    as: 'deadSeaRoommate',
    attributes: ['id', 'firstName', 'middleName', 'lastName'],
  },
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

// Helper function to get next shared ID (used for both profileId and spouseId)
// Looks at MAX across both Registrations.profileId and Spouses.spouseId
const getNextSharedId = async () => {
  const [results] = await sequelize.query(
    `SELECT GREATEST(
      COALESCE((SELECT MAX("profileId") FROM "Registrations"), 0),
      COALESCE((SELECT MAX("spouseId") FROM "Spouses"), 0)
    ) AS "maxId" FROM DUAL`,
    { type: sequelize.QueryTypes.SELECT },
  );
  const maxId = results?.maxId || 0;
  return maxId + 1;
};

// Step 1: Create initial registration (companyId is now required)
exports.createRegistration = async payload => {
  // Check WhatsApp uniqueness before creating registration
  if (payload.whatsapp) {
    const existingWhatsapp = await Registration.findOne({
      where: {
        whatsapp: payload.whatsapp,
        isActive: true,
      },
      attributes: ['id'],
    });

    if (existingWhatsapp) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'This WhatsApp number is already registered. Please use a different number.',
      );
    }
  }

  // Get the next shared ID (shared counter across profileId and spouseId)
  const profileId = await getNextSharedId();

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
    profileId,
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
  // Check WhatsApp uniqueness if being updated
  if (payload.whatsapp) {
    const existingWhatsapp = await Registration.findOne({
      where: {
        whatsapp: payload.whatsapp,
        isActive: true,
        id: { [Op.ne]: id }, // Exclude current registration
      },
      attributes: ['id'],
    });

    if (existingWhatsapp) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'This WhatsApp number is already registered. Please use a different number.',
      );
    }
  }

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
      // Create new spouse with next available shared ID
      const spouseId = await getNextSharedId();
      await Spouse.create({
        ...spouseData,
        registrationId: id,
        spouseId,
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
  // Get the current registration to track room changes
  const currentRegistration = await Registration.findByPk(id, {
    attributes: [
      'registrationStatus',
      'ammanRoomId',
      'deadSeaRoomId',
      'accommodationInAmman',
      'accommodationInDeadSea',
    ],
  });

  if (!currentRegistration) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Registration not found');
  }

  const isSubmitted =
    currentRegistration.registrationStatus === 'SUBMITTED' ||
    currentRegistration.registrationStatus === 'CONFIRMED';

  // Track old and new room IDs for availability updates
  const oldAmmanRoomId = currentRegistration.ammanRoomId;
  const oldDeadSeaRoomId = currentRegistration.deadSeaRoomId;
  const newAmmanRoomId = payload.accommodationInAmman
    ? payload.ammanRoomId
    : null;
  const newDeadSeaRoomId = payload.accommodationInDeadSea
    ? payload.deadSeaRoomId
    : null;

  await Registration.update(
    {
      accommodationInAmman: payload.accommodationInAmman || false,
      ammanHotelId: payload.accommodationInAmman ? payload.ammanHotelId : null,
      ammanRoomId: newAmmanRoomId,
      ammanCheckIn: payload.accommodationInAmman ? payload.ammanCheckIn : null,
      ammanCheckOut: payload.accommodationInAmman
        ? payload.ammanCheckOut
        : null,
      ammanRoomType: payload.accommodationInAmman
        ? payload.ammanRoomType
        : null,
      ammanRoommateId: payload.ammanRoommateId,
      accommodationInDeadSea: payload.accommodationInDeadSea || false,
      deadSeaHotelId: payload.accommodationInDeadSea
        ? payload.deadSeaHotelId
        : null,
      deadSeaRoomId: newDeadSeaRoomId,
      deadSeaCheckIn: payload.accommodationInDeadSea
        ? payload.deadSeaCheckIn
        : null,
      deadSeaCheckOut: payload.accommodationInDeadSea
        ? payload.deadSeaCheckOut
        : null,
      deadSeaRoomType: payload.accommodationInDeadSea
        ? payload.deadSeaRoomType
        : null,
      deadSeaRoommateId: payload.deadSeaRoommateId,
    },
    { where: { id } },
  );

  // Update room availability only for submitted/confirmed registrations
  if (isSubmitted) {
    // Handle Amman room availability changes
    if (oldAmmanRoomId !== newAmmanRoomId) {
      // Increment availability for old room (if it existed)
      if (oldAmmanRoomId) {
        await HotelRoom.update(
          { available: sequelize.literal('"available" + 1') },
          { where: { id: oldAmmanRoomId } },
        );
      }
      // Decrement availability for new room (if selected)
      if (newAmmanRoomId) {
        await HotelRoom.update(
          { available: sequelize.literal('"available" - 1') },
          { where: { id: newAmmanRoomId } },
        );
      }
    }

    // Handle Dead Sea room availability changes
    if (oldDeadSeaRoomId !== newDeadSeaRoomId) {
      // Increment availability for old room (if it existed)
      if (oldDeadSeaRoomId) {
        await HotelRoom.update(
          { available: sequelize.literal('"available" + 1') },
          { where: { id: oldDeadSeaRoomId } },
        );
      }
      // Decrement availability for new room (if selected)
      if (newDeadSeaRoomId) {
        await HotelRoom.update(
          { available: sequelize.literal('"available" - 1') },
          { where: { id: newDeadSeaRoomId } },
        );
      }
    }
  }

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
      pickupLocation: payload.pickupLocation || null,
    },
    { where: { id } },
  );

  const result = await Registration.findByPk(id);

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
    profileId,
    firstName,
    middleName,
    lastName,
    countryId,
    exportAll,
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

  // Filter by profileId - search in both Registration.profileId and Spouse.spouseId
  // This is handled via include below when profileId is provided

  // Filter by name fields (case-insensitive for Oracle)
  if (firstName) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push(
      sequelize.where(
        sequelize.fn('UPPER', sequelize.col('Registration.firstName')),
        { [Op.like]: `%${firstName.toUpperCase()}%` },
      ),
    );
  }

  if (middleName) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push(
      sequelize.where(
        sequelize.fn('UPPER', sequelize.col('Registration.middleName')),
        { [Op.like]: `%${middleName.toUpperCase()}%` },
      ),
    );
  }

  if (lastName) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push(
      sequelize.where(
        sequelize.fn('UPPER', sequelize.col('Registration.lastName')),
        { [Op.like]: `%${lastName.toUpperCase()}%` },
      ),
    );
  }

  // Search by name or email (case-insensitive for Oracle)
  if (search) {
    const searchUpper = search.toUpperCase();
    where[Op.or] = [
      sequelize.where(
        sequelize.fn('UPPER', sequelize.col('Registration.firstName')),
        { [Op.like]: `%${searchUpper}%` },
      ),
      sequelize.where(
        sequelize.fn('UPPER', sequelize.col('Registration.lastName')),
        { [Op.like]: `%${searchUpper}%` },
      ),
      sequelize.where(
        sequelize.fn('UPPER', sequelize.col('Registration.email')),
        { [Op.like]: `%${searchUpper}%` },
      ),
      { mobile: { [Op.like]: `%${search}%` } },
    ];
  }

  // Build includes with tokens and invoice
  // Get base includes and modify company include if countryId filter is applied
  const baseIncludes = getRegistrationIncludes();

  // If filtering by company's country, modify the company include
  if (countryId) {
    const companyIncludeIndex = baseIncludes.findIndex(
      inc => inc.as === 'company',
    );
    if (companyIncludeIndex !== -1) {
      baseIncludes[companyIncludeIndex] = {
        ...baseIncludes[companyIncludeIndex],
        where: { countryId },
        required: true, // Make it required to filter out registrations without matching company country
      };
    }
  }

  // If filtering by profileId, search in both Registration.profileId AND Spouse.spouseId
  // Use a subquery for Oracle compatibility
  if (profileId) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push({
      [Op.or]: [
        { profileId },
        // Subquery to find registrations that have a spouse with matching spouseId
        sequelize.literal(
          `"Registration"."id" IN (SELECT "registrationId" FROM "Spouses" WHERE "spouseId" = ${parseInt(profileId, 10)})`,
        ),
      ],
    });
  }

  const includes = [
    ...baseIncludes,
    {
      model: RegistrationToken,
      as: 'tokens',
      attributes: ['id', 'token', 'tokenType', 'used', 'expiresAt'],
      required: false,
    },
    {
      model: Invoice,
      as: 'invoices',
      attributes: [
        'id',
        'serialNumber',
        'totalValueJD',
        'totalValueUSD',
        'createdAt',
      ],
      required: false,
    },
  ];

  const queryOptions = {
    where,
    order: [['createdAt', 'DESC']],
    include: includes,
    distinct: true,
  };

  // Skip pagination when exporting all data
  if (exportAll !== 'true') {
    queryOptions.offset = offset;
    queryOptions.limit = limit;
  }

  const { count: total, rows: registrations } =
    await Registration.findAndCountAll(queryOptions);

  const data = registrations.map(reg => {
    const regData = reg.toJSON();
    return processRegistrationData(regData);
  });

  // Summary stats: total registrations, total spouses, total double rooms
  // totalWithRooms counts each double room selection separately (Amman + Dead Sea)
  const [summaryResults] = await sequelize.query(
    `SELECT
      COUNT(*) AS "totalRegistrations",
      SUM(CASE WHEN "hasSpouse" = 1 THEN 1 ELSE 0 END) AS "totalSpouses",
      SUM(CASE WHEN "ammanRoomType" = 'double' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN "deadSeaRoomType" = 'double' THEN 1 ELSE 0 END) AS "totalWithRooms"
    FROM "Registrations"
    WHERE "isActive" = 1`,
    { raw: true },
  );

  const summary = {
    totalRegistrations:
      parseInt(summaryResults?.[0]?.totalRegistrations, 10) || 0,
    totalSpouses: parseInt(summaryResults?.[0]?.totalSpouses, 10) || 0,
    totalWithRooms: parseInt(summaryResults?.[0]?.totalWithRooms, 10) || 0,
  };

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary,
  };
};

// Admin update: update any fields on the registration
exports.adminUpdateRegistration = async (id, payload) => {
  const registration = await Registration.findByPk(id);
  if (!registration) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Registration not found');
  }

  // Capture old values for availability adjustments
  const oldAmmanRoomId = registration.ammanRoomId;
  const oldDeadSeaRoomId = registration.deadSeaRoomId;
  const oldAccommodationInAmman = registration.accommodationInAmman;
  const oldAccommodationInDeadSea = registration.accommodationInDeadSea;
  const oldCompanyId = registration.companyId;

  // Check if accommodation/company fields are actually changing
  const isAmmanRoomChanging =
    payload.ammanRoomId !== undefined && payload.ammanRoomId !== oldAmmanRoomId;
  const isDeadSeaRoomChanging =
    payload.deadSeaRoomId !== undefined &&
    payload.deadSeaRoomId !== oldDeadSeaRoomId;
  const isCompanyChanging =
    payload.companyId !== undefined && payload.companyId !== oldCompanyId;

  // Only check availability if the field is actually changing to a new value
  // Check Amman room availability only if changing to a different room
  if (isAmmanRoomChanging && payload.ammanRoomId) {
    const ammanRoom = await HotelRoom.findByPk(payload.ammanRoomId);
    if (ammanRoom && ammanRoom.available <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'No available rooms for selected Amman hotel room category',
      );
    }
  }

  // Check Dead Sea room availability only if changing to a different room
  if (isDeadSeaRoomChanging && payload.deadSeaRoomId) {
    const deadSeaRoom = await HotelRoom.findByPk(payload.deadSeaRoomId);
    if (deadSeaRoom && deadSeaRoom.available <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'No available rooms for selected Dead Sea hotel room category',
      );
    }
  }

  // Check company available seats only if changing to a different company
  // Only count the participant, spouse is not relevant for free seats
  if (isCompanyChanging && payload.companyId) {
    const companyData = await Company.findByPk(payload.companyId);
    if (
      companyData &&
      companyData.allowFreeSeats &&
      companyData.available !== null &&
      companyData.available <= 0
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'No available seats for this company',
      );
    }
  }

  // Build update data from all possible fields
  const updateData = {};
  const directFields = [
    'companyId',
    'participationId',
    'title',
    'firstName',
    'middleName',
    'lastName',
    'position',
    'nationalityId',
    'email',
    'telephone',
    'mobile',
    'whatsapp',
    'hasSpouse',
    'accommodationInAmman',
    'ammanHotelId',
    'ammanRoomId',
    'ammanCheckIn',
    'ammanCheckOut',
    'ammanRoomType',
    'ammanRoommateId',
    'accommodationInDeadSea',
    'deadSeaHotelId',
    'deadSeaRoomId',
    'deadSeaCheckIn',
    'deadSeaCheckOut',
    'deadSeaRoomType',
    'deadSeaRoommateId',
    'airportPickupOption',
    'arrivalDate',
    'arrivalAirline',
    'arrivalFlightNumber',
    'arrivalTime',
    'departureDate',
    'departureAirline',
    'departureFlightNumber',
    'departureTime',
    'flightDetailsForSpouse',
    'needsVenueTransportation',
    'pickupLocation',
    'specialRequest',
    'photographyConsent',
    'needsVisa',
    'registrationStatus',
    'paymentStatus',
    'totalPrice',
    'participantPictureId',
    'passportCopyId',
    'residencyId',
    'visaFormId',
  ];

  directFields.forEach(field => {
    if (payload[field] !== undefined) {
      updateData[field] = payload[field];
    }
  });

  if (Object.keys(updateData).length > 0) {
    await Registration.update(updateData, { where: { id } });
  }

  // Handle spouse update
  if (payload.spouse !== undefined) {
    if (payload.hasSpouse && payload.spouse) {
      const spouseFields = [
        'title',
        'firstName',
        'middleName',
        'lastName',
        'nationalityId',
        'whatsapp',
        'needsVisaHelp',
        'passportCopyId',
        'residencyId',
        'visaFormId',
      ];
      const spouseData = {};
      spouseFields.forEach(field => {
        if (payload.spouse[field] !== undefined) {
          spouseData[field] = payload.spouse[field];
        }
      });

      const existingSpouse = await Spouse.findOne({
        where: { registrationId: id },
      });
      if (existingSpouse) {
        await Spouse.update(spouseData, { where: { registrationId: id } });
      } else {
        const spouseId = await getNextSharedId();
        await Spouse.create({
          ...spouseData,
          registrationId: id,
          spouseId,
        });
      }
    } else if (payload.hasSpouse === false) {
      // Delete the spouse record
      await Spouse.destroy({ where: { registrationId: id } });

      // Clear spouse-related fields on the registration
      await Registration.update(
        {
          flightDetailsForSpouse: false,
        },
        { where: { id } },
      );

      // Delete all spouse trips (forSpouse: true)
      await RegistrationTrip.destroy({
        where: {
          registrationId: id,
          forSpouse: true,
        },
      });
    }
  }

  // Handle trips update
  if (payload.trips !== undefined) {
    await RegistrationTrip.destroy({ where: { registrationId: id } });
    if (payload.trips && payload.trips.length > 0) {
      await RegistrationTrip.bulkCreate(
        payload.trips.map(trip => ({
          registrationId: id,
          tripId: trip.tripId,
          forSpouse: trip.forSpouse || false,
        })),
      );
    }
  }

  // Reload updated registration with full associations
  const result = await Registration.findByPk(id, {
    include: getRegistrationIncludes(),
  });
  const updatedReg = result.toJSON();

  // --- Availability adjustments (only for SUBMITTED/CONFIRMED registrations) ---
  const activeStatuses = ['SUBMITTED', 'CONFIRMED'];
  if (activeStatuses.includes(updatedReg.registrationStatus)) {
    // Amman room availability
    const newAmmanRoomId = updatedReg.ammanRoomId;
    const newAmmanAccom = updatedReg.accommodationInAmman;
    if (
      oldAccommodationInAmman &&
      oldAmmanRoomId &&
      (!newAmmanAccom || oldAmmanRoomId !== newAmmanRoomId)
    ) {
      // Old room freed: increment availability
      await HotelRoom.update(
        { available: sequelize.literal('"available" + 1') },
        { where: { id: oldAmmanRoomId } },
      );
    }
    if (
      newAmmanAccom &&
      newAmmanRoomId &&
      (!oldAccommodationInAmman || oldAmmanRoomId !== newAmmanRoomId)
    ) {
      // New room taken: decrement availability
      await HotelRoom.update(
        { available: sequelize.literal('"available" - 1') },
        { where: { id: newAmmanRoomId } },
      );
    }

    // Dead Sea room availability
    const newDeadSeaRoomId = updatedReg.deadSeaRoomId;
    const newDeadSeaAccom = updatedReg.accommodationInDeadSea;
    if (
      oldAccommodationInDeadSea &&
      oldDeadSeaRoomId &&
      (!newDeadSeaAccom || oldDeadSeaRoomId !== newDeadSeaRoomId)
    ) {
      await HotelRoom.update(
        { available: sequelize.literal('"available" + 1') },
        { where: { id: oldDeadSeaRoomId } },
      );
    }
    if (
      newDeadSeaAccom &&
      newDeadSeaRoomId &&
      (!oldAccommodationInDeadSea || oldDeadSeaRoomId !== newDeadSeaRoomId)
    ) {
      await HotelRoom.update(
        { available: sequelize.literal('"available" - 1') },
        { where: { id: newDeadSeaRoomId } },
      );
    }

    // Company seats: handle company CHANGE
    // Only count the participant, spouse is not relevant for free seats
    const newCompanyId = updatedReg.companyId;
    if (oldCompanyId !== newCompanyId) {
      // Increment old company's available seats (if it was tracking availability)
      if (oldCompanyId) {
        const oldCompanyData = await Company.findByPk(oldCompanyId);
        if (
          oldCompanyData &&
          oldCompanyData.allowFreeSeats &&
          oldCompanyData.available !== null
        ) {
          await Company.update(
            { available: sequelize.literal('"available" + 1') },
            { where: { id: oldCompanyId } },
          );
        }
      }

      // Decrement new company's available seats (if tracking availability)
      if (newCompanyId && updatedReg.company?.allowFreeSeats) {
        await Company.update(
          { available: sequelize.literal('"available" - 1') },
          { where: { id: newCompanyId } },
        );
      }
    }
    // Note: Spouse changes do not affect company available seats
  }

  // --- Recalculate invoice if any fee-related fields changed ---
  const feeRelatedFields = [
    'participationId',
    'hasSpouse',
    'accommodationInAmman',
    'ammanHotelId',
    'ammanRoomId',
    'ammanCheckIn',
    'ammanCheckOut',
    'ammanRoomType',
    'accommodationInDeadSea',
    'deadSeaHotelId',
    'deadSeaRoomId',
    'deadSeaCheckIn',
    'deadSeaCheckOut',
    'deadSeaRoomType',
  ];
  const feeFieldChanged = feeRelatedFields.some(f => payload[f] !== undefined);
  const tripsChanged = payload.trips !== undefined;
  const spouseRemoved = payload.hasSpouse === false;

  if (feeFieldChanged || tripsChanged || spouseRemoved) {
    const invoiceService = require('./invoice.service');
    await invoiceService.createVersionedInvoice(updatedReg);
  }

  return updatedReg;
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
      { model: Company, as: 'company' },
    ],
  });

  if (!registration) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Registration not found');
  }

  const regData = registration.toJSON();

  // Check availability before submitting
  // 1. Check company available seats (only if allowFreeSeats is true)
  // Only count the participant, spouse is not relevant for free seats
  if (
    regData.company &&
    regData.company.allowFreeSeats &&
    regData.company.available !== null
  ) {
    if (regData.company.available <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'No available seats for this company',
      );
    }
  }

  // 2. Check Amman hotel room availability
  if (regData.accommodationInAmman && regData.ammanRoom) {
    if (regData.ammanRoom.available <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'No available rooms for selected Amman hotel room category',
      );
    }
  }

  // 3. Check Dead Sea hotel room availability
  if (regData.accommodationInDeadSea && regData.deadSeaRoom) {
    if (regData.deadSeaRoom.available <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'No available rooms for selected Dead Sea hotel room category',
      );
    }
  }

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

  // Decrement available counts after successful submission
  // 1. Decrement company available seats (only if allowFreeSeats is true)
  // Only count the participant, spouse is not relevant for free seats
  if (
    regData.company &&
    regData.company.allowFreeSeats &&
    regData.company.available !== null
  ) {
    await Company.update(
      { available: sequelize.literal('"available" - 1') },
      { where: { id: regData.companyId } },
    );
  }

  // // 2. Decrement Amman hotel room availability
  if (regData.accommodationInAmman && regData.ammanRoomId) {
    await HotelRoom.update(
      { available: sequelize.literal('"available" - 1') },
      { where: { id: regData.ammanRoomId } },
    );
  }

  // // 3. Decrement Dead Sea hotel room availability
  if (regData.accommodationInDeadSea && regData.deadSeaRoomId) {
    await HotelRoom.update(
      { available: sequelize.literal('"available" - 1') },
      { where: { id: regData.deadSeaRoomId } },
    );
  }

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
  // Get registration data before deleting to restore availability
  const registration = await Registration.findByPk(id);
  if (!registration) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Registration not found');
  }

  // Only restore availability if the registration was active
  if (registration.isActive) {
    // Restore company available seats (if applicable)
    // Only count the participant, spouse is not relevant for free seats
    if (registration.companyId) {
      const company = await Company.findByPk(registration.companyId);
      if (company && company.allowFreeSeats && company.available !== null) {
        await Company.update(
          { available: company.available + 1 },
          { where: { id: registration.companyId } },
        );
      }
    }

    // Restore Amman hotel room availability
    if (registration.accommodationInAmman && registration.ammanRoomId) {
      const ammanRoom = await HotelRoom.findByPk(registration.ammanRoomId);
      if (ammanRoom) {
        await HotelRoom.update(
          { available: ammanRoom.available + 1 },
          { where: { id: registration.ammanRoomId } },
        );
      }
    }

    // Restore Dead Sea hotel room availability
    if (registration.accommodationInDeadSea && registration.deadSeaRoomId) {
      const deadSeaRoom = await HotelRoom.findByPk(registration.deadSeaRoomId);
      if (deadSeaRoom) {
        await HotelRoom.update(
          { available: deadSeaRoom.available + 1 },
          { where: { id: registration.deadSeaRoomId } },
        );
      }
    }
  }

  // Soft delete the registration
  await Registration.update({ isActive: false }, { where: { id } });

  const result = await Registration.findByPk(id);
  return result.toJSON();
};

// Create full registration and submit (all steps at once)
exports.createFullRegistration = async payload => {
  // Check WhatsApp uniqueness before creating registration
  if (payload.whatsapp) {
    const existingWhatsapp = await Registration.findOne({
      where: {
        whatsapp: payload.whatsapp,
        isActive: true,
      },
      attributes: ['id'],
    });

    if (existingWhatsapp) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'This WhatsApp number is already registered. Please use a different number.',
      );
    }
  }

  // Check availability before creating registration
  // 1. Check company available seats (only if allowFreeSeats is true)
  // Only count the participant, spouse is not relevant for free seats
  let companyData = null;
  if (payload.companyId) {
    companyData = await Company.findByPk(payload.companyId);
    if (
      companyData &&
      companyData.allowFreeSeats &&
      companyData.available !== null &&
      companyData.available <= 0
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'No available seats for this company',
      );
    }
  }

  // 2. Check Amman hotel room availability
  if (payload.accommodationInAmman && payload.ammanRoomId) {
    const ammanRoom = await HotelRoom.findByPk(payload.ammanRoomId);
    if (ammanRoom && ammanRoom.available <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'No available rooms for selected Amman hotel room category',
      );
    }
  }

  // 3. Check Dead Sea hotel room availability
  if (payload.accommodationInDeadSea && payload.deadSeaRoomId) {
    const deadSeaRoom = await HotelRoom.findByPk(payload.deadSeaRoomId);
    if (deadSeaRoom && deadSeaRoom.available <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'No available rooms for selected Dead Sea hotel room category',
      );
    }
  }

  // Get participation type and rooms for price calculation
  let participationType = null;
  let ammanRoom = null;
  let deadSeaRoom = null;

  if (payload.participationId) {
    participationType = await ParticipationType.findByPk(
      payload.participationId,
    );
  }
  if (payload.ammanRoomId) {
    ammanRoom = await HotelRoom.findByPk(payload.ammanRoomId);
  }
  if (payload.deadSeaRoomId) {
    deadSeaRoom = await HotelRoom.findByPk(payload.deadSeaRoomId);
  }

  // Calculate total price
  let totalPrice = 0;

  // Add participation fee
  if (participationType && participationType.price) {
    totalPrice += participationType.price;
  }

  // Add spouse fee if applicable
  if (payload.hasSpouse && participationType?.spouse) {
    totalPrice += participationType.price || 0;
  }

  // Add trip fees
  if (payload.trips && payload.trips.length > 0) {
    for (const tripData of payload.trips) {
      const trip = await Trip.findByPk(tripData.tripId);
      if (trip) {
        totalPrice += parseFloat(trip.price) || 0;
      }
    }
  }

  // Add accommodation fees
  if (payload.accommodationInAmman && ammanRoom) {
    totalPrice += ammanRoom.double || ammanRoom.single || 0;
  }

  if (payload.accommodationInDeadSea && deadSeaRoom) {
    totalPrice += deadSeaRoom.double || deadSeaRoom.single || 0;
  }

  // Get the next shared ID for profileId
  // If there's a spouse, reserve the next ID for them too
  const profileId = await getNextSharedId();
  const spouseId = payload.hasSpouse && payload.spouse ? profileId + 1 : null;

  const transaction = await sequelize.transaction();

  try {
    // Create registration with all data - status is SUBMITTED
    const registrationData = {
      companyId: payload.companyId,
      participationId: payload.participationId,
      profileId,
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
      ammanRoomType: payload.ammanRoomType,
      ammanRoommateId: payload.ammanRoommateId,
      accommodationInDeadSea: payload.accommodationInDeadSea || false,
      deadSeaHotelId: payload.deadSeaHotelId,
      deadSeaRoomId: payload.deadSeaRoomId,
      deadSeaCheckIn: payload.deadSeaCheckIn,
      deadSeaCheckOut: payload.deadSeaCheckOut,
      deadSeaRoomType: payload.deadSeaRoomType,
      deadSeaRoommateId: payload.deadSeaRoommateId,
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
      pickupLocation: payload.pickupLocation || null,
      specialRequest: payload.specialRequest,
      photographyConsent: payload.photographyConsent || false,
      needsVisa: payload.needsVisa || false,
      totalPrice,
      registrationStatus: 'SUBMITTED',
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

    // Create spouse if provided (spouseId was pre-calculated above)
    if (payload.hasSpouse && payload.spouse && spouseId) {
      await Spouse.create(
        {
          registrationId: registration.id,
          spouseId,
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

    // Decrement available counts
    // 1. Decrement company available seats (only if allowFreeSeats is true)
    // Only count the participant, spouse is not relevant for free seats
    if (payload.companyId && companyData && companyData.allowFreeSeats) {
      await Company.update(
        { available: sequelize.literal('"available" - 1') },
        { where: { id: payload.companyId }, transaction },
      );
    }

    // 2. Decrement Amman hotel room availability
    if (payload.accommodationInAmman && payload.ammanRoomId) {
      await HotelRoom.update(
        { available: sequelize.literal('"available" - 1') },
        { where: { id: payload.ammanRoomId }, transaction },
      );
    }

    // 3. Decrement Dead Sea hotel room availability
    if (payload.accommodationInDeadSea && payload.deadSeaRoomId) {
      await HotelRoom.update(
        { available: sequelize.literal('"available" - 1') },
        { where: { id: payload.deadSeaRoomId }, transaction },
      );
    }

    await transaction.commit();

    // Get full registration data with all associations
    const fullRegistration = await Registration.findByPk(registration.id, {
      include: getRegistrationIncludes(),
    });

    // Send appropriate emails based on participation type
    // This is done asynchronously - don't wait for it
    const registrationNotificationService = require('./registrationNotification.service');
    registrationNotificationService
      .handleRegistrationComplete(fullRegistration.toJSON())
      .catch(err => console.error('Error sending registration emails:', err));

    return fullRegistration.toJSON();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Get confirmed registration by ID for roommate selection
// Returns only firstName and lastName if the registration is confirmed
exports.getConfirmedRegistrationForRoommate = async id => {
  const registration = await Registration.findOne({
    where: {
      profileId: id,
      [Op.or]: [
        { registrationStatus: 'CONFIRMED' },
        { registrationStatus: 'SUBMITTED' },
      ],
      isActive: true,
    },
    attributes: ['id', 'firstName', 'lastName'],
  });

  if (!registration) {
    return { exists: false };
  }

  return {
    exists: true,
    id: registration.id,
    firstName: registration.firstName,
    lastName: registration.lastName,
  };
};

// Check if WhatsApp number is already used by another participant
exports.checkWhatsappUniqueness = async (
  whatsapp,
  excludeRegistrationId = null,
) => {
  const where = {
    whatsapp: `+${whatsapp}`,
    isActive: true,
  };

  // Exclude current registration when updating
  if (excludeRegistrationId) {
    where.id = { [Op.ne]: excludeRegistrationId };
  }

  const existingRegistration = await Registration.findOne({
    where,
    attributes: ['id'],
  });

  return {
    exists: !!existingRegistration,
  };
};
