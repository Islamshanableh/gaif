const express = require('express');

// const validate = require('../../middlewares/validate');
// const { auth } = require('../../middlewares/auth');

const { settingController } = require('../../controllers');

// const { userValidation } = require('../../validations');

// const { routePermissions } = require('../../constants');

const router = express.Router();

router.route('/countries').get(settingController.getCountries);

module.exports = router;
