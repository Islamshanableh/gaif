const Joi = require('joi');

exports.createAccommodation = {
  body: Joi.object().keys({
    hotelName: Joi.string().required(),
    urlTitle: Joi.string().required(),
    location: Joi.string().required(),
    stars: Joi.string().required(),
    hotelTax: Joi.string(),
    hotelService: Joi.string(),
    hotelOrder: Joi.number(),
    hotelNameAr: Joi.string(),
    distance: Joi.string(),
    time: Joi.string(),
    timeInArabic: Joi.string(),
    entryDate: Joi.date(),
    expirationDate: Joi.date(),
    hotelRooms: Joi.array().items({
      roomCategory: Joi.string().required(),
      roomCategoryInArabic: Joi.string().required(),
      numberOfRooms: Joi.number().required(),
      single: Joi.number(),
      double: Joi.number(),
      available: Joi.number(),
    }),
    hotelImages: Joi.array().items(Joi.string()).optional(),
  }),
};

exports.getById = {
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.updateAccommodation = {
  body: Joi.object().keys({
    hotelName: Joi.string(),
    urlTitle: Joi.string(),
    location: Joi.string(),
    stars: Joi.string(),
    hotelTax: Joi.string(),
    hotelService: Joi.string(),
    hotelOrder: Joi.number(),
    hotelNameAr: Joi.string(),
    distance: Joi.string(),
    time: Joi.string(),
    timeInArabic: Joi.string(),
    entryDate: Joi.date(),
    expirationDate: Joi.date(),
    hotelRooms: Joi.array().items({
      roomCategory: Joi.string(),
      roomCategoryInArabic: Joi.string(),
      numberOfRooms: Joi.string(),
      single: Joi.number(),
      double: Joi.number(),
      available: Joi.number(),
    }),
    hotelImages: Joi.array().items(Joi.string()).optional(),
  }),
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.getAccommodationList = {
  body: Joi.object().keys({}),
};
