const express = require('express');

const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');

const { companyController } = require('../../controllers');

const { companyValidation } = require('../../validations');

const { routePermissions } = require('../../constants');

const router = express.Router();

router
  .route('/')
  .post(
    auth(routePermissions.ADMINISTRATOR.create),
    validate(companyValidation.createCompany),
    companyController.createCompany,
  )
  .get(validate(companyValidation.getById), companyController.getCompanyById)
  .put(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(companyValidation.updateCompany),
    companyController.updateCompany,
  )
  .delete(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(companyValidation.getById),
    companyController.deleteCompany,
  );

router
  .route('/list')
  .post(
    validate(companyValidation.getCompanyList),
    companyController.getCompanyList,
  );

module.exports = router;
