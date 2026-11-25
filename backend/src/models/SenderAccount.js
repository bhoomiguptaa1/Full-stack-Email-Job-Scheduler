const mongoose = require('mongoose');
const { Schema } = mongoose;

const senderAccountSchema = new Schema(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email:       { type: String, required: true, lowercase: true, trim: true },
    name:        { type: String, default: null },
    hourlyLimit: { type: Number, default: 50, min: 1 },
    minDelayMs:  { type: Number, default: 0, min: 0 },
    isActive:    { type: Boolean, default: true },
    isDefault:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SenderAccount', senderAccountSchema);
