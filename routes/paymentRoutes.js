const express = require("express");
const router = express.Router();
const {
  processPayment,
  subscriptionCancelation,
  paymentSuccess,
  paymentTrial,
  updateUser,
  consumeCredits
} = require("../controllers/paymentController");
const { isAuthenticatedUser } = require("../middleware/auth");

router.route("/process/:domain").post(processPayment);
router.route("/paymentsuccess").post(paymentSuccess);

router.route("/paymenttrial/:domain").post(paymentTrial);
router.route("/updatetrialuser/:id").put(updateUser);
router.route("/consumeCredits/:id").put(consumeCredits);

router
  .route("/subscriptioncancelation")
  .get(isAuthenticatedUser, subscriptionCancelation);

module.exports = router;
