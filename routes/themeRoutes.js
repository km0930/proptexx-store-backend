const express = require("express");
const { updateTheme, getTheme } = require("../controllers/themeController");
const router = express.Router();

router.route("/updatetheme").put(updateTheme);
router.route("/getsingletheme").get(getTheme);

module.exports = router;
