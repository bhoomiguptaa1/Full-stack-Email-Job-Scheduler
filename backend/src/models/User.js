const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name:  { type: String, default: null },
    passwordHash: { type: String, default: null },
    role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    avatarUrl: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
