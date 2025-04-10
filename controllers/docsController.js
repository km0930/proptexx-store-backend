const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { DocsModel } = require("../models");

exports.createDocs = catchAsyncErrors(async (req, res, next) => {
  const docs = await DocsModel.create(req.body);
  if (docs) {
    res.status(200).json({
      success: true,
      docs,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "something went wrong",
    });
  }
});

// get all . ..
exports.getAllDocs = catchAsyncErrors(async (req, res, next) => {
  const docs = await DocsModel.find();
  res.status(200).json({
    success: true,
    docs,
  });
});

// get by id
exports.getDocById = catchAsyncErrors(async (req, res, next) => {
  const doc = await DocsModel.findById(req.params.id);
  console.log(
    "🚀 ~ file: docsController.js:33 ~ exports.getDocById=catchAsyncErrors ~ doc:",
    doc
  );
  if (!doc) {
    return res.status(404).json({
      success: false,
      message: "Document not found",
    });
  }
  res.status(200).json({
    success: true,
    doc,
  });
});

// Update doc

exports.updateDoc = catchAsyncErrors(async (req, res, next) => {
  let doc = await DocsModel.findById(req.params.id);
  if (!doc) {
    return res.status(404).json({
      success: false,
      message: "Document not found",
    });
  }

  doc = await DocsModel.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    doc,
  });
});

// Delete doc
exports.deleteDoc = catchAsyncErrors(async (req, res, next) => {
  try {
    const result = await DocsModel.findByIdAndDelete(req.params.id);

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    console.log("Document removed successfully");
    res.status(200).json({
      success: true,
      result,
      message: "Document deleted",
    });
  } catch (error) {
    console.error("Error removing document:", error);
    return res.status(500).json({
      success: false,
      message: "Error removing document",
    });
  }
});
