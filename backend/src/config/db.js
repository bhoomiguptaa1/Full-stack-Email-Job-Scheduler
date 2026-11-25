const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

const DEFAULT_MONGO_URI = 'mongodb://localhost:27017/reachinbox_db';

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || DEFAULT_MONGO_URI);
    logger.info('[MongoDB] Connected successfully via Mongoose.');
    return true;
  } catch (error) {
    logger.warn('[MongoDB] Connection warning. Ensure MongoDB is running.', {
      error: error.message,
    });
    return false;
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
