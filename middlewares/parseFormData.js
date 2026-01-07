const parseFormData = (fields = []) => {
  return (req, res, next) => {
    if (req.body) {
      fields.forEach(field => {
        if (req.body[field] && typeof req.body[field] === 'string') {
          try {
            req.body[field] = JSON.parse(req.body[field]);
          } catch (error) {
            // If parsing fails, leave it as is and let validation handle it
          }
        }
      });
    }
    next();
  };
};

module.exports = parseFormData;
