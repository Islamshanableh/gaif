/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
const { Op } = require('sequelize');
const {
  Accommodation,
  HotelRoom,
  HotelImages,
  Registration,
  Company,
  Country,
  ParticipationType,
  Spouse,
  Invoice,
  sequelize,
} = require('./db.service');
const config = require('../config/config');
const ApiError = require('../utils/ApiError');

exports.createAccommodation = async payload => {
  const hotelRooms = payload?.hotelRooms;
  const hotelImages = payload?.hotelImages;
  delete payload?.hotelRooms;
  delete payload?.hotelImages;

  const transaction = await sequelize.transaction();

  try {
    const accommodation = await Accommodation.create(payload, { transaction });

    if (hotelRooms && hotelRooms.length > 0) {
      await HotelRoom.bulkCreate(
        hotelRooms.map(room => ({
          roomCategory: room.roomCategory,
          roomCategoryInArabic: room.roomCategoryInArabic,
          numberOfRooms: room.numberOfRooms,
          single: room.single,
          double: room.double,
          roomRate: room.roomRate,
          currency: room.currency || 'JD',
          available: room.available,
          accommodationId: accommodation.id,
        })),
        { transaction },
      );
    }

    if (hotelImages && hotelImages.length > 0) {
      await HotelImages.bulkCreate(
        hotelImages.map(image => ({
          fileKey: image.fileKey,
          accommodationId: accommodation.id,
        })),
        { transaction },
      );
    }

    await transaction.commit();

    return accommodation.toJSON();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

exports.getAccommodationList = async payload => {
  const where = {};
  if (payload.stars) {
    where.stars = payload.stars;
  }

  // For admin, return all records (active and inactive)
  // For registration (non-admin), return only active records
  if (!payload.forAdmin) {
    where.isActive = true;
  }

  const result = await Accommodation.findAll({
    where,
    include: [
      { model: HotelImages, as: 'hotelImages' },
      { model: HotelRoom, as: 'hotelRooms' },
    ],
  });

  return result.map(item => {
    const accommodation = item.toJSON();
    if (accommodation.hotelImages) {
      accommodation.hotelImages = accommodation.hotelImages.map(image => {
        if (image?.fileKey) {
          image.fileKey = `${config.cdnPrefix}/${image.fileKey}`;
        }
        return image;
      });
    }
    return accommodation;
  });
};

exports.getAccommodationById = async id => {
  const result = await Accommodation.findOne({
    where: { id },
    include: [
      { model: HotelImages, as: 'hotelImages' },
      { model: HotelRoom, as: 'hotelRooms' },
    ],
  });

  if (!result) {
    return null;
  }

  const accommodation = result.toJSON();
  if (accommodation.hotelImages) {
    accommodation.hotelImages = accommodation.hotelImages.map(item => {
      if (item.fileKey) {
        item.fileKey = `${config.cdnPrefix}/${item.fileKey}`;
      }
      return item;
    });
  }

  return accommodation;
};

exports.deleteAccommodation = async id => {
  await Accommodation.update({ isActive: false }, { where: { id } });

  const result = await Accommodation.findByPk(id);
  return result ? result.toJSON() : null;
};

exports.updateAccommodation = async payload => {
  const { id, hotelImages, hotelRooms, ...updateData } = payload;

  const transaction = await sequelize.transaction();

  try {
    await Accommodation.update(updateData, {
      where: { id },
      transaction,
    });

    // Update hotel rooms if provided
    if (hotelRooms && hotelRooms.length > 0) {
      for (const room of hotelRooms) {
        if (room.id) {
          // Update existing room
          await HotelRoom.update(
            {
              roomCategory: room.roomCategory,
              roomCategoryInArabic: room.roomCategoryInArabic,
              numberOfRooms: room.numberOfRooms,
              single: room.single,
              double: room.double,
              roomRate: room.roomRate,
              currency: room.currency,
              available: room.available,
            },
            { where: { id: room.id, accommodationId: id }, transaction },
          );
        } else {
          // Create new room
          await HotelRoom.create(
            {
              roomCategory: room.roomCategory,
              roomCategoryInArabic: room.roomCategoryInArabic,
              numberOfRooms: room.numberOfRooms,
              single: room.single,
              double: room.double,
              roomRate: room.roomRate,
              currency: room.currency || 'JD',
              available: room.available,
              accommodationId: id,
            },
            { transaction },
          );
        }
      }
    }

    if (hotelImages && hotelImages.length > 0) {
      await HotelImages.bulkCreate(
        hotelImages.map(image => ({
          fileKey: image.fileKey,
          accommodationId: id,
        })),
        { transaction },
      );
    }

    await transaction.commit();

    const result = await Accommodation.findByPk(id, {
      include: [
        { model: HotelImages, as: 'hotelImages' },
        { model: HotelRoom, as: 'hotelRooms' },
      ],
    });
    return result ? result.toJSON() : null;
  } catch (e) {
    await transaction.rollback();
    if (e.name === 'SequelizeUniqueConstraintError') {
      const field = e.errors?.[0]?.path || 'field';
      const msg = `${field.replace(/_/g, ' ')} already exists`;
      throw new ApiError(httpStatus.BAD_REQUEST, msg);
    }
    throw e;
  }
};

/**
 * Get accommodation report - registrations with their accommodation details
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated or full list of registrations with accommodation
 */
exports.getAccommodationReport = async (filters = {}) => {
  const {
    location, // 'amman' or 'deadSea'
    hotelCategory, // stars (e.g., '5', '4')
    hotelId, // specific hotel ID
    roomCategory, // room category name
    roomType, // 'single' or 'double'
    page = 1,
    limit = 20,
    exportAll = false,
  } = filters;

  // Build registration where clause
  const registrationWhere = {
    registrationStatus: { [Op.in]: ['SUBMITTED', 'CONFIRMED'] },
    isActive: true,
  };

  // Filter by location (which accommodation field to look at)
  if (location === 'amman') {
    registrationWhere.accommodationInAmman = true;
  } else if (location === 'deadSea') {
    registrationWhere.accommodationInDeadSea = true;
  } else {
    // If no location specified, get registrations with any accommodation
    registrationWhere[Op.or] = [
      { accommodationInAmman: true },
      { accommodationInDeadSea: true },
    ];
  }

  // Filter by room type
  if (roomType) {
    if (location === 'amman') {
      registrationWhere.ammanRoomType = roomType;
    } else if (location === 'deadSea') {
      registrationWhere.deadSeaRoomType = roomType;
    } else {
      // If no location, check both
      registrationWhere[Op.or] = [
        { ammanRoomType: roomType },
        { deadSeaRoomType: roomType },
      ];
    }
  }

  // Build hotel where clause
  const hotelWhere = { isActive: true };
  if (hotelCategory) {
    hotelWhere.stars = hotelCategory;
  }
  if (hotelId) {
    hotelWhere.id = hotelId;
  }

  // Build room where clause
  const roomWhere = { isActive: true };
  if (roomCategory) {
    roomWhere.roomCategory = { [Op.like]: `%${roomCategory}%` };
  }

  // Build includes based on location filter
  const includes = [
    {
      model: Company,
      as: 'company',
      include: [{ model: Country, as: 'country' }],
    },
    { model: Country, as: 'nationality' },
    { model: ParticipationType, as: 'participation' },
    { model: Spouse, as: 'spouse' },
    {
      model: Invoice,
      as: 'invoices',
      required: false,
      order: [['createdAt', 'DESC']],
    },
  ];

  // Add Amman hotel/room includes
  if (!location || location === 'amman') {
    includes.push({
      model: Accommodation,
      as: 'ammanHotel',
      where: location === 'amman' && (hotelCategory || hotelId) ? hotelWhere : undefined,
      required: location === 'amman' && (hotelCategory || hotelId),
    });
    includes.push({
      model: HotelRoom,
      as: 'ammanRoom',
      where: location === 'amman' && roomCategory ? roomWhere : undefined,
      required: location === 'amman' && roomCategory,
    });
  }

  // Add Dead Sea hotel/room includes
  if (!location || location === 'deadSea') {
    includes.push({
      model: Accommodation,
      as: 'deadSeaHotel',
      where: location === 'deadSea' && (hotelCategory || hotelId) ? hotelWhere : undefined,
      required: location === 'deadSea' && (hotelCategory || hotelId),
    });
    includes.push({
      model: HotelRoom,
      as: 'deadSeaRoom',
      where: location === 'deadSea' && roomCategory ? roomWhere : undefined,
      required: location === 'deadSea' && roomCategory,
    });
  }

  // Get registrations
  const registrations = await Registration.findAll({
    where: registrationWhere,
    include: includes,
    order: [['createdAt', 'DESC']],
  });

  // Apply pagination
  const totalCount = registrations.length;
  const paginatedResults = exportAll
    ? registrations
    : registrations.slice((page - 1) * limit, page * limit);

  // Format response
  const formattedResults = paginatedResults.map(reg => {
    const r = reg.toJSON();
    // Get latest invoice (most recent)
    const latestInvoice = r.invoices && r.invoices.length > 0
      ? r.invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
      : null;

    return {
      registrationId: r.id,
      profileId: r.profileId,
      // Participant info
      firstName: r.firstName,
      middleName: r.middleName,
      lastName: r.lastName,
      fullName: `${r.firstName || ''} ${r.middleName || ''} ${r.lastName || ''}`.trim(),
      email: r.email,
      mobile: r.mobile,
      // Nationality
      nationalityId: r.nationalityId,
      nationality: r.nationality?.name,
      // Company
      companyId: r.companyId,
      companyName: r.company?.name,
      companyCountry: r.company?.country?.name,
      // Participation type
      participationType: r.participation?.title,
      // Spouse info
      hasSpouse: r.hasSpouse,
      spouseName: r.spouse
        ? `${r.spouse.firstName || ''} ${r.spouse.lastName || ''}`.trim()
        : null,
      // Amman accommodation
      accommodationInAmman: r.accommodationInAmman,
      ammanHotelId: r.ammanHotelId,
      ammanHotelName: r.ammanHotel?.hotelName,
      ammanHotelStars: r.ammanHotel?.stars,
      ammanRoomId: r.ammanRoomId,
      ammanRoomCategory: r.ammanRoom?.roomCategory,
      ammanRoomType: r.ammanRoomType,
      ammanCheckIn: r.ammanCheckIn,
      ammanCheckOut: r.ammanCheckOut,
      ammanNights: r.ammanNights,
      // Dead Sea accommodation
      accommodationInDeadSea: r.accommodationInDeadSea,
      deadSeaHotelId: r.deadSeaHotelId,
      deadSeaHotelName: r.deadSeaHotel?.hotelName,
      deadSeaHotelStars: r.deadSeaHotel?.stars,
      deadSeaRoomId: r.deadSeaRoomId,
      deadSeaRoomCategory: r.deadSeaRoom?.roomCategory,
      deadSeaRoomType: r.deadSeaRoomType,
      deadSeaCheckIn: r.deadSeaCheckIn,
      deadSeaCheckOut: r.deadSeaCheckOut,
      deadSeaNights: r.deadSeaNights,
      // Fees from latest invoice
      invoiceId: latestInvoice?.id,
      serialNumber: latestInvoice?.serialNumber,
      // Participation fees
      participationFees: parseFloat(latestInvoice?.participationFees) || 0,
      participationCurrency: latestInvoice?.participationCurrency || 'USD',
      participationDiscount: parseFloat(latestInvoice?.participationDiscount) || 0,
      participationPaid: latestInvoice?.participationPaid || false,
      // Spouse fees
      spouseFees: parseFloat(latestInvoice?.spouseFees) || 0,
      spouseCurrency: latestInvoice?.spouseCurrency || 'USD',
      spouseDiscount: parseFloat(latestInvoice?.spouseDiscount) || 0,
      spousePaid: latestInvoice?.spousePaid || false,
      // Trip fees
      tripFees: parseFloat(latestInvoice?.tripFees) || 0,
      tripCurrency: latestInvoice?.tripCurrency || 'USD',
      tripDiscount: parseFloat(latestInvoice?.tripDiscount) || 0,
      tripPaid: latestInvoice?.tripPaid || false,
      // Spouse trip fees
      spouseTripFees: parseFloat(latestInvoice?.spouseTripFees) || 0,
      spouseTripCurrency: latestInvoice?.spouseTripCurrency || 'USD',
      spouseTripDiscount: parseFloat(latestInvoice?.spouseTripDiscount) || 0,
      spouseTripPaid: latestInvoice?.spouseTripPaid || false,
      // Amman accommodation fees
      ammanAccommodationFees: parseFloat(latestInvoice?.ammanTotal) || 0,
      ammanAccommodationTax: parseFloat(latestInvoice?.ammanTax) || 0,
      ammanAccommodationService: parseFloat(latestInvoice?.ammanService) || 0,
      ammanAccommodationCurrency: latestInvoice?.ammanCurrency || 'JD',
      ammanDiscount: parseFloat(latestInvoice?.ammanDiscount) || 0,
      ammanPaid: latestInvoice?.ammanPaid || false,
      // Dead Sea accommodation fees
      deadSeaAccommodationFees: parseFloat(latestInvoice?.deadSeaTotal) || 0,
      deadSeaAccommodationTax: parseFloat(latestInvoice?.deadSeaTax) || 0,
      deadSeaAccommodationService: parseFloat(latestInvoice?.deadSeaService) || 0,
      deadSeaAccommodationCurrency: latestInvoice?.deadSeaCurrency || 'JD',
      deadSeaDiscount: parseFloat(latestInvoice?.deadSeaDiscount) || 0,
      deadSeaPaid: latestInvoice?.deadSeaPaid || false,
      // Totals
      totalParticipationFees: parseFloat(latestInvoice?.totalParticipationFees) || 0,
      hotelAccommodationTotal: parseFloat(latestInvoice?.hotelAccommodationTotal) || 0,
      totalDiscount: parseFloat(latestInvoice?.totalDiscount) || 0,
      totalValueJD: parseFloat(latestInvoice?.totalValueJD) || 0,
      totalValueUSD: parseFloat(latestInvoice?.totalValueUSD) || 0,
      paidAmount: parseFloat(latestInvoice?.paidAmount) || 0,
      balance: parseFloat(latestInvoice?.balance) || 0,
      // Invoice status
      invoiceStatus: latestInvoice?.invoiceStatus,
      paidAt: latestInvoice?.paidAt,
      // Status
      registrationStatus: r.registrationStatus,
      paymentStatus: r.paymentStatus,
      // Dates
      createdAt: r.createdAt,
    };
  });

  // Calculate room counts
  let roomCount = 0;
  let roomReserved = 0;

  formattedResults.forEach(r => {
    if (location === 'amman' || !location) {
      if (r.accommodationInAmman && r.ammanRoomId) {
        roomReserved++;
      }
    }
    if (location === 'deadSea' || !location) {
      if (r.accommodationInDeadSea && r.deadSeaRoomId) {
        roomReserved++;
      }
    }
  });

  // Get total available rooms for the filtered hotels
  if (hotelId) {
    const rooms = await HotelRoom.findAll({
      where: { accommodationId: hotelId, isActive: true },
    });
    roomCount = rooms.reduce((sum, room) => sum + (room.numberOfRooms || 0), 0);
  }

  return {
    data: formattedResults,
    summary: {
      roomCount,
      roomReserved,
    },
    pagination: exportAll
      ? { total: totalCount, exportAll: true }
      : {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
  };
};
