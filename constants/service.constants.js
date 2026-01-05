module.exports = {
  auth: {
    authLoginProvider: ['LOCAL', 'APPLE', 'GOOGLE'],
    tokenTypes: {
      ACCESS: 'access',
      REFRESH: 'refresh',
      RESET_PASSWORD: 'resetPassword',
      VERIFY_EMAIL: 'verifyEmail',
      VERIFY_MOBILE: 'verifyMobile',
    },
    platform: {
      ANDROID: 'android',
      IOS: 'ios',
      WEB: 'Web',
    },
  },
};
