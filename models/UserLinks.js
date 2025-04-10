const { Schema, model } = require("mongoose");
const paginate = require("./plugins/paginate.plugin");

const userlinksSchema = new Schema({
  userId: {
    type: Schema.ObjectId,
    ref: "User",
    required: true,
  },
  appName: {
    type: String,
  },
  ref: {
    type: String,
  },
  optJson: {
    type: Object,
  },
  response: {
    type: Array,
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
  feedback: {
    type: Schema.ObjectId,
    ref: "Feedback",
  },
});
userlinksSchema.plugin(paginate);
module.exports = model("Userlinks", userlinksSchema);
