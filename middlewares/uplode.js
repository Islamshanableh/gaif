const multer = require('multer');
const path = require('path');
const httpStatus = require('http-status');

const { resolve } = require('path');
const { existsSync, unlink } = require('fs');
const ApiError = require('../utils/ApiError');

// full controll of the file
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    if (!_file) return cb(new Error('Upload file error'), null);

    const fileExits = existsSync(
      resolve(process.cwd(), `./tmp/my-uploads/${_file.originalname}`),
    );

    if (!fileExits)
      return cb(null, resolve(process.cwd(), './tmp/my-uploads/'));

    unlink(
      resolve(process.cwd(), `./tmp/my-uploads/${_file.originalname}`),
      error => {
        if (error) return cb(error);
        return cb(null, resolve(process.cwd(), './tmp/my-uploads/'));
      },
    );

    cb(null, './tmp/my-uploads/');
  },
  filename(_req, file, cb) {
    cb(null, file.fieldname);
  },
  fileFilter(_req, file, cb) {
    const filetypes = /xlsx/;

    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase(),
    );

    if (file.fieldname !== 'catlog') {
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
});

exports.uploadCatlog = multer({ storage, limits: 10 }).single('catlog');
