const { Schema, model } = require("mongoose");
const paginate = require("./plugins/paginate.plugin");

const storeuserSchema = new Schema({
  userRef: {
    type: String,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    default: "user",
  },
  stripeCustomerId: {
    type: String,
  },
  credits: {
    type: Number,
    default: 0,
  },
  price: {
    type: Number,
    default: 0,
  },
  creditsPerMonth: {
    type: Number,
    default: 0,
  },
  planName: {
    type: String,
    default: "free",
  },
  planDuration: {
    type: String,
  },
  lastLoggedIn: {
    type: Date,
  },
  lastLoggedOut: {
    type: Date,
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

module.exports = model("Storeuser", storeuserSchema, "Storeuser");