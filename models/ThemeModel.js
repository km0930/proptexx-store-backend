const { Schema, model } = require("mongoose");

const themeSchema = new Schema({
  userId: [
    {
      type: Schema.ObjectId,
      ref: "WidgetUser",
    },
  ],
  mainColor: {
    type: String,
    default: "#0233E4",
  },
  secondaryColor: {
    type: String,
    default: "#47C462",
  },
  bgColor: {
    type: String,
    default: "#191919",
  },
  textColor: {
    type: String,
    default: "#ffffff",
  },
  refDomain: {
    type: String,
  },
  mode: {
    type: String,
    default: "dark",
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
module.exports = model("Theme", themeSchema);
