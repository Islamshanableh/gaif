const express = require('express');

const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');

const { settingController } = require('../../controllers');

const { settingValidation } = require('../../validations');

const { routePermissions } = require('../../constants');

const router = express.Router();

router
  .route('/section')
  .post(
    auth(routePermissions.ADMIN.create),
    validate(settingValidation.create),
    settingController.createSection,
  )
  .get(
    auth(routePermissions.ADMIN.read),
    validate(settingValidation.getById),
    settingController.getSection,
  )
  .put(
    auth(routePermissions.ADMIN.update),
    validate(settingValidation.updateSection),
    settingController.updateSection,
  )
  .delete(
    auth(routePermissions.ADMIN.update),
    validate(settingValidation.getById),
    settingController.deleteSection,
  );

router.route('/section/list').get(auth(), settingController.getSectionList);

router
  .route('/section/list/filter')
  .post(
    auth(),
    validate(settingValidation.getSectionListFilter),
    settingController.getSectionListFilter,
  );

router
  .route('/checkList')
  .post(
    auth(routePermissions.ADMIN.create),
    validate(settingValidation.create),
    settingController.createCheckList,
  )
  .get(
    auth(routePermissions.ADMIN.read),
    validate(settingValidation.getById),
    settingController.getCheckListById,
  )
  .put(
    auth(routePermissions.ADMIN.update),
    validate(settingValidation.update),
    settingController.updateCheckList,
  )
  .delete(
    auth(routePermissions.ADMIN.update),
    validate(settingValidation.getById),
    settingController.deleteCheckList,
  );

router.route('/checkList/list').get(auth(), settingController.getCheckList);

router
  .route('/material')
  .post(
    auth(routePermissions.ADMIN.create),
    validate(settingValidation.create),
    settingController.createMaterial,
  )
  .get(
    auth(routePermissions.ADMIN.read),
    validate(settingValidation.getById),
    settingController.getMaterial,
  )
  .put(
    auth(routePermissions.ADMIN.update),
    validate(settingValidation.update),
    settingController.updateMaterial,
  )
  .delete(
    auth(routePermissions.ADMIN.update),
    validate(settingValidation.getById),
    settingController.deleteMaterial,
  );

router.route('/material/list').get(auth(), settingController.getMaterialList);

router
  .route('/merchant')
  .post(
    auth(routePermissions.ADMIN.create),
    validate(settingValidation.create),
    settingController.createMerchant,
  )
  .get(
    auth(routePermissions.ADMIN.read),
    validate(settingValidation.getById),
    settingController.getMerchantById,
  )
  .put(
    auth(routePermissions.ADMIN.update),
    validate(settingValidation.update),
    settingController.updateMerchant,
  )
  .delete(
    auth(routePermissions.ADMIN.update),
    validate(settingValidation.getById),
    settingController.deleteMerchant,
  );

router.route('/merchant/list').get(auth(), settingController.getMerchantList);

module.exports = router;
