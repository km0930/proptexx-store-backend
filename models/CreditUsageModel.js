const { Schema, model } = require("mongoose");

const creditusageSchema = new Schema({
  userId: {
    type: Schema.ObjectId,
    ref: "User",
    required: true,
  },

  value: {
    type: Number,
    default: 1,
  },
  productCode: {
    type: String,
  },
  apiUrl: {
    type: String,
  },
  inputJson: {
    type: String,
  },
  outputJson: {
    type: Object,
  },
  fileSource: {
    type: String,
  },
  fileResult: {
    type: String,
  },
  status: {
    type: String,
  },
  purchaseDate: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
  },
});
module.exports = model("Creditusage", creditusageSchema);
