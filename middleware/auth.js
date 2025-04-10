const { userModel, WidgetUserModel } = require("../models");
const ErrorHander = require("../utils/errorHandler");
const catchAsyncErrors = require("./catchAsyncErrors");
const jwt = require("jsonwebtoken");

exports.isAuthenticatedUser = catchAsyncErrors(async (req, res, next) => {
  const token = req.headers.authorization || req.body.token;
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Please Login to access this resource",
    });
  }
  jwt.verify(
    token?.split(" ")[1],
    process.env.JWT_SECRET,
    async (err, decoded) => {
      if (err) {
        const user = await userModel.findById(token);
        const widgetUser = await WidgetUserModel.findById(token);

        if (user || widgetUser) {
          req.user = user ? { user } : { widgetUser };
          next();
        } else {
          return res.status(401).json({ message: "Token verification failed" });
        }
      } else {
        req.user = decoded;
        next();
      }
    }
  );
});

exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.user.role)) {
      return next(
        new ErrorHander(
          `Role: ${req.user.user.role} is not allowed to access this resouce `,
          403
        )
      );
    }

    next();
  };
};
