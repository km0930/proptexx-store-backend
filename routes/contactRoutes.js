const express = require("express");
const {
  createContact,
  getContacts,
} = require("../controllers/contactController");
const router = express.Router();

router.route("/").post(createContact).get(getContacts);

module.exports = router;
