const multer = require('multer');
const path = require('path');
const httpStatus = require('http-status');
const cuid = require('cuid');
const ApiError = require('../utils/ApiError');

// full controll of the file
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, './tmp/my-uploads/');
  },
  filename(_req, file, cb) {
    const name = file?.originalname?.split('.');
    // cb(null, `${file?.originalname?.replaceAll(/[^\w\d]/g, '')}`);
    cb(
      null,
      `${file?.originalname?.replaceAll(
        file?.originalname,
        `${cuid()}.${name?.[name?.length - 1]}`,
      )}`,
    );
  },
});

exports.uploadMiddleWare = multer({
  storage,
  // limits: { fileSize: 4 * 524 * 1024 * 1024, files: 3 },
  fileFilter(_req, file, cb) {
    const filetypes =
      /jpeg|png|jpg|svg|heif|tiff|jfif|gif|bmp|avi|heif|hevc|mov|h264|h265|264|265|avi|mts|m2ts|sgi|tag|bmb|heic|mxf|mp4|pdf|webp|ico/;
    // const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase(),
    );

    if (file.fieldname !== 'file') {
      cb(new ApiError(httpStatus.BAD_REQUEST, `Error:  unexpected fieldname`));
    }

    if (extname) {
      return cb(null, true);
    }

    cb(
      new ApiError(
        httpStatus.BAD_REQUEST,
        `Error: File upload only supports the following filetypes - ${filetypes}`,
      ),
    );
  },
}).array('file');
