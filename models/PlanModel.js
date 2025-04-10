const { Schema, model } = require("mongoose");

const planSchema = new Schema({
  type: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  setting: {
    type: Object,
  },
  featureList: {
    type: Object,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
  },
  deletedAt: {
    type: Date,
  },
});
module.exports = model("Plan", planSchema, "Plan");
