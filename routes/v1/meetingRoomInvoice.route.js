const express = require('express');
const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');
const meetingRoomInvoiceController = require('../../controllers/meetingRoomInvoice.controller');
const meetingRoomInvoiceValidation = require('../../validations/meetingRoomInvoice.validation');
const { routePermissions } = require('../../constants');

const router = express.Router();

router
  .route('/')
  .post(
    auth(routePermissions.ADMINISTRATOR.create),
    validate(meetingRoomInvoiceValidation.createMeetingRoomInvoice),
    meetingRoomInvoiceController.createMeetingRoomInvoice,
  )
  .get(
    auth(routePermissions.ADMINISTRATOR.read),
    validate(meetingRoomInvoiceValidation.getMeetingRoomInvoiceList),
    meetingRoomInvoiceController.getMeetingRoomInvoiceList,
  );

router
  .route('/:id')
  .get(
    auth(routePermissions.ADMINISTRATOR.read),
    validate(meetingRoomInvoiceValidation.getMeetingRoomInvoiceById),
    meetingRoomInvoiceController.getMeetingRoomInvoiceById,
  )
  .delete(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(meetingRoomInvoiceValidation.deleteMeetingRoomInvoice),
    meetingRoomInvoiceController.deleteMeetingRoomInvoice,
  );

router.get(
  '/:id/pdf',
  auth(routePermissions.ADMINISTRATOR.read),
  validate(meetingRoomInvoiceValidation.downloadPDF),
  meetingRoomInvoiceController.downloadMeetingRoomInvoicePDF,
);

router.post(
  '/:id/resend-email',
  auth(routePermissions.ADMINISTRATOR.update),
  validate(meetingRoomInvoiceValidation.resendEmail),
  meetingRoomInvoiceController.resendMeetingRoomInvoiceEmail,
);

module.exports = router;
