const catchAsync = require('../utils/catchAsync');
const auditService = require('../services/audit.service');

/**
 * Get audit logs with filters and pagination
 * GET /api/v1/audit/logs
 */
exports.getAuditLogs = catchAsync(async (req, res) => {
  const {
    userId,
    action,
    entityType,
    entityId,
    startDate,
    endDate,
    page,
    limit,
  } = req.query;

  const result = await auditService.getAuditLogs({
    userId: userId ? parseInt(userId, 10) : undefined,
    action,
    entityType,
    entityId: entityId ? parseInt(entityId, 10) : undefined,
    startDate,
    endDate,
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 50,
  });

  return res.json(result);
});

/**
 * Get audit history for a specific entity
 * GET /api/v1/audit/entity/:entityType/:entityId
 */
exports.getEntityHistory = catchAsync(async (req, res) => {
  const { entityType, entityId } = req.params;

  const history = await auditService.getEntityHistory(
    entityType,
    parseInt(entityId, 10),
  );

  return res.json({ data: history });
});
