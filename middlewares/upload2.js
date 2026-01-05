const multer = require('multer');
const path = require('path');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
// full controll of the file
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, './tmp/my-uploads/');
  },
  filename(_req, file, cb) {
    cb(null, `${Date.now()}${file.originalname.replaceAll(/\s/g, '')}`);
  },
});

exports.upload = function validate(data) {
  const {
    maxFileSize = 500,
    filetypes = /jpeg|png|jpg|svg|heif|tiff|jfif|gif|heif|bmp/,
    fields,
  } = data;
  const multerConfig = {
    storage,
    limits: { fileSize: maxFileSize * 1024 * 1024, files: 40 },
    fileFilter(_req, file, cb) {
      const extname = filetypes.test(
        path.extname(file.originalname).toLowerCase(),
      );

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
  };
  const multerMiddleware = multer(multerConfig);

  if (fields && fields.length > 0) {
    return multerMiddleware.fields(fields);
  }
  return multerMiddleware.any();
};

exports.uploadPublicationMedia = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024, files: 40 },
  fileFilter(_req, file, cb) {
    const filetypes = /jpeg|png|jpg|svg|heif|tiff|jfif|gif|heif|bmp|mp4/;
    // const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase(),
    );

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
}).fields([
  { name: 'VIDEO', maxCount: 1 },
  { name: 'IMAGE', maxCount: 1 },
]);
