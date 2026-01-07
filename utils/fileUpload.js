const path = require('path');
const fs = require('fs');
const httpStatus = require('http-status');
const ApiError = require('./ApiError');

const FILES_DIR = path.join(__dirname, '../files');

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
  deleteFile,
  getFilePath,
  FILES_DIR,
};
