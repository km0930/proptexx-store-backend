const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { ThemeModel } = require("../models");
const WidgetModel = require("../models/WidgetModel");

exports.updateTheme = catchAsyncErrors(async (req, res, next) => {
  const { mainColor, secondaryColor, bgColor, textColor, refDomain } = req.body;

  const theme = await ThemeModel.findOneAndUpdate(
    {
      refDomain,
    },
    {
      mainColor,
      secondaryColor,
      bgColor,
      textColor,
    },
    { new: true }
  );
  if (!theme) {
    return res.status(400).json({
      message: "theme not exists",
      success: true,
    });
  }
  return res.status(200).json({
    theme,
    success: true,
  });
});

// get theme
exports.getTheme = catchAsyncErrors(async (req, res, next) => {
  const { refDomain } = req.query;
  const regex = new RegExp(
    `^(?:https?://)?(?:www\\.)?${refDomain}(?:/)?$`,
    "i"
  );
  const theme = await ThemeModel.findOne({
    refDomain: {
      $regex: regex,
    },
  });

  if (!theme) {
    return res.status(400).json({
      message: "theme not exists",
      success: true,
    });
  }
  return res.status(200).json({
    theme,
    success: true,
  });
});
