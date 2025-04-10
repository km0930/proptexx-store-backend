const { Schema, model } = require("mongoose");
const paginate = require("./plugins/paginate.plugin");

const partnerSchema = new Schema({
  userId: {
    type: Schema.ObjectId,
    ref: "User",
    required: true,
  },
  uuid: {
    type: String,
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
  appTheme: {
    type: String,
  },
  params: {
    type: String,
  },
});
partnerSchema.plugin(paginate);
module.exports = model("Partner", partnerSchema, "Userpartner");