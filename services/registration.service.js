/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
const { Prisma } = require('@prisma/client');
const { prisma } = require('./prisma.service');
const config = require('../config/config');
const ApiError = require('../utils/ApiError');

// Helper function to add CDN prefix to file paths
const addCdnPrefix = filePath => {
  if (filePath) {
    return `${config.cdnPrefix}/${filePath}`;
  }
  return filePath;
};

// Step 1: Create initial registration
exports.createRegistration = async payload => {
  const result = await prisma.registration.create({
    data: {
      companyId: payload.companyId,
      participationId: payload.participationId,
      firstName: payload.firstName || '',
      lastName: payload.lastName || '',
      position: payload.position || '',
      email: payload.email || '',
      mobile: payload.mobile || '',
      whatsapp: payload.whatsapp || '',
      registrationStatus: 'DRAFT',
    },
    include: {
      company: true,
      participation: true,
    },
  });

  return result;
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

  if (payload.participantPicture) {
    registrationData.participantPicture = payload.participantPicture;
  }

  const result = await prisma.registration.update({
    where: { id },
    data: registrationData,
    include: {
      company: true,
      participation: true,
      nationality: true,
    },
  });

  if (result.participantPicture) {
    result.participantPicture = addCdnPrefix(result.participantPicture);
  }

  return result;
};

// Step 3: Update spouse information
exports.updateSpouseInfo = async (id, payload) => {
  const registration = await prisma.registration.findUnique({
    where: { id },
    include: { spouse: true },
  });

  if (!registration) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Registration not found');
  }

  // Update registration hasSpouse flag
  await prisma.registration.update({
    where: { id },
    data: { hasSpouse: payload.hasSpouse },
  });

  if (payload.hasSpouse && payload.spouse) {
    const spouseData = {
      title: payload.spouse.title,
      firstName: payload.spouse.firstName,
      middleName: payload.spouse.middleName,
      lastName: payload.spouse.lastName,
      nationalityId: payload.spouse.nationalityId,
      needsVisaHelp: payload.spouse.needsVisaHelp || false,
    };

    if (registration.spouse) {
      // Update existing spouse
      await prisma.spouse.update({
        where: { registrationId: id },
        data: spouseData,
      });
    } else {
      // Create new spouse
      await prisma.spouse.create({
        data: {
          ...spouseData,
          registrationId: id,
        },
      });
    }
  } else if (!payload.hasSpouse && registration.spouse) {
    // Remove spouse if hasSpouse is false
    await prisma.spouse.delete({
      where: { registrationId: id },
    });
  }

  const result = await prisma.registration.findUnique({
    where: { id },
    include: {
      company: true,
      participation: true,
      nationality: true,
      spouse: {
        include: {
          nationality: true,
        },
      },
    },
  });

  return result;
};

// Step 4: Update trips
exports.updateTrips = async (id, payload) => {
  // Delete existing trip selections
  await prisma.registrationTrip.deleteMany({
    where: { registrationId: id },
  });

  // Add new trip selections
  if (payload.trips && payload.trips.length > 0) {
    await prisma.registrationTrip.createMany({
      data: payload.trips.map(trip => ({
        registrationId: id,
        tripId: trip.tripId,
        forSpouse: trip.forSpouse || false,
      })),
    });
  }

  const result = await prisma.registration.findUnique({
    where: { id },
    include: {
      trips: {
        include: {
          trip: true,
        },
      },
    },
  });

  return result;
};

// Step 5: Update accommodation
exports.updateAccommodation = async (id, payload) => {
  const result = await prisma.registration.update({
    where: { id },
    data: {
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
    include: {
      ammanHotel: true,
      ammanRoom: true,
      deadSeaHotel: true,
      deadSeaRoom: true,
    },
  });

  return result;
};

// Step 7: Update airport pickup and flight details
exports.updateAirportPickup = async (id, payload) => {
  const result = await prisma.registration.update({
    where: { id },
    data: {
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
  });

  return result;
};

// Step 8: Update transportation
exports.updateTransportation = async (id, payload) => {
  const result = await prisma.registration.update({
    where: { id },
    data: {
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
    include: {
      toDeadSeaSchedule: true,
      fromDeadSeaSchedule: true,
    },
  });

  return result;
};

// Step 9: Update special request
exports.updateSpecialRequest = async (id, payload) => {
  const result = await prisma.registration.update({
    where: { id },
    data: {
      specialRequest: payload.specialRequest,
      photographyConsent: payload.photographyConsent || false,
    },
  });

  return result;
};

// Upload visa documents
exports.uploadVisaDocuments = async (id, payload) => {
  const updateData = {
    needsVisa: payload.needsVisa || false,
  };

  if (payload.passportCopy) {
    updateData.passportCopy = payload.passportCopy;
  }

  if (payload.visaForm) {
    updateData.visaForm = payload.visaForm;
  }

  const result = await prisma.registration.update({
    where: { id },
    data: updateData,
  });

  if (result.passportCopy) {
    result.passportCopy = addCdnPrefix(result.passportCopy);
  }
  if (result.visaForm) {
    result.visaForm = addCdnPrefix(result.visaForm);
  }

  return result;
};

// Upload spouse visa documents
exports.uploadSpouseVisaDocuments = async (registrationId, payload) => {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { spouse: true },
  });

  if (!registration || !registration.spouse) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Spouse not found');
  }

  const updateData = {};

  if (payload.passportCopy) {
    updateData.passportCopy = payload.passportCopy;
  }

  if (payload.visaForm) {
    updateData.visaForm = payload.visaForm;
  }

  const result = await prisma.spouse.update({
    where: { registrationId },
    data: updateData,
  });

  if (result.passportCopy) {
    result.passportCopy = addCdnPrefix(result.passportCopy);
  }
  if (result.visaForm) {
    result.visaForm = addCdnPrefix(result.visaForm);
  }

  return result;
};

// Get registration by ID
exports.getRegistrationById = async id => {
  const result = await prisma.registration.findUnique({
    where: { id },
    include: {
      company: {
        include: {
          country: true,
        },
      },
      participation: true,
      nationality: true,
      spouse: {
        include: {
          nationality: true,
        },
      },
      trips: {
        include: {
          trip: true,
        },
      },
      ammanHotel: {
        include: {
          hotelRooms: true,
          hotelImages: true,
        },
      },
      ammanRoom: true,
      deadSeaHotel: {
        include: {
          hotelRooms: true,
          hotelImages: true,
        },
      },
      deadSeaRoom: true,
      toDeadSeaSchedule: true,
      fromDeadSeaSchedule: true,
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Registration not found');
  }

  // Add CDN prefix to file paths
  // Participant files
  if (result.participantPicture) {
    result.participantPicture = addCdnPrefix(result.participantPicture);
  }
  if (result.passportCopy) {
    result.passportCopy = addCdnPrefix(result.passportCopy);
  }
  if (result.visaForm) {
    result.visaForm = addCdnPrefix(result.visaForm);
  }
  // New company logo
  if (result.newCompanyLogo) {
    result.newCompanyLogo = addCdnPrefix(result.newCompanyLogo);
  }
  // Company logo
  if (result.company && result.company.logo) {
    result.company.logo = addCdnPrefix(result.company.logo);
  }
  // Spouse files
  if (result.spouse) {
    if (result.spouse.passportCopy) {
      result.spouse.passportCopy = addCdnPrefix(result.spouse.passportCopy);
    }
    if (result.spouse.visaForm) {
      result.spouse.visaForm = addCdnPrefix(result.spouse.visaForm);
    }
  }
  // Trip images
  if (result.trips && result.trips.length > 0) {
    result.trips.forEach(regTrip => {
      if (regTrip.trip && regTrip.trip.image) {
        regTrip.trip.image = addCdnPrefix(regTrip.trip.image);
      }
    });
  }
  // Hotel images
  if (result.ammanHotel && result.ammanHotel.hotelImages) {
    result.ammanHotel.hotelImages.forEach(img => {
      if (img.fileKey) {
        img.fileKey = addCdnPrefix(img.fileKey);
      }
    });
  }
  if (result.deadSeaHotel && result.deadSeaHotel.hotelImages) {
    result.deadSeaHotel.hotelImages.forEach(img => {
      if (img.fileKey) {
        img.fileKey = addCdnPrefix(img.fileKey);
      }
    });
  }

  return result;
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
  const skip = (page - 1) * limit;

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
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { email: { contains: search } },
      { mobile: { contains: search } },
      { newCompanyName: { contains: search } },
    ];
  }

  const [registrations, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        company: {
          include: {
            country: true,
          },
        },
        participation: true,
        nationality: true,
        spouse: {
          include: {
            nationality: true,
          },
        },
        trips: {
          include: {
            trip: true,
          },
        },
        ammanHotel: {
          include: {
            hotelRooms: true,
            hotelImages: true,
          },
        },
        ammanRoom: true,
        deadSeaHotel: {
          include: {
            hotelRooms: true,
            hotelImages: true,
          },
        },
        deadSeaRoom: true,
        toDeadSeaSchedule: true,
        fromDeadSeaSchedule: true,
      },
    }),
    prisma.registration.count({ where }),
  ]);

  // Add CDN prefix to all file paths
  registrations.forEach(reg => {
    // Participant files
    if (reg.participantPicture) {
      reg.participantPicture = addCdnPrefix(reg.participantPicture);
    }
    if (reg.passportCopy) {
      reg.passportCopy = addCdnPrefix(reg.passportCopy);
    }
    if (reg.visaForm) {
      reg.visaForm = addCdnPrefix(reg.visaForm);
    }
    // New company logo
    if (reg.newCompanyLogo) {
      reg.newCompanyLogo = addCdnPrefix(reg.newCompanyLogo);
    }
    // Company logo
    if (reg.company && reg.company.logo) {
      reg.company.logo = addCdnPrefix(reg.company.logo);
    }
    // Spouse files
    if (reg.spouse) {
      if (reg.spouse.passportCopy) {
        reg.spouse.passportCopy = addCdnPrefix(reg.spouse.passportCopy);
      }
      if (reg.spouse.visaForm) {
        reg.spouse.visaForm = addCdnPrefix(reg.spouse.visaForm);
      }
    }
    // Trip images
    if (reg.trips && reg.trips.length > 0) {
      reg.trips.forEach(regTrip => {
        if (regTrip.trip && regTrip.trip.image) {
          regTrip.trip.image = addCdnPrefix(regTrip.trip.image);
        }
      });
    }
    // Hotel images
    if (reg.ammanHotel && reg.ammanHotel.hotelImages) {
      reg.ammanHotel.hotelImages.forEach(img => {
        if (img.fileKey) {
          img.fileKey = addCdnPrefix(img.fileKey);
        }
      });
    }
    if (reg.deadSeaHotel && reg.deadSeaHotel.hotelImages) {
      reg.deadSeaHotel.hotelImages.forEach(img => {
        if (img.fileKey) {
          img.fileKey = addCdnPrefix(img.fileKey);
        }
      });
    }
  });

  return {
    data: registrations,
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
  const registration = await prisma.registration.findUnique({
    where: { id },
    include: {
      participation: true,
      spouse: true,
      trips: {
        include: { trip: true },
      },
      ammanRoom: true,
      deadSeaRoom: true,
    },
  });

  if (!registration) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Registration not found');
  }

  // Calculate total price
  let totalPrice = 0;

  // Add participation fee
  if (registration.participation && registration.participation.price) {
    totalPrice += registration.participation.price;
  }

  // Add spouse fee if applicable
  if (
    registration.hasSpouse &&
    registration.spouse &&
    registration.participation?.spouse
  ) {
    // Assuming spouse fee is same as participant or could be configured
    totalPrice += registration.participation.price || 0;
  }

  // Add trip fees
  if (registration.trips && registration.trips.length > 0) {
    registration.trips.forEach(regTrip => {
      if (regTrip.trip) {
        totalPrice += parseFloat(regTrip.trip.price) || 0;
      }
    });
  }

  // Add accommodation fees
  if (registration.accommodationInAmman && registration.ammanRoom) {
    // Assuming single/double rate based on room type
    totalPrice +=
      registration.ammanRoom.double || registration.ammanRoom.single || 0;
  }

  if (registration.accommodationInDeadSea && registration.deadSeaRoom) {
    totalPrice +=
      registration.deadSeaRoom.double || registration.deadSeaRoom.single || 0;
  }

  const result = await prisma.registration.update({
    where: { id },
    data: {
      registrationStatus: 'SUBMITTED',
      totalPrice: new Prisma.Decimal(totalPrice),
    },
  });

  return result;
};

// Delete registration (soft delete)
exports.deleteRegistration = async id => {
  const result = await prisma.registration.update({
    where: { id },
    data: { isActive: false },
  });

  return result;
};

// Create full registration (all steps at once)
exports.createFullRegistration = async payload => {
  // Create registration with all data
  const registrationData = {
    companyId: payload.isNewCompany ? null : payload.companyId,
    participationId: payload.participationId,
    // New company fields
    isNewCompany: payload.isNewCompany || false,
    newCompanyName: payload.newCompanyName,
    newCompanyEmail: payload.newCompanyEmail,
    newCompanyLogo: payload.newCompanyLogo,
    newCompanyApproved: false,
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
    transportationToDeadSea: payload.transportationToDeadSea,
    toDeadSeaScheduleId: payload.toDeadSeaScheduleId,
    transportationFromDeadSea: payload.transportationFromDeadSea,
    fromDeadSeaScheduleId: payload.fromDeadSeaScheduleId,
    specialRequest: payload.specialRequest,
    photographyConsent: payload.photographyConsent || false,
    needsVisa: payload.needsVisa || false,
    registrationStatus: 'DRAFT',
  };

  if (payload.participantPicture) {
    registrationData.participantPicture = payload.participantPicture;
  }

  if (payload.passportCopy) {
    registrationData.passportCopy = payload.passportCopy;
  }

  if (payload.visaForm) {
    registrationData.visaForm = payload.visaForm;
  }

  const registration = await prisma.registration.create({
    data: registrationData,
  });

  // Create spouse if provided
  if (payload.hasSpouse && payload.spouse) {
    await prisma.spouse.create({
      data: {
        registrationId: registration.id,
        title: payload.spouse.title,
        firstName: payload.spouse.firstName,
        middleName: payload.spouse.middleName,
        lastName: payload.spouse.lastName,
        nationalityId: payload.spouse.nationalityId,
        needsVisaHelp: payload.spouse.needsVisaHelp || false,
      },
    });
  }

  // Create trips if provided
  if (payload.trips && payload.trips.length > 0) {
    await prisma.registrationTrip.createMany({
      data: payload.trips.map(trip => ({
        registrationId: registration.id,
        tripId: trip.tripId,
        forSpouse: trip.forSpouse || false,
      })),
    });
  }

  return exports.getRegistrationById(registration.id);
};
