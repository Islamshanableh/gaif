// const { responseHandler } = require('../middlewares/responseHandler');

const catchAsync = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next))
    .then(() => {
      // responseHandler(req, res, next);
    })
    .catch(err => {
      console.error('Error in catchAsync:', err);
      next(err);
    });
};

module.exports = catchAsync;
