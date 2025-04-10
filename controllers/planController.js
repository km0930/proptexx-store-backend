const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { planModel } = require("../models");

// create plan
exports.createPlan = catchAsyncErrors(async (req, res, next) => {
  const plan = await planModel.create(req.body);
  if (plan.length) {
    res.status(200).json({
      success: true,
      plan,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "plans not found",
    });
  }
});

// get all plans
exports.getAllPlans =(async (req, res, next) => {
  const plans = await planModel.find();
  if (plans) {
    res.status(200).json({
      success: true,
      plans,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "plan not found",
    });
  }
});

// get single plan
exports.getSinglePlan = catchAsyncErrors(async (req, res, next) => {
  const getPlan = await planModel.findById(req.params.id);
  if (getPlan) {
    res.status(200).json({
      success: true,
      getPlan,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "plan not found",
    });
  }
});
