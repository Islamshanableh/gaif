const path = require('path');
const fs = require('fs');
const httpStatus = require('http-status');
const ApiError = require('./ApiError');
const { fileService } = require('../services');

const FILES_DIR = path.join(__dirname, '../files');

/**
 * Upload file to local filesystem (legacy method)
 */
const uploadFile = async (file, folder = '') => {
  try {
    if (!file) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
    }

    const uploadPath = folder ? path.join(FILES_DIR, folder) : FILES_DIR;

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    const timestamp = Date.now();
    const ext = path.extname(file.name);
    const fileName = `${timestamp}${ext}`;
    const filePath = path.join(uploadPath, fileName);

    await file.mv(filePath);

    return folder ? `${folder}/${fileName}` : fileName;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `File upload failed: ${error.message}`,
    );
  }
};

/**
 * Upload file to database (new method)
 * @param {Object} file - File object from express-fileupload
 * @param {string} [entityType] - Entity type (e.g., 'registration', 'company')
 * @param {number} [entityId] - Entity ID
 * @param {string} [fieldName] - Field name (e.g., 'logo', 'passportCopy')
 * @returns {Object} File record with fileKey
 */
const uploadFileToDb = async (file, entityType = null, entityId = null, fieldName = null) => {
  try {
    if (!file) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
    }

    const fileData = {
      buffer: file.data,
      originalname: file.name,
      mimetype: file.mimetype,
      size: file.size,
    };

    const result = await fileService.uploadFile(fileData, entityType, entityId, fieldName);
    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `File upload failed: ${error.message}`,
    );
  }
};

/**
 * Upload multiple files to database
 * @param {Object} files - Files object from express-fileupload (can be single file or array)
 * @param {string} [entityType] - Entity type
 * @param {number} [entityId] - Entity ID
 * @returns {Array} Array of file records
 */
const uploadMultipleFilesToDb = async (files, entityType = null, entityId = null) => {
  try {
    if (!files) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No files uploaded');
    }

    // Handle single file or array of files
    const fileArray = Array.isArray(files) ? files : [files];
    const results = [];

    for (const file of fileArray) {
      const fileData = {
        buffer: file.data,
        originalname: file.name,
        mimetype: file.mimetype,
        size: file.size,
      };
      const result = await fileService.uploadFile(fileData, entityType, entityId);
      results.push(result);
    }

    return results;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `File upload failed: ${error.message}`,
    );
  }
};

const deleteFile = async filePath => {
  try {
    const fullPath = path.join(FILES_DIR, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (error) {
    console.error(`Failed to delete file: ${error.message}`);
  }
};

const getFilePath = filePath => {
  return path.join(FILES_DIR, filePath);
};

module.exports = {
  uploadFile,
  uploadFileToDb,
  uploadMultipleFilesToDb,
  deleteFile,
  getFilePath,
  FILES_DIR,
};
