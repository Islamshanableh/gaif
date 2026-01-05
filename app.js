/* eslint-disable no-undef */
// eslint-disable-next-line no-unused-expressions
process.env.NODE_ENV === 'development'
  ? require('dotenv').config({ path: `${__dirname}/.env` })
  : require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });

const compression = require('compression');
const express = require('express');
const fileUpload = require('express-fileupload');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');

const fs = require('fs');
const { IpFilter } = require('express-ipfilter');

const httpStatus = require('http-status');

const ApiError = require('./utils/ApiError');
const { errorConverter, errorHandler } = require('./middlewares/error');
const routes = require('./routes/v1');

const shouldCompress = (req, res) => {
  if (req.headers['x-no-compression']) {
    return false;
  }
  return compression.filter(req, res);
};

const app = express();

// enable cors TBU
app.use(cors());
const ips = [];

fs.readFile('blackList.txt', (err, data) => {
  if (err) console.log(err);
  ips.push(...(data.toString().split('\n') || []));
});

app.use(
  fileUpload({
    createParentPath: true,
  }),
);

app.use(IpFilter(ips, { log: false }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.json({ limit: '10mb' }));

app.use(
  compression({
    filter: shouldCompress,
    threshold: 1,
  }),
);

app.use(logger('short'));

app.use(cookieParser());

app.get('/', async (_req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
  };
  try {
    res.send(healthCheck);
  } catch (error) {
    healthCheck.message = error;
    res.status(503).send();
  }
});

app.use('/api/v1', routes);

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});
// convert error to ApiError, if needed
app.use(errorConverter);
// handle error
app.use(errorHandler);

module.exports = app;
