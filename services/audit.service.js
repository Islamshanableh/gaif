const { AuditLog, User } = require('./db.service');

/**
 * Extract client IP from request
 * @param {Object} req - Express request object
 * @returns {string|null}
 */
const getClientIp = req => {
  if (!req) return null;
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.ip ||
    null
  );
};

/**
 * Extract user agent from request
 * @param {Object} req - Express request object
 * @returns {string|null}
 */
const getUserAgent = req => {
  if (!req) return null;
  return req.headers['user-agent'] || null;
};

/**
 * Compare two objects and return the differences
 * @param {Object} oldData - Original data
 * @param {Object} newData - Updated data
 * @param {Array} fieldsToTrack - Optional list of fields to track (tracks all if not provided)
 * @returns {Object} Object with field changes: { fieldName: { old: x, new: y } }
 */
const getChanges = (oldData, newData, fieldsToTrack = null) => {
  const changes = {};
  const old = oldData || {};
  const updated = newData || {};

  // Get all keys to compare
  const keys = fieldsToTrack || [
    ...new Set([...Object.keys(old), ...Object.keys(updated)]),
  ];

  keys.forEach(key => {
    // Skip internal fields
    if (['createdAt', 'updatedAt', 'password', 'mfaSecret'].includes(key)) {
      return;
    }

    const oldVal = old[key];
    const newVal = updated[key];

    // Convert to comparable strings for comparison
    const oldStr = oldVal === null || oldVal === undefined ? '' : String(oldVal);
    const newStr = newVal === null || newVal === undefined ? '' : String(newVal);

    if (oldStr !== newStr) {
      changes[key] = {
        old: oldVal,
        new: newVal,
      };
    }
  });

  return Object.keys(changes).length > 0 ? changes : null;
};

/**
 * Log a CREATE action
 * @param {Object} options
 * @param {number} options.userId - ID of the user performing the action
 * @param {string} options.entityType - Type of entity (e.g., 'Company', 'User')
 * @param {number} options.entityId - ID of the created entity
 * @param {string} options.entityName - Display name of the entity (optional)
 * @param {Object} options.newData - The created data
 * @param {Object} options.req - Express request object (for IP/UserAgent)
 * @returns {Promise<Object>} Created audit log entry
 */
const logCreate = async ({
  userId,
  entityType,
  entityId,
  entityName,
  newData,
  req,
}) => {
  const changes = {};
  if (newData) {
    Object.keys(newData).forEach(key => {
      if (!['createdAt', 'updatedAt', 'password', 'mfaSecret'].includes(key)) {
        changes[key] = { old: null, new: newData[key] };
      }
    });
  }

  return AuditLog.create({
    userId,
    action: 'CREATE',
    entityType,
    entityId,
    entityName: entityName || null,
    changes: Object.keys(changes).length > 0 ? changes : null,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  });
};

/**
 * Log an UPDATE action
 * @param {Object} options
 * @param {number} options.userId - ID of the user performing the action
 * @param {string} options.entityType - Type of entity
 * @param {number} options.entityId - ID of the updated entity
 * @param {string} options.entityName - Display name of the entity (optional)
 * @param {Object} options.oldData - Data before update
 * @param {Object} options.newData - Data after update
 * @param {Object} options.req - Express request object
 * @returns {Promise<Object|null>} Created audit log entry, or null if no changes
 */
const logUpdate = async ({
  userId,
  entityType,
  entityId,
  entityName,
  oldData,
  newData,
  req,
}) => {
  const changes = getChanges(oldData, newData);

  // Don't log if nothing changed
  if (!changes) return null;

  return AuditLog.create({
    userId,
    action: 'UPDATE',
    entityType,
    entityId,
    entityName: entityName || null,
    changes,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  });
};

/**
 * Log a DELETE action
 * @param {Object} options
 * @param {number} options.userId - ID of the user performing the action
 * @param {string} options.entityType - Type of entity
 * @param {number} options.entityId - ID of the deleted entity
 * @param {string} options.entityName - Display name of the entity (optional)
 * @param {Object} options.deletedData - The data that was deleted
 * @param {Object} options.req - Express request object
 * @returns {Promise<Object>} Created audit log entry
 */
const logDelete = async ({
  userId,
  entityType,
  entityId,
  entityName,
  deletedData,
  req,
}) => {
  const changes = {};
  if (deletedData) {
    Object.keys(deletedData).forEach(key => {
      if (!['createdAt', 'updatedAt', 'password', 'mfaSecret'].includes(key)) {
        changes[key] = { old: deletedData[key], new: null };
      }
    });
  }

  return AuditLog.create({
    userId,
    action: 'DELETE',
    entityType,
    entityId,
    entityName: entityName || null,
    changes: Object.keys(changes).length > 0 ? changes : null,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  });
};

/**
 * Get audit logs with filters and pagination
 * @param {Object} filters
 * @param {number} filters.userId - Filter by user who made the change
 * @param {string} filters.action - Filter by action type (CREATE/UPDATE/DELETE)
 * @param {string} filters.entityType - Filter by entity type
 * @param {number} filters.entityId - Filter by entity ID
 * @param {Date} filters.startDate - Filter by date range start
 * @param {Date} filters.endDate - Filter by date range end
 * @param {number} filters.page - Page number (default 1)
 * @param {number} filters.limit - Items per page (default 50)
 * @returns {Promise<Object>} { data, pagination }
 */
const getAuditLogs = async (filters = {}) => {
  const {
    userId,
    action,
    entityType,
    entityId,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = filters;

  const where = {};

  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  if (startDate || endDate) {
    const { Op } = require('./db.service');
    where.createdAt = {};
    if (startDate) where.createdAt[Op.gte] = new Date(startDate);
    if (endDate) where.createdAt[Op.lte] = new Date(endDate);
  }

  const offset = (page - 1) * limit;

  const { rows: data, count: total } = await AuditLog.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'fullName', 'role'],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get audit history for a specific entity
 * @param {string} entityType
 * @param {number} entityId
 * @returns {Promise<Array>} List of audit logs for this entity
 */
const getEntityHistory = async (entityType, entityId) => {
  return AuditLog.findAll({
    where: { entityType, entityId },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'fullName', 'role'],
      },
    ],
    order: [['createdAt', 'DESC']],
  });
};

module.exports = {
  logCreate,
  logUpdate,
  logDelete,
  getChanges,
  getAuditLogs,
  getEntityHistory,
};
