const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { ContactModel } = require("../models");

// create contacts
exports.createContact = catchAsyncErrors(async (req, res, next) => {
  const contact = await ContactModel.create(req.body);

  if (!contact) {
    return res.status(400).json({
      success: false,
      message: "Please try again",
    });
  }

  res.status(200).json({
    success: false,
    contact,
  });
});

// get contacts
exports.getContacts = catchAsyncErrors(async (req, res, next) => {
  const contacts = await ContactModel.find();

  if (!contacts?.length) {
    return res.status(400).json({
      success: false,
      message: "Contacts not found",
    });
  }
  res.status(200).json({
    success: false,
    contacts,
  });
});
