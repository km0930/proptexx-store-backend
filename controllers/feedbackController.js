const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { FeedbackModel, userlinksModel } = require("../models");

// create feedback
exports.createAndUpdateFeedback = catchAsyncErrors(async (req, res, next) => {
  const { userLinkId } = req.params;
  const result = await FeedbackModel.findOneAndUpdate(
    { userLinkId },
    { ...req.body, userLinkId },
    { upsert: true, new: true }
  );

  if (!result) {
    return res.status(400).json({
      success: false,
      message: "something went wrong",
    });
  }
  const userlinks = await userlinksModel.findByIdAndUpdate(
    userLinkId,
    { feedback: result?._id },
    { new: true }
  );

  if (userlinks) {
    return res.status(200).json({
      success: true,
      result,
      message: "updated successfully",
    });
  }
});

// delete feedback
exports.deleteFeedback = catchAsyncErrors(async (req, res, next) => {
  const { userLinkId } = req.params;
  const result = await FeedbackModel.findOneAndDelete({ userLinkId });

  if (!result) {
    return res.status(400).json({
      success: false,
      message: "Feedback not deleted",
    });
  }

  return res.status(200).json({
    success: true,
    result,
    message: "Feedback deleted successfully",
  });
});
