const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Get token from header or query param
  const authHeader = req.header('Authorization');
  let token = null;

  if (authHeader) {
    // Token might be prepended with "Bearer "
    token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7, authHeader.length) 
      : authHeader;
  } else if (req.query.token) {
    token = req.query.token;
  }

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret_sports_ai_token_key_123!');
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};
