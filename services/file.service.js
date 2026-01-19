/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
const crypto = require('crypto');
const { File } = require('./db.service');
const ApiError = require('../utils/ApiError');

/**
 * Generate a unique file key
 * @returns {string} Unique file key
 */
const generateFileKey = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${randomStr}`;
};

/**
 * Upload a file to the database
 * @param {Object} fileData - File data object
 * @param {Buffer} fileData.buffer - File content as buffer
 * @param {string} fileData.originalname - Original file name
 * @param {string} fileData.mimetype - File MIME type
 * @param {number} fileData.size - File size in bytes
 * @param {string} [entityType] - Entity type (e.g., 'registration', 'company', 'spouse')
 * @param {number} [entityId] - Entity ID
 * @param {string} [fieldName] - Field name (e.g., 'participantPicture', 'passportCopy')
 * @returns {Object} Created file record
 */
exports.uploadFile = async (
  fileData,
  entityType = null,
  entityId = null,
  fieldName = null,
) => {
  const fileKey = generateFileKey();

  const file = await File.create({
    fileKey,
    fileName: fileData.originalname,
    fileType: fileData.mimetype,
    fileSize: fileData.size,
    fileContent: fileData.buffer,
    entityType,
    entityId,
    fieldName,
  });

  // Return file info without content
  return {
    id: file.id,
    fileKey: file.fileKey,
    fileName: file.fileName,
    fileType: file.fileType,
    fileSize: file.fileSize,
    entityType: file.entityType,
    entityId: file.entityId,
    fieldName: file.fieldName,
    createdAt: file.createdAt,
  };
};

/**
 * Get file by ID (with content)
 * @param {number} id - File ID
 * @returns {Object} File record with content
 */
exports.getFileById = async id => {
  const file = await File.findOne({
    where: { id, isActive: true },
  });

  if (!file) {
    throw new ApiError(httpStatus.NOT_FOUND, 'File not found');
  }

  return file;
};

/**
 * Get file by file key (with content)
 * @param {string} fileKey - File key
 * @returns {Object} File record with content
 */
exports.getFileByKey = async fileKey => {
  const file = await File.findOne({
    where: { fileKey, isActive: true },
  });

  if (!file) {
    throw new ApiError(httpStatus.NOT_FOUND, 'File not found');
  }

  return file;
};

/**
 * Get file metadata by ID (without content)
 * @param {number} id - File ID
 * @returns {Object} File metadata
 */
exports.getFileMetadataById = async id => {
  const file = await File.findOne({
    where: { id, isActive: true },
    attributes: { exclude: ['fileContent'] },
  });

  if (!file) {
    throw new ApiError(httpStatus.NOT_FOUND, 'File not found');
  }

  return file.toJSON();
};

/**
 * Get files by entity
 * @param {string} entityType - Entity type
 * @param {number} entityId - Entity ID
 * @returns {Array} Array of file metadata
 */
exports.getFilesByEntity = async (entityType, entityId) => {
  const files = await File.findAll({
    where: { entityType, entityId, isActive: true },
    attributes: { exclude: ['fileContent'] },
    order: [['createdAt', 'DESC']],
  });

  return files.map(f => f.toJSON());
};

/**
 * Delete file (soft delete)
 * @param {number} id - File ID
 * @returns {Object} Deleted file metadata
 */
exports.deleteFile = async id => {
  const file = await File.findByPk(id);

  if (!file) {
    throw new ApiError(httpStatus.NOT_FOUND, 'File not found');
  }

  await File.update({ isActive: false }, { where: { id } });

  return {
    id: file.id,
    fileKey: file.fileKey,
    fileName: file.fileName,
    deleted: true,
  };
};

/**
 * Delete file by key (soft delete)
 * @param {string} fileKey - File key
 * @returns {Object} Deleted file metadata
 */
exports.deleteFileByKey = async fileKey => {
  const file = await File.findOne({ where: { fileKey } });

  if (!file) {
    throw new ApiError(httpStatus.NOT_FOUND, 'File not found');
  }

  await File.update({ isActive: false }, { where: { fileKey } });

  return {
    id: file.id,
    fileKey: file.fileKey,
    fileName: file.fileName,
    deleted: true,
  };
};

/**
 * Update file entity association
 * @param {number} fileId - File ID
 * @param {string} entityType - Entity type
 * @param {number} entityId - Entity ID
 * @param {string} [fieldName] - Field name
 * @returns {Object} Updated file metadata
 */
exports.updateFileEntity = async (
  fileId,
  entityType,
  entityId,
  fieldName = null,
) => {
  await File.update(
    { entityType, entityId, fieldName },
    { where: { id: fileId } },
  );

  return exports.getFileMetadataById(fileId);
};

/**
 * Upload multiple files
 * @param {Array} files - Array of file data objects
 * @param {string} [entityType] - Entity type
 * @param {number} [entityId] - Entity ID
 * @returns {Array} Array of created file records
 */
exports.uploadMultipleFiles = async (
  files,
  entityType = null,
  entityId = null,
) => {
  const results = [];

  for (const fileData of files) {
    const result = await exports.uploadFile(
      fileData,
      entityType,
      entityId,
      fileData.fieldName,
    );
    results.push(result);
  }

  return results;
};
