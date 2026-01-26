/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
const {
  Accommodation,
  HotelRoom,
  HotelImages,
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
  const result = await Accommodation.findAll({
    where: {
      isActive: true,
      ...where,
    },
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
