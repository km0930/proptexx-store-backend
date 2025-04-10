const jwt = require("jsonwebtoken");

const sendToken = async (user, statusCode, res) => {
  const token = await jwt.sign({ user }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

  res.status(statusCode).json({
    success: true,
    user,
    token,
  });
};

module.exports = sendToken;
