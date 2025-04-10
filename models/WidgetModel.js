const { Schema, model } = require("mongoose");

const paginate = require("./plugins/paginate.plugin");

const widgetSchema = new Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
    required: true,
  },
  domain: {
    type: Array,
    required: true,
  },
  urls: {
    type: Array,
    default: [],
  },
  prohibitedUrls: {
    type: Array,
    default: [],
  },
  jsfile: {
    type: String,
    required: true,
  },
  xAxis: {
    type: Number,
    default: 86,
  },
  yAxis: {
    type: Number,
    default: 85,
  },
  ctaId: {
    type: String,
    default: "",
  },
  scrapingArrayId: {
    type: String,
    default: "",
  },
  isNotfloatingIcon: {
    type: Boolean,
    default: false,
  },
  version: {
    type: String,
    required: true,
  },
  region: {
    type: String,
    required: true,
  },
  logoWithText: {
    type: String,
    default: "https://app.proptexx.com/images/proptexx-logo.svg",
  },
  logoIcon: {
    type: String,
    default: "https://app.proptexx.com/favicon.svg",
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

widgetSchema.plugin(paginate);
module.exports = model("Widget", widgetSchema);
