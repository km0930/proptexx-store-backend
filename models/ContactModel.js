const { Schema, model } = require("mongoose");

const contactSchema = new Schema({
  company: {
    type: String,
  },
  email: {
    type: String,
  },
  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  phone: {
    type: String,
  },
  webUrl: {
    type: String,
  },
  message: {
    type: String,
  },
  createAt: {
    type: Date,
    default: Date.now,
  },
});
module.exports = model("Contact", contactSchema);
