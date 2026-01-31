const axios = require('axios');
const path = require('path');

// Load env vars
require('dotenv').config({ path: path.join(__dirname, '.env') });

const data = new URLSearchParams({
  client_id: process.env.EMAIL_CLIENT_ID,
  client_secret: process.env.EMAIL_CLIENT_SECRET,
  grant_type: 'authorization_code',
  code: 'PASTE_YOUR_AUTHORIZATION_CODE_HERE',
  redirect_uri: 'http://localhost',
  scope: 'offline_access https://graph.microsoft.com/Mail.Send',
});

axios
  .post(
    `https://login.microsoftonline.com/${process.env.EMAIL_TENANT_ID}/oauth2/v2.0/token`,
    data,
  )
  .then(res => {
    console.log('🎉 REFRESH TOKEN:');
    console.log(res.data);

    console.log(res.data.refresh_token);
  })
  .catch(err => {
    console.error('❌ ERROR:');
    console.error(err.response?.data || err.message);
  });
