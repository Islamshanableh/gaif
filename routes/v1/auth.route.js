const express = require('express');

const validate = require('../../middlewares/validate');

const router = express.Router();
const { authController } = require('../../controllers');
const { authValidation } = require('../../validations');

router
  .route('/register')
  .post(validate(authValidation.register), authController.register);

router
  .route('/login')
  .post(
    validate(authValidation.loginByEmailAndPassword),
    authController.loginByEmailAndPassword,
  );

router
  .route('/refresh')
  .post(validate(authValidation.refreshToken), authController.refreshToken);

router
  .route('/forget-password')
  .post(validate(authValidation.forgetPassword), authController.forgetPassword);

router
  .route('/verify-code')
  .post(validate(authValidation.verifyCode), authController.verifyCode);

module.exports = router;
