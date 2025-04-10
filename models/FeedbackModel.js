const { Schema, model } = require("mongoose");

const feedback = new Schema({
  userLinkId: {
    type: Schema.ObjectId,
    ref: "Userlinks",
    required: true,
  },
  likedImages: {
    type: Array,
    default: [],
  },

  dislikedImages: {
    type: Array,
    default: [],
  },
  isLike: {
    type: Boolean,
    default: false,
  },
  comment: { type: String },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = model("Feedback", feedback);
