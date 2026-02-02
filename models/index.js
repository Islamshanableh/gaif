/* eslint-disable global-require */
const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config/config');

// Oracle connection configuration for Autonomous Database
const sequelizeConfig = {
  dialect: 'oracle',
  dialectModule: require('oracledb'),
  logging: config.env === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 60000,
    idle: 10000,
  },
  dialectOptions: {
    // For Oracle Autonomous Database with wallet
    connectString: config.oracle.connectionString,
  },
};

// Add wallet configuration if provided
if (config.oracle.walletLocation) {
  sequelizeConfig.dialectOptions.walletLocation = config.oracle.walletLocation;
  sequelizeConfig.dialectOptions.walletPassword = config.oracle.password;
}

const sequelize = new Sequelize(
  '', // database name (not used for Oracle)
  config.oracle.user,
  config.oracle.password,
  sequelizeConfig,
);

// ============================================================================
// ENUMS - Define as constants since Oracle doesn't have native ENUM support
// ============================================================================
const ENUMS = {
  UserStatus: ['APPROVED', 'PENDING'],
  UserRole: ['ADMINISTRATOR', 'GAIF_ADMIN', 'REGISTRATION_ADMIN', 'USER'],
  TicketStatus: ['INPROGRESS', 'PENDING', 'DONE'],
  Title: ['MR', 'MRS', 'MS', 'DR', 'PROF'],
  AirportPickupOption: ['NEED_PICKUP', 'NO_PICKUP', 'PROVIDE_LATER'],
  TransportationType: ['BY_COACH', 'OWN_TRANSPORTATION'],
  TransportDirection: ['AMMAN_TO_DEAD_SEA', 'DEAD_SEA_TO_AMMAN'],
  PaymentStatus: ['PENDING', 'PAID', 'PARTIAL', 'REFUNDED'],
  RegistrationStatus: ['DRAFT', 'SUBMITTED', 'CONFIRMED', 'CANCELLED'],
};

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

// User Model
const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING(320),
      allowNull: false,
      unique: true,
    },
    fullName: {
      type: DataTypes.STRING(320),
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    mobile: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        isIn: [ENUMS.UserRole],
      },
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        isIn: [ENUMS.UserStatus],
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    isVerify: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    mfaEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    mfaSecret: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: 'Users',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
);

// ParticipationType Model
const ParticipationType = sequelize.define(
  'ParticipationType',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(320),
      allowNull: false,
      unique: true,
    },
    price: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    spousePrice: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    specialPrice: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    allowForRegister: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    allowCreateCompany: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    requireConfirmationFromCompany: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    fees: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    spouse: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    petra: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    petraSpouse: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    accommodationAqaba: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    accommodationAmman: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'ParticipationTypes',
    timestamps: true,
  },
);

// Country Model
const Country = sequelize.define(
  'Country',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cca3: {
      type: DataTypes.CHAR(3),
      allowNull: false,
    },
    cca2: {
      type: DataTypes.CHAR(2),
      allowNull: false,
      unique: true,
    },
    ccn3: {
      type: DataTypes.CHAR(3),
      allowNull: true,
      unique: true,
    },
    currencyCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  },
  {
    tableName: 'Countries',
    timestamps: false,
  },
);

// ParticipationTypeCountry Model (Junction table for multi-select countries)
const ParticipationTypeCountry = sequelize.define(
  'ParticipationTypeCountry',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    participationTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'ParticipationTypes',
        key: 'id',
      },
    },
    countryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Countries',
        key: 'id',
      },
    },
  },
  {
    tableName: 'ParticipationTypeCountries',
    timestamps: true,
  },
);

// Company Model
const Company = sequelize.define(
  'Company',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(320),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(320),
      allowNull: true,
    },
    logoId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Files',
        key: 'id',
      },
    },
    entryDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expirationDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    countryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Countries',
        key: 'id',
      },
    },
    participationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'ParticipationTypes',
        key: 'id',
      },
    },
    numberOfFreeSeats: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    available: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    allowFreeSeats: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'Companies',
    timestamps: true,
  },
);

// Accommodation Model
const Accommodation = sequelize.define(
  'Accommodation',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    hotelName: {
      type: DataTypes.STRING(320),
      allowNull: false,
    },
    urlTitle: {
      type: DataTypes.STRING(320),
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    stars: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    hotelTax: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    hotelService: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    hotelOrder: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    hotelNameAr: {
      type: DataTypes.STRING(320),
      allowNull: true,
    },
    distance: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    time: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    timeInArabic: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    entryDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expirationDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'Accommodations',
    timestamps: true,
  },
);

// HotelRoom Model
const HotelRoom = sequelize.define(
  'HotelRoom',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    roomCategory: {
      type: DataTypes.STRING(320),
      allowNull: false,
    },
    roomCategoryInArabic: {
      type: DataTypes.STRING(320),
      allowNull: true,
    },
    numberOfRooms: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    single: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    double: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    roomRate: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: 'JD',
    },
    available: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    accommodationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Accommodations',
        key: 'id',
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'HotelRooms',
    timestamps: true,
  },
);

// HotelImages Model
const HotelImages = sequelize.define(
  'HotelImages',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fileKey: {
      type: DataTypes.STRING(320),
      allowNull: false,
    },
    accommodationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Accommodations',
        key: 'id',
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'HotelImages',
    timestamps: true,
  },
);

// Trip Type Enum
const TRIP_TYPES = ['participation', 'spouse'];

// Trip Model
const Trip = sequelize.define(
  'Trip',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    type: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        isIn: [TRIP_TYPES],
      },
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    nameAr: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    descriptionAr: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(10),
      defaultValue: 'JD',
    },
    tripDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    maxParticipants: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    imageId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Files',
        key: 'id',
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'Trips',
    timestamps: true,
  },
);

// TransportationSchedule Model
const TransportationSchedule = sequelize.define(
  'TransportationSchedule',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    direction: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [ENUMS.TransportDirection],
      },
    },
    scheduleDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    departureTime: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    expectedArrivalTime: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    route: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    routeAr: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    availableSeats: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'TransportationSchedules',
    timestamps: true,
  },
);

// Registration Model
const Registration = sequelize.define(
  'Registration',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    profileId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      unique: true,
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Companies',
        key: 'id',
      },
    },
    participationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'ParticipationTypes',
        key: 'id',
      },
    },
    // Personal Information
    title: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    middleName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    position: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    nationalityId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Countries',
        key: 'id',
      },
    },
    email: {
      type: DataTypes.STRING(320),
      allowNull: false,
    },
    telephone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    mobile: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    whatsapp: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    participantPictureId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Files',
        key: 'id',
      },
    },
    // Spouse Information
    hasSpouse: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Accommodation Amman
    accommodationInAmman: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    ammanHotelId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Accommodations',
        key: 'id',
      },
    },
    ammanRoomId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'HotelRooms',
        key: 'id',
      },
    },
    ammanCheckIn: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    ammanCheckOut: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    ammanRoomType: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    ammanRoommateId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Registrations',
        key: 'id',
      },
    },
    // Accommodation Dead Sea
    accommodationInDeadSea: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    deadSeaHotelId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Accommodations',
        key: 'id',
      },
    },
    deadSeaRoomId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'HotelRooms',
        key: 'id',
      },
    },
    deadSeaCheckIn: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    deadSeaCheckOut: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    deadSeaRoomType: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    deadSeaRoommateId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Registrations',
        key: 'id',
      },
    },
    // Airport Pickup
    airportPickupOption: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        isIn: [ENUMS.AirportPickupOption],
      },
    },
    arrivalDate: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    arrivalAirline: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    arrivalFlightNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    arrivalTime: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    departureDate: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    departureAirline: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    departureFlightNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    departureTime: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    flightDetailsForSpouse: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Transportation (simplified - just a checkbox in new flow)
    needsVenueTransportation: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Legacy transportation fields (kept for backward compatibility)
    transportationToDeadSea: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        isIn: [ENUMS.TransportationType],
      },
    },
    toDeadSeaScheduleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'TransportationSchedules',
        key: 'id',
      },
    },
    transportationFromDeadSea: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        isIn: [ENUMS.TransportationType],
      },
    },
    fromDeadSeaScheduleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'TransportationSchedules',
        key: 'id',
      },
    },
    // Special Request
    specialRequest: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    photographyConsent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Visa Information
    needsVisa: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    passportCopyId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Files',
        key: 'id',
      },
    },
    residencyId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Files',
        key: 'id',
      },
    },
    visaFormId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Files',
        key: 'id',
      },
    },
    // System fields
    totalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    paymentStatus: {
      type: DataTypes.STRING(20),
      defaultValue: 'PENDING',
      validate: {
        isIn: [ENUMS.PaymentStatus],
      },
    },
    registrationStatus: {
      type: DataTypes.STRING(20),
      defaultValue: 'DRAFT',
      validate: {
        isIn: [ENUMS.RegistrationStatus],
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'Registrations',
    timestamps: true,
  },
);

// Spouse Model
const Spouse = sequelize.define(
  'Spouse',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    spouseId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      unique: true,
    },
    registrationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Registrations',
        key: 'id',
      },
    },
    title: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    middleName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    nationalityId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Countries',
        key: 'id',
      },
    },
    whatsapp: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    needsVisaHelp: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    passportCopyId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Files',
        key: 'id',
      },
    },
    residencyId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Files',
        key: 'id',
      },
    },
    visaFormId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Files',
        key: 'id',
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'Spouses',
    timestamps: true,
  },
);

// RegistrationTrip Model (Join table)
const RegistrationTrip = sequelize.define(
  'RegistrationTrip',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    registrationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Registrations',
        key: 'id',
      },
    },
    tripId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Trips',
        key: 'id',
      },
    },
    forSpouse: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: 'RegistrationTrips',
    timestamps: true,
    updatedAt: false,
  },
);

// File Model (for storing files as BLOB in database)
const File = sequelize.define(
  'File',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fileKey: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    fileName: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    fileType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    fileContent: {
      type: DataTypes.BLOB('long'),
      allowNull: false,
    },
    entityType: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    fieldName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'Files',
    timestamps: true,
  },
);

// Invoice Model
const Invoice = sequelize.define(
  'Invoice',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    registrationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Registrations',
        key: 'id',
      },
    },
    serialNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    taxNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    // Fee breakdown
    participationFees: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    spouseFees: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    tripFees: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    spouseTripFees: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    totalParticipationFees: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    // Per-field currency
    participationCurrency: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    spouseCurrency: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    tripCurrency: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    spouseTripCurrency: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    // Amman accommodation breakdown
    ammanAccommodation: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    ammanTax: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    ammanService: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    ammanTotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    ammanCurrency: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    // Dead Sea accommodation breakdown
    deadSeaAccommodation: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    deadSeaTax: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    deadSeaService: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    deadSeaTotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    deadSeaCurrency: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    // Fees tax
    feesTaxPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0,
    },
    feesTaxAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    // Hotel accommodation total
    hotelAccommodationTotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    // Totals
    totalDiscount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    totalValueJD: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    totalValueUSD: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    exchangeRate: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
    },
  },
  {
    tableName: 'Invoices',
    timestamps: true,
  },
);

// Token Types for Registration Actions
const TOKEN_TYPES = [
  'COMPANY_CONFIRM',
  'COMPANY_DECLINE',
  'VIEW_REGISTRATION',
  'VIEW_INVOICE',
  'UPDATE_REGISTRATION',
];

// RegistrationToken Model (for secure email action links)
const RegistrationToken = sequelize.define(
  'RegistrationToken',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    token: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    registrationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Registrations',
        key: 'id',
      },
    },
    tokenType: {
      type: DataTypes.STRING(30),
      allowNull: false,
      validate: {
        isIn: [TOKEN_TYPES],
      },
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Companies',
        key: 'id',
      },
    },
    used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true, // null means never expires
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'RegistrationTokens',
    timestamps: true,
  },
);

// ============================================================================
// ASSOCIATIONS
// ============================================================================

// ParticipationTypeCountry associations (many-to-many)
ParticipationType.belongsToMany(Country, {
  through: ParticipationTypeCountry,
  foreignKey: 'participationTypeId',
  otherKey: 'countryId',
  as: 'countries',
});
Country.belongsToMany(ParticipationType, {
  through: ParticipationTypeCountry,
  foreignKey: 'countryId',
  otherKey: 'participationTypeId',
  as: 'participationTypes',
});
ParticipationTypeCountry.belongsTo(ParticipationType, {
  foreignKey: 'participationTypeId',
  as: 'participationType',
});
ParticipationTypeCountry.belongsTo(Country, {
  foreignKey: 'countryId',
  as: 'country',
});

// Company associations
Company.belongsTo(Country, { foreignKey: 'countryId', as: 'country' });
Company.belongsTo(ParticipationType, {
  foreignKey: 'participationId',
  as: 'participation',
});
Country.hasMany(Company, { foreignKey: 'countryId', as: 'companies' });
ParticipationType.hasMany(Company, {
  foreignKey: 'participationId',
  as: 'companies',
});

// Accommodation associations
Accommodation.hasMany(HotelRoom, {
  foreignKey: 'accommodationId',
  as: 'hotelRooms',
});
Accommodation.hasMany(HotelImages, {
  foreignKey: 'accommodationId',
  as: 'hotelImages',
});
HotelRoom.belongsTo(Accommodation, {
  foreignKey: 'accommodationId',
  as: 'accommodation',
});
HotelImages.belongsTo(Accommodation, {
  foreignKey: 'accommodationId',
  as: 'accommodation',
});

// Registration associations
Registration.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
Registration.belongsTo(ParticipationType, {
  foreignKey: 'participationId',
  as: 'participation',
});
Registration.belongsTo(Country, {
  foreignKey: 'nationalityId',
  as: 'nationality',
});
Registration.belongsTo(Accommodation, {
  foreignKey: 'ammanHotelId',
  as: 'ammanHotel',
});
Registration.belongsTo(HotelRoom, {
  foreignKey: 'ammanRoomId',
  as: 'ammanRoom',
});
Registration.belongsTo(Accommodation, {
  foreignKey: 'deadSeaHotelId',
  as: 'deadSeaHotel',
});
Registration.belongsTo(HotelRoom, {
  foreignKey: 'deadSeaRoomId',
  as: 'deadSeaRoom',
});
Registration.belongsTo(TransportationSchedule, {
  foreignKey: 'toDeadSeaScheduleId',
  as: 'toDeadSeaSchedule',
});
Registration.belongsTo(TransportationSchedule, {
  foreignKey: 'fromDeadSeaScheduleId',
  as: 'fromDeadSeaSchedule',
});

Company.hasMany(Registration, { foreignKey: 'companyId', as: 'registrations' });
ParticipationType.hasMany(Registration, {
  foreignKey: 'participationId',
  as: 'registrations',
});
Country.hasMany(Registration, {
  foreignKey: 'nationalityId',
  as: 'registrations',
});

// Roommate associations (self-referencing)
Registration.belongsTo(Registration, {
  foreignKey: 'ammanRoommateId',
  as: 'ammanRoommate',
});
Registration.belongsTo(Registration, {
  foreignKey: 'deadSeaRoommateId',
  as: 'deadSeaRoommate',
});

// Spouse associations
Registration.hasOne(Spouse, { foreignKey: 'registrationId', as: 'spouse' });
Spouse.belongsTo(Registration, {
  foreignKey: 'registrationId',
  as: 'registration',
});
Spouse.belongsTo(Country, { foreignKey: 'nationalityId', as: 'nationality' });
Country.hasMany(Spouse, { foreignKey: 'nationalityId', as: 'spouses' });

// RegistrationTrip associations
Registration.hasMany(RegistrationTrip, {
  foreignKey: 'registrationId',
  as: 'trips',
});
Trip.hasMany(RegistrationTrip, {
  foreignKey: 'tripId',
  as: 'registrationTrips',
});
RegistrationTrip.belongsTo(Registration, {
  foreignKey: 'registrationId',
  as: 'registration',
});
RegistrationTrip.belongsTo(Trip, { foreignKey: 'tripId', as: 'trip' });

// TransportationSchedule associations
TransportationSchedule.hasMany(Registration, {
  foreignKey: 'toDeadSeaScheduleId',
  as: 'registrationsToDeadSea',
});
TransportationSchedule.hasMany(Registration, {
  foreignKey: 'fromDeadSeaScheduleId',
  as: 'registrationsFromDeadSea',
});

// File associations
Company.belongsTo(File, {
  foreignKey: 'logoId',
  as: 'logo',
});
Trip.belongsTo(File, {
  foreignKey: 'imageId',
  as: 'image',
});
Registration.belongsTo(File, {
  foreignKey: 'participantPictureId',
  as: 'participantPicture',
});
Registration.belongsTo(File, {
  foreignKey: 'passportCopyId',
  as: 'passportCopy',
});
Registration.belongsTo(File, {
  foreignKey: 'residencyId',
  as: 'residency',
});
Registration.belongsTo(File, {
  foreignKey: 'visaFormId',
  as: 'visaForm',
});
Spouse.belongsTo(File, {
  foreignKey: 'passportCopyId',
  as: 'passportCopy',
});
Spouse.belongsTo(File, {
  foreignKey: 'residencyId',
  as: 'residency',
});
Spouse.belongsTo(File, {
  foreignKey: 'visaFormId',
  as: 'visaForm',
});

// RegistrationToken associations
RegistrationToken.belongsTo(Registration, {
  foreignKey: 'registrationId',
  as: 'registration',
});
RegistrationToken.belongsTo(Company, {
  foreignKey: 'companyId',
  as: 'company',
});
Registration.hasMany(RegistrationToken, {
  foreignKey: 'registrationId',
  as: 'tokens',
});

// Invoice associations
Invoice.belongsTo(Registration, {
  foreignKey: 'registrationId',
  as: 'registration',
});
Registration.hasMany(Invoice, {
  foreignKey: 'registrationId',
  as: 'invoices',
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  sequelize,
  Sequelize,
  ENUMS,
  User,
  ParticipationType,
  ParticipationTypeCountry,
  Country,
  Company,
  Accommodation,
  HotelRoom,
  HotelImages,
  Trip,
  TransportationSchedule,
  Registration,
  Spouse,
  File,
  RegistrationTrip,
  RegistrationToken,
  Invoice,
};
