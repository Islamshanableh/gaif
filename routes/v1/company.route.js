const express = require('express');

const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');

const { companyController } = require('../../controllers');

const { companyValidation } = require('../../validations');

// const { routePermissions } = require('../../constants');

const router = express.Router();

router
  .route('/')
  .post(
    validate(companyValidation.createCompany),
    companyController.createCompany,
  )
  .get(validate(companyValidation.getById), companyController.getCompanyById)
  .put(
    auth(),
    validate(companyValidation.updateCompany),
    companyController.updateCompany,
  )
  .delete(
    auth(),
    validate(companyValidation.getById),
    companyController.deleteCompany,
  );

router
  .route('/list')
  .get(
    validate(companyValidation.getCompanyList),
    companyController.getCompanyList,
  );

module.exports = router;
