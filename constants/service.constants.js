module.exports = {
  auth: {
    authLoginProvider: ['LOCAL', 'APPLE', 'GOOGLE'],
    tokenTypes: {
      ACCESS: 'access',
      REFRESH: 'refresh',
      RESET_PASSWORD: 'resetPassword',
      VERIFY_EMAIL: 'verifyEmail',
      VERIFY_MOBILE: 'verifyMobile',
      MFA_PENDING: 'MFA_PENDING',
    },
    platform: {
      ANDROID: 'android',
      IOS: 'ios',
      WEB: 'Web',
    },
  },
};
