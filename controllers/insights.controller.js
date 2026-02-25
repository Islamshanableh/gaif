const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const insightsService = require('../services/insights.service');

const getAllInsights = catchAsync(async (req, res) => {
  const result = await insightsService.getAllInsights();
  res.status(httpStatus.OK).send(result);
});

const getAccommodationInsights = catchAsync(async (req, res) => {
  const result = await insightsService.getAccommodationInsights();
  res.status(httpStatus.OK).send(result);
});

const getVisaInsights = catchAsync(async (req, res) => {
  const result = await insightsService.getVisaInsights();
  res.status(httpStatus.OK).send(result);
});

const getPaymentInsights = catchAsync(async (req, res) => {
  const result = await insightsService.getPaymentInsights();
  res.status(httpStatus.OK).send(result);
});

const getMonthlyRegistrations = catchAsync(async (req, res) => {
  const result = await insightsService.getMonthlyRegistrations();
  res.status(httpStatus.OK).send(result);
});

const getDashboardTotals = catchAsync(async (req, res) => {
  const result = await insightsService.getDashboardTotals();
  res.status(httpStatus.OK).send(result);
});

const getParticipationTypeInsights = catchAsync(async (req, res) => {
  const result = await insightsService.getParticipationTypeInsights();
  res.status(httpStatus.OK).send(result);
});

module.exports = {
  getAllInsights,
  getAccommodationInsights,
  getVisaInsights,
  getPaymentInsights,
  getMonthlyRegistrations,
  getDashboardTotals,
  getParticipationTypeInsights,
};
