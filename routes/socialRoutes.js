const express = require("express");
const {
  linkedinLogin,
  googleMapSearch,
} = require("../controllers/socialController");
const router = express.Router();

router.route("/linkedinlogin").post(linkedinLogin);
router.route("/googlemapsearch").post(googleMapSearch);

module.exports = router;
