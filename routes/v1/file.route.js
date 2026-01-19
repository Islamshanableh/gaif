const express = require('express');

const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');

const { fileController } = require('../../controllers');
const { fileValidation } = require('../../validations');

const router = express.Router();

// Upload routes (require authentication)
router.post(
  '/upload',
  auth(),
  validate(fileValidation.uploadFile),
  fileController.uploadFile,
);

router.post(
  '/upload-multiple',
  auth(),
  validate(fileValidation.uploadMultipleFiles),
  fileController.uploadMultipleFiles,
);

// Get file by ID (public - for displaying files)
router.get(
  '/:id',
  auth(),
  validate(fileValidation.getFileById),
  fileController.getFileById,
);

// Get file by key (public - for displaying files)
router.get(
  '/key/:fileKey',
  auth(),
  validate(fileValidation.getFileByKey),
  fileController.getFileByKey,
);

// Download file
router.get(
  '/:id/download',
  auth(),
  validate(fileValidation.getFileById),
  fileController.downloadFileById,
);

// Get file metadata
router.get(
  '/:id/metadata',
  auth(),
  validate(fileValidation.getFileById),
  fileController.getFileMetadata,
);

// Get files by entity
router.get(
  '/entity/:entityType/:entityId',
  auth(),
  validate(fileValidation.getFilesByEntity),
  fileController.getFilesByEntity,
);

// Update file entity association
router.put(
  '/:id/entity',
  auth(),
  validate(fileValidation.updateFileEntity),
  fileController.updateFileEntity,
);

// Delete file by ID
router.delete(
  '/:id',
  auth(),
  validate(fileValidation.getFileById),
  fileController.deleteFile,
);

// Delete file by key
router.delete(
  '/key/:fileKey',
  auth(),
  validate(fileValidation.getFileByKey),
  fileController.deleteFileByKey,
);

module.exports = router;
