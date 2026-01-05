const nodemailer = require('nodemailer');

exports.sendEmail = async (email, message, subject) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'shanboolking@gmail.com',
      pass: 'hswt vufu znvl vxji', // the 16-character app password
    },
  });

  const mailOptions = {
    from: '"Mood Muff" <shanboolking@gmail.com>',
    to: email,
    subject,
    text: message,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log('Error:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
};
