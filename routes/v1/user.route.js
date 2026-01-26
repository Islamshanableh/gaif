const express = require('express');

const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');

const router = express.Router();
const { userController } = require('../../controllers');
const { userValidation } = require('../../validations');

// Only ADMINISTRATOR and GAIF_ADMIN can manage users
const MANAGE_USERS_PERMISSION = 'manageUsers';

// Create user (requires ADMINISTRATOR or GAIF_ADMIN)
router
  .route('/create')
  .post(
    auth(MANAGE_USERS_PERMISSION),
    validate(userValidation.createUser),
    userController.createUser,
  );

// Get all users (requires ADMINISTRATOR or GAIF_ADMIN)
router
  .route('/list')
  .get(
    auth(MANAGE_USERS_PERMISSION),
    validate(userValidation.userList),
    userController.getUsers,
  );

// Get user by ID (requires ADMINISTRATOR or GAIF_ADMIN)
router
  .route('/get')
  .get(
    auth(MANAGE_USERS_PERMISSION),
    validate(userValidation.getById),
    userController.getUserById,
  );

// Update user (requires ADMINISTRATOR or GAIF_ADMIN)
router
  .route('/update')
  .put(
    auth(MANAGE_USERS_PERMISSION),
    validate(userValidation.updateUser),
    userController.updateUser,
  );

// Delete user (requires ADMINISTRATOR or GAIF_ADMIN)
router
  .route('/delete')
  .delete(
    auth(MANAGE_USERS_PERMISSION),
    validate(userValidation.deleteUser),
    userController.deleteUser,
  );

// Approve user (requires ADMINISTRATOR or GAIF_ADMIN)
router
  .route('/approve')
  .post(
    auth(MANAGE_USERS_PERMISSION),
    validate(userValidation.approveUser),
    userController.approveUser,
  );

// Update own password (any authenticated user)
router
  .route('/update-password')
  .post(
    auth(),
    validate(userValidation.updatePassword),
    userController.updatePassword,
  );

module.exports = router;
