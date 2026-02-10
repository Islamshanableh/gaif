const { Op } = require('sequelize');
const {
  Registration,
  Spouse,
  Invoice,
  Accommodation,
  sequelize,
} = require('./db.service');

/**
 * Get accommodation insights - bookings for Amman and Dead Sea hotels
 * @returns {Promise<Object>} Accommodation booking statistics
 */
const getAccommodationInsights = async () => {
  // Get Amman hotel bookings
  const ammanBookings = await Registration.findAll({
    where: {
      accommodationInAmman: true,
      ammanHotelId: { [Op.ne]: null },
      registrationStatus: { [Op.in]: ['SUBMITTED', 'CONFIRMED'] },
    },
    attributes: ['ammanHotelId'],
    include: [
      {
        model: Accommodation,
        as: 'ammanHotel',
        attributes: ['id', 'hotelName', 'location'],
      },
    ],
    raw: true,
    nest: true,
  });

  // Get Dead Sea hotel bookings
  const deadSeaBookings = await Registration.findAll({
    where: {
      accommodationInDeadSea: true,
      deadSeaHotelId: { [Op.ne]: null },
      registrationStatus: { [Op.in]: ['SUBMITTED', 'CONFIRMED'] },
    },
    attributes: ['deadSeaHotelId'],
    include: [
      {
        model: Accommodation,
        as: 'deadSeaHotel',
        attributes: ['id', 'hotelName', 'location'],
      },
    ],
    raw: true,
    nest: true,
  });

  // Group by hotel for Amman
  const ammanHotelCounts = {};
  ammanBookings.forEach(booking => {
    const hotelId = booking.ammanHotelId;
    const hotelName = booking.ammanHotel?.hotelName || 'Unknown';
    if (!ammanHotelCounts[hotelId]) {
      ammanHotelCounts[hotelId] = {
        hotelId,
        hotelName,
        location: booking.ammanHotel?.location,
        bookingsCount: 0,
      };
    }
    ammanHotelCounts[hotelId].bookingsCount += 1;
  });

  // Group by hotel for Dead Sea
  const deadSeaHotelCounts = {};
  deadSeaBookings.forEach(booking => {
    const hotelId = booking.deadSeaHotelId;
    const hotelName = booking.deadSeaHotel?.hotelName || 'Unknown';
    if (!deadSeaHotelCounts[hotelId]) {
      deadSeaHotelCounts[hotelId] = {
        hotelId,
        hotelName,
        location: booking.deadSeaHotel?.location,
        bookingsCount: 0,
      };
    }
    deadSeaHotelCounts[hotelId].bookingsCount += 1;
  });

  return {
    amman: {
      totalBookings: ammanBookings.length,
      hotels: Object.values(ammanHotelCounts),
    },
    deadSea: {
      totalBookings: deadSeaBookings.length,
      hotels: Object.values(deadSeaHotelCounts),
    },
    totalAccommodationBookings: ammanBookings.length + deadSeaBookings.length,
  };
};

/**
 * Get entry visa assistance insights
 * @returns {Promise<Object>} Visa assistance statistics
 */
const getVisaInsights = async () => {
  // Count registrations needing visa
  const participantsNeedVisa = await Registration.count({
    where: {
      needsVisa: true,
      registrationStatus: { [Op.in]: ['SUBMITTED', 'CONFIRMED'] },
    },
  });

  const participantsNoVisa = await Registration.count({
    where: {
      needsVisa: false,
      registrationStatus: { [Op.in]: ['SUBMITTED', 'CONFIRMED'] },
    },
  });

  // Count spouses needing visa help
  const spousesNeedVisa = await Spouse.count({
    where: {
      needsVisaHelp: true,
      isActive: true,
    },
    include: [
      {
        model: Registration,
        as: 'registration',
        where: {
          registrationStatus: { [Op.in]: ['SUBMITTED', 'CONFIRMED'] },
        },
        required: true,
      },
    ],
  });

  const spousesNoVisa = await Spouse.count({
    where: {
      needsVisaHelp: false,
      isActive: true,
    },
    include: [
      {
        model: Registration,
        as: 'registration',
        where: {
          registrationStatus: { [Op.in]: ['SUBMITTED', 'CONFIRMED'] },
        },
        required: true,
      },
    ],
  });

  return {
    participants: {
      needVisa: participantsNeedVisa,
      noVisa: participantsNoVisa,
      total: participantsNeedVisa + participantsNoVisa,
    },
    spouses: {
      needVisa: spousesNeedVisa,
      noVisa: spousesNoVisa,
      total: spousesNeedVisa + spousesNoVisa,
    },
    totalNeedingVisa: participantsNeedVisa + spousesNeedVisa,
  };
};

/**
 * Get payment method insights - online vs system payments
 * @returns {Promise<Object>} Payment method statistics
 */
const getPaymentInsights = async () => {
  // Get online payments (MEPS gateway)
  const onlinePayments = await Invoice.findAll({
    where: {
      paymentSource: 'ONLINE',
      paidAmount: { [Op.ne]: null },
    },
    attributes: [
      [sequelize.fn('SUM', sequelize.col('paidAmount')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    raw: true,
  });

  // Get system payments (admin manual)
  const systemPayments = await Invoice.findAll({
    where: {
      paymentSource: 'SYSTEM',
      paidAmount: { [Op.ne]: null },
    },
    attributes: [
      [sequelize.fn('SUM', sequelize.col('paidAmount')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    raw: true,
  });

  // Get pending payments (no payment source yet)
  const pendingPayments = await Invoice.findAll({
    where: {
      paymentSource: { [Op.is]: null },
    },
    attributes: [
      [sequelize.fn('SUM', sequelize.col('totalValueJD')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    raw: true,
  });

  const onlineTotal = parseFloat(onlinePayments[0]?.totalAmount) || 0;
  const onlineCount = parseInt(onlinePayments[0]?.count, 10) || 0;
  const systemTotal = parseFloat(systemPayments[0]?.totalAmount) || 0;
  const systemCount = parseInt(systemPayments[0]?.count, 10) || 0;
  const pendingTotal = parseFloat(pendingPayments[0]?.totalAmount) || 0;
  const pendingCount = parseInt(pendingPayments[0]?.count, 10) || 0;

  return {
    online: {
      totalAmount: onlineTotal,
      count: onlineCount,
    },
    system: {
      totalAmount: systemTotal,
      count: systemCount,
    },
    pending: {
      totalAmount: pendingTotal,
      count: pendingCount,
    },
    totalPaid: onlineTotal + systemTotal,
    totalPaidCount: onlineCount + systemCount,
  };
};

/**
 * Get monthly registration insights
 * @returns {Promise<Object>} Monthly registration statistics
 */
const getMonthlyRegistrations = async () => {
  // Get registrations grouped by month using Oracle date functions
  const registrations = await Registration.findAll({
    where: {
      registrationStatus: { [Op.in]: ['SUBMITTED', 'CONFIRMED'] },
    },
    attributes: [
      [
        sequelize.fn(
          'TO_CHAR',
          sequelize.col('createdAt'),
          'YYYY-MM',
        ),
        'month',
      ],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    group: [
      sequelize.fn('TO_CHAR', sequelize.col('createdAt'), 'YYYY-MM'),
    ],
    order: [
      [
        sequelize.fn('TO_CHAR', sequelize.col('createdAt'), 'YYYY-MM'),
        'ASC',
      ],
    ],
    raw: true,
  });

  // Format the results
  const monthlyData = registrations.map(reg => ({
    month: reg.month,
    count: parseInt(reg.count, 10) || 0,
  }));

  // Calculate total
  const totalRegistrations = monthlyData.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  return {
    monthly: monthlyData,
    totalRegistrations,
  };
};

/**
 * Get all insights combined
 * @returns {Promise<Object>} All insights data
 */
const getAllInsights = async () => {
  const [accommodation, visa, payment, registrations] = await Promise.all([
    getAccommodationInsights(),
    getVisaInsights(),
    getPaymentInsights(),
    getMonthlyRegistrations(),
  ]);

  return {
    accommodation,
    visa,
    payment,
    registrations,
  };
};

module.exports = {
  getAccommodationInsights,
  getVisaInsights,
  getPaymentInsights,
  getMonthlyRegistrations,
  getAllInsights,
};
