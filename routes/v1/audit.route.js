const express = require('express');
const { auth } = require('../../middlewares/auth');
const { routePermissions } = require('../../constants');
const auditController = require('../../controllers/audit.controller');

const router = express.Router();

// Get audit logs with filters (ADMINISTRATOR and GAIF_ADMIN)
router.get(
  '/logs',
  auth(routePermissions.ADMINISTRATOR.auditLogs),
  auditController.getAuditLogs,
);

// Get audit history for a specific entity (ADMINISTRATOR and GAIF_ADMIN)
router.get(
  '/entity/:entityType/:entityId',
  auth(routePermissions.ADMINISTRATOR.auditLogs),
  auditController.getEntityHistory,
);

module.exports = router;
