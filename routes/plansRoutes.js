const express = require("express");
const router = express.Router();
const {
  createPlan,
  getAllPlans,
  getSinglePlan,
} = require("../controllers/planController");
const { isAuthenticatedUser } = require("../middleware/auth");

router.route("/plans").post(isAuthenticatedUser, createPlan).get(getAllPlans);

router.route("/singleplan/:id").get(getSinglePlan);

module.exports = router;
