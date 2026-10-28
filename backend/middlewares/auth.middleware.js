const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing or invalid token format.'
    });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error('FATAL: JWT_SECRET environment variable is missing.');
    return res.status(500).json({ success: false, message: 'Server configuration error.' });
  }

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Session expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid or forged authentication token.' });
  }
};