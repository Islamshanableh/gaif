const express = require('express');

const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');

const { ticketController } = require('../../controllers');

const { ticketValidation } = require('../../validations');

const { routePermissions } = require('../../constants');

const router = express.Router();

router
  .route('/')
  .get(
    auth(),
    validate(ticketValidation.getById),
    ticketController.getTicketById,
  )
  .post(
    auth(),
    validate(ticketValidation.createTicket),
    ticketController.createTicket,
  )
  .put(auth(), validate(ticketValidation.update), ticketController.updateTicket)
  .delete(
    auth(routePermissions.ADMIN.update),
    validate(ticketValidation.getById),
    ticketController.deleteTicket,
  );

router.route('/upload').post(auth(), ticketController.uploadFilesTicket);

router
  .route('/move')
  .put(
    auth(),
    validate(ticketValidation.moveTickets),
    ticketController.moveTickets,
  );
router
  .route('/color')
  .put(
    auth(),
    validate(ticketValidation.changeColorTickets),
    ticketController.changeColorTickets,
  );

router
  .route('/file')
  .delete(
    auth(),
    validate(ticketValidation.getById),
    ticketController.deleteFile,
  );

router
  .route('/comment')
  .delete(
    auth(routePermissions.ADMIN.update),
    validate(ticketValidation.getById),
    ticketController.deleteComment,
  )
  .post(
    auth(),
    validate(ticketValidation.createComment),
    ticketController.createComment,
  )
  .put(
    auth(),
    validate(ticketValidation.updateComment),
    ticketController.updateComment,
  );

router
  .route('/archive')
  .put(
    auth(routePermissions.ADMIN.update),
    validate(ticketValidation.getById),
    ticketController.archivedTicket,
  );

router
  .route('/sub-ticket')
  .get(
    auth(),
    validate(ticketValidation.getById),
    ticketController.getSubTicketById,
  )
  .post(
    auth(),
    validate(ticketValidation.createSubTicket),
    ticketController.createSubTicket,
  )
  .put(
    auth(),
    validate(ticketValidation.updateSubTicket),
    ticketController.updateSubTicket,
  )
  .delete(
    auth(routePermissions.ADMIN.update),
    validate(ticketValidation.getById),
    ticketController.deleteSubTicket,
  );

router
  .route('/archive/sub-ticket')
  .put(
    auth(routePermissions.ADMIN.update),
    validate(ticketValidation.getById),
    ticketController.archivedSubTicket,
  );

module.exports = router;
