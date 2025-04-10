const { Schema, model } = require("mongoose");
const paginate = require("./plugins/paginate.plugin");

const widgetUserSchema = new Schema({
  email: {
    type: String,
  },
  phone: {
    type: Number,
  },
  firstName: {
    type: String,
    default: "",
  },
  lastName: {
    type: String,
    default: "",
  },
  joinedOrigin: {
    type: String,
    Unique: true,
  },
  userSource: {
    type: String,
    default: "widget",
  },
  role: {
    type: String,
    default: "user",
  },
  active: {
    type: Boolean,
    default: true,
  },
  otp: {
    type: String,
    default: "",
  },
  propertyOwner: {
    type: Boolean,
    default: false,
  },
  interested: {
    type: Boolean,
    default: false,
  },

  otpExpires: {
    type: Number,
  },
  lastActive: {
    type: Date,
  },
  lastLoggedIn: {
    type: Date,
  },
  lastLoggedOut: {
    type: Date,
  },
  theme: {
    type: Schema.ObjectId,
    ref: "Theme",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
  },
});

// Middleware to automatically set lastLoggedOut on logout
widgetUserSchema.methods.logout = async function () {
  this.lastLoggedOut = new Date();
  await this.save(); // Save the updated user document
};

widgetUserSchema.plugin(paginate);
module.exports = model("WidgetUser", widgetUserSchema);
