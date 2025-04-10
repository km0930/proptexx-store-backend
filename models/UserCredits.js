const { Schema, model } = require("mongoose");

const userCreditsSchema = new Schema({
  userId: {
    type: Schema.ObjectId,
    ref: "User",
    required: true,
  },
  isTrial: {
    type: Boolean,
    default: false,
  },
  isApi: {
    type: Boolean,
    default: false,
  },
  stagingCredit: {
    type: Number,
    default: 1,
  },
  refurnishingCredit: {
    type: Number,
    default: 1,
  },
  renovationCredit: {
    type: Number,
    default: 1,
  },
  photoEnhancementCredit: {
    type: Number,
    default: 1,
  },
  skyReplacementCredit: {
    type: Number,
    default: 1,
  },
  grassRepairCredit: {
    type: Number,
    default: 1,
  },
  objectRemovalCredit: {
    type: Number,
    default: 2,
  },
  imageTaggingCredit: {
    type: Number,
    default: 1,
  },
  imageComplianceCredit: {
    type: Number,
    default: 1,
  },
  descriptionGeneratorCredit: {
    type: Number,
    default: 1,
  },
  altTextGeneratorCredit: {
    type: Number,
    default: 1,
  },
  cluterringCredit: {
    type: Number,
    default: 1,
  },
});

module.exports = model("Usercredit", userCreditsSchema);
