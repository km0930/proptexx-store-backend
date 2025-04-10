const { StoreuserModel } = require("../models");

// create store user
exports.createStoreUser = (async (req, res, next) => {
  const {
    userRef,
    active,
    stripeCustomerId,
    
  } = req.body;
  const storeUser = await StoreuserModel.create(req.body);
  if (storeUser.length) {
    res.status(200).json({
      success: true,
      storeUser,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "store users not found",
    });
  }
});

// get all plans
exports.getUsers =(async (req, res, next) => {
  const users = await StoreuserModel.find();
  if (users) {
    res.status(200).json({
      success: true,
      users,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "store user not found",
    });
  }
});

// get single plan
exports.getStoreUser = (async (req, res, next) => {
  console.log('1', req.body);
  console.log('2', req.params.userRef);
  const storeUser = await StoreuserModel.findById(req.params.userRef);
  if (storeUser) {
    res.status(200).json({
      success: true,
      storeUser,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "store user not found",
    });
  }
});
