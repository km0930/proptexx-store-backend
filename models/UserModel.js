const { Schema, model } = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const paginate = require("./plugins/paginate.plugin");

const userSchema = new Schema({
  name: {
    type: String,
    required: [true, "Please Enter Your Name"],
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
  googleId: {
    type: String,
  },
  linkedInId: {
    type: String,
  },
  emailVerifiedAt: {
    type: Date,
  },
  password: {
    type: String,
    select: false,
  },
  role: {
    type: String,
    default: "user",
  },
  rememberToken: {
    type: String,
  },
  typeOfBusiness: {
    type: String,
  },
  countryCode: {
    type: String,
  },
  countryLanguage: {
    type: String,
  },
  ip: {
    type: String,
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
  whiteLabeled: {
    type: Boolean,
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
  paymentUpdatedAt: {
    type: Date,
  },
  paymentCreatedAt:{
    type: Date
  },
  deletedAt: {
    type: Date,
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  usercredit: {
    type: Schema.Types.ObjectId,
    ref: "Usercredit",
  },
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  this.password = await bcrypt.hash(this.password, 10);
});

// JWT TOKEN
userSchema.methods.getJWTToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// Compare Password

userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generating Password Reset Token
userSchema.methods.getResetPasswordToken = function () {
  // Generating Token
  const resetToken = crypto.randomBytes(20).toString("hex");

  // Hashing and adding resetPasswordToken to userSchema
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordExpire = Date.now() + 240 * 60 * 1000;

  return resetToken;
};

userSchema.methods.logout = async function () {
  this.lastLoggedOut = new Date();
  await this.save(); // Save the updated user document
};

userSchema.plugin(paginate);

module.exports = model("User", userSchema, "User");
