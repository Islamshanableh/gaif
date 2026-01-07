const express = require('express');

const { settingController } = require('../../controllers');

const router = express.Router();

router.route('/countries').get(settingController.getCountries);

module.exports = router;
