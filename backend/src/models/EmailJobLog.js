const mongoose = require('mongoose');
const { Schema } = mongoose;

const emailJobLogSchema = new Schema(
  {
    jobId:    { type: Schema.Types.ObjectId, ref: 'EmailJob', required: true, index: true },
    event:    { type: String, required: true },
    message:  { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: null },
    timestamp:{ type: Date, default: Date.now },
  },
  { timestamps: false }
);

module.exports = mongoose.model('EmailJobLog', emailJobLogSchema);
