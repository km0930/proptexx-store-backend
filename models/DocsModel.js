const { Schema, model } = require("mongoose");

const docsSchema = new Schema({
  userId: {
    type: Schema.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required:true,
    unique:true
  },
  slug: {
    type: String,
    required:true
  },
  type: {
    type: String,
    default:"widget"
  },
  content: {
    type: String
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
module.exports = model("Docs", docsSchema);
