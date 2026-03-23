// ─── Global Error Handler ───
const errorHandler = (err, req, res, _next) => {
  console.error('🔴 Error:', err.message);
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
