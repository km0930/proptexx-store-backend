const express = require("express");
const router = express.Router();
const {
  createStoreUser,
  getUsers,
  getStoreUser,
} = require("../controllers/storeUserController");

router.route("/storeusers").post(createStoreUser);

router.route("/storeuser/:userRef").get(getStoreUser);


module.exports = router;
