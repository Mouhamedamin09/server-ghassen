// utils/generateToken.js
require('dotenv').config();
const jwt = require('jsonwebtoken');

const generateToken = (userId, email) => {
    return jwt.sign(
        { userId, email },
        process.env.JWT_SECRET, // Use environment variable
        { expiresIn: '1h' } // Token expires in 1 hour
    );
};

module.exports = generateToken;
