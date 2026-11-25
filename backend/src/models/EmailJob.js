const mongoose = require('mongoose');
const { Schema } = mongoose;

const JOB_STATUSES   = ['SCHEDULED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'];
const RECURRENCE     = ['NONE', 'EVERY_HOUR', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM_REPEAT'];

const emailJobSchema = new Schema(
  {
    userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    senderId:         { type: Schema.Types.ObjectId, ref: 'SenderAccount', default: null },
    senderEmail:      { type: String, default: null },
    recipientEmail:   { type: String, required: true },
    subject:          { type: String, required: true },
    body:             { type: String, required: true },
    scheduledFor:     { type: Date, required: true },
    delayMs:          { type: Number, default: 0 },
    recurrence:       { type: String, enum: RECURRENCE, default: 'NONE' },
    repeatIntervalMs: { type: Number, default: null },
    status:           { type: String, enum: JOB_STATUSES, default: 'SCHEDULED', index: true },
    bullJobId:        { type: String, default: null },
    bullRepeatJobKey: { type: String, default: null },
    sentAt:           { type: Date, default: null },
    failedAt:         { type: Date, default: null },
    failureReason:    { type: String, default: null },
    previewUrl:       { type: String, default: null },
    retryCount:       { type: Number, default: 0 },
    rateLimitedCount: { type: Number, default: 0 },
    idempotencyKey:   { type: String, default: null },
  },
  { timestamps: true }
);

// Compound index for idempotency check
emailJobSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('EmailJob', emailJobSchema);
