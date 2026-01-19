const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { fileService } = require('../services');
const {
  uploadFileToDb,
  uploadMultipleFilesToDb,
} = require('../utils/fileUpload');
const ApiError = require('../utils/ApiError');

/**
 * Upload a single file
 * POST /api/v1/file/upload
 */
exports.uploadFile = catchAsync(async (req, res) => {
  if (!req.files || !req.files.file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
  }

  const { entityType, entityId, fieldName } = req.body;

  const result = await uploadFileToDb(
    req.files.file,
    entityType || null,
    entityId ? parseInt(entityId, 10) : null,
    fieldName || null,
  );

  res.status(httpStatus.OK).send({
    result,
    message: 'File uploaded successfully',
  });
});

/**
 * Upload multiple files
 * POST /api/v1/file/upload-multiple
 */
exports.uploadMultipleFiles = catchAsync(async (req, res) => {
  if (!req.files || !req.files.files) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No files uploaded');
  }

  const { entityType, entityId } = req.body;

  const results = await uploadMultipleFilesToDb(
    req.files.files,
    entityType || null,
    entityId ? parseInt(entityId, 10) : null,
  );

  res.status(httpStatus.OK).send({
    results,
    message: `${results.length} file(s) uploaded successfully`,
  });
});

/**
 * Get file by ID (serves the actual file)
 * GET /api/v1/file/:id
 */
exports.getFileById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const file = await fileService.getFileById(parseInt(id, 10));

  // Set appropriate headers
  res.set({
    'Content-Type': file.fileType,
    'Content-Disposition': `inline; filename="${file.fileName}"`,
    'Content-Length': file.fileSize,
    'Cache-Control': 'public, max-age=31536000',
  });

  // Send the file content
  res.send(file.fileContent);
});

/**
 * Get file by file key (serves the actual file)
 * GET /api/v1/file/key/:fileKey
 */
exports.getFileByKey = catchAsync(async (req, res) => {
  const { fileKey } = req.params;

  const file = await fileService.getFileByKey(fileKey);

  // Set appropriate headers
  res.set({
    'Content-Type': file.fileType,
    'Content-Disposition': `inline; filename="${file.fileName}"`,
    'Content-Length': file.fileSize,
    'Cache-Control': 'public, max-age=31536000',
  });

  // Send the file content
  res.send(file.fileContent);
});

/**
 * Download file by ID (forces download)
 * GET /api/v1/file/:id/download
 */
exports.downloadFileById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const file = await fileService.getFileById(parseInt(id, 10));

  // Set headers to force download
  res.set({
    'Content-Type': file.fileType,
    'Content-Disposition': `attachment; filename="${file.fileName}"`,
    'Content-Length': file.fileSize,
  });

  res.send(file.fileContent);
});

/**
 * Get file metadata by ID (without content)
 * GET /api/v1/file/:id/metadata
 */
exports.getFileMetadata = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await fileService.getFileMetadataById(parseInt(id, 10));

  res.status(httpStatus.OK).send({ result });
});

/**
 * Get files by entity
 * GET /api/v1/file/entity/:entityType/:entityId
 */
exports.getFilesByEntity = catchAsync(async (req, res) => {
  const { entityType, entityId } = req.params;

  const results = await fileService.getFilesByEntity(
    entityType,
    parseInt(entityId, 10),
  );

  res.status(httpStatus.OK).send({ results });
});

/**
 * Delete file by ID
 * DELETE /api/v1/file/:id
 */
exports.deleteFile = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await fileService.deleteFile(parseInt(id, 10));

  res.status(httpStatus.OK).send({
    result,
    message: 'File deleted successfully',
  });
});

/**
 * Delete file by key
 * DELETE /api/v1/file/key/:fileKey
 */
exports.deleteFileByKey = catchAsync(async (req, res) => {
  const { fileKey } = req.params;

  const result = await fileService.deleteFileByKey(fileKey);

  res.status(httpStatus.OK).send({
    result,
    message: 'File deleted successfully',
  });
});

/**
 * Update file entity association
 * PUT /api/v1/file/:id/entity
 */
exports.updateFileEntity = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { entityType, entityId, fieldName } = req.body;

  const result = await fileService.updateFileEntity(
    parseInt(id, 10),
    entityType,
    entityId ? parseInt(entityId, 10) : null,
    fieldName || null,
  );

  res.status(httpStatus.OK).send({
    result,
    message: 'File entity updated successfully',
  });
});
