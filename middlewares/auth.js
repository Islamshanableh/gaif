/* eslint-disable no-unused-vars */
const jwt = require('jsonwebtoken');
const fs = require('fs');
const httpStatus = require('http-status');
const config = require('../config/config');
const ApiError = require('../utils/ApiError');
const { roleRights } = require('../config/roles');
const { getUserById } = require('../services/user.service');

const JWT_PK = fs.readFileSync('./public.key', 'utf8');

const verifyOptions = {
  algorithm: 'RS256',
};

const verifyCB =
  (req, resolve, reject, requiredRights) => async (err, user) => {
    if (err || !user) {
      if (err instanceof jwt.TokenExpiredError) {
        return reject(
          new ApiError(httpStatus.UNAUTHORIZED, 'token has been expired'),
        );
      }
      return reject(
        new ApiError(httpStatus.UNAUTHORIZED, 'Please Authenticate'),
      );
    }

    req.user = user;
    if (user.sub.role === 'USER') {
      const findUser = await getUserById(user.sub.id);

      if (!findUser?.isActive) {
        return reject(
          new ApiError(
            httpStatus.UNAUTHORIZED,
            'user is not allowed to login by the system login policy',
          ),
        );
      }
    }
    if (requiredRights.length) {
      const userRights = roleRights.get(user.sub.role);
      const hasRequiredRights = userRights
        ? requiredRights.every(requiredRight =>
            userRights?.includes(requiredRight),
          )
        : false;

      if (!hasRequiredRights) {
        return reject(new ApiError(httpStatus.FORBIDDEN, 'Forbidden'));
      }
    }

    resolve();
  };

exports.auth =
  (...requiredRights) =>
  async (req, res, next) => {
    return new Promise((resolve, reject) => {
      jwt.verify(
        req?.headers?.authorization?.split(' ')[1],
        JWT_PK,
        verifyOptions,
        verifyCB(req, resolve, reject, requiredRights),
      );
    })
      .then(() => next())
      .catch(err => next(err));
  };
