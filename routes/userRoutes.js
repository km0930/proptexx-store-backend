const express = require("express");
const {
  register,
  accountverification,
  login,
  logout,
  resetPassword,
  forgotPassword,
  updateUser,
  updateCredits,
  findAllUsers,
  userUsage,
  singleUserUsage,
  getSingleUser,
  testingApi,
  heartbeat,
  findNewUsersInTimeframe,
  getApiTrialUsers,
} = require("../controllers/userController");
const router = express.Router();
const { isAuthenticatedUser } = require("../middleware/auth");

router.route("/register").post(register);
router.route("/accountverification/:token").put(accountverification);
router.route("/login").post(login);
router.route("/logout").post(logout);
router.route("/forgetpassword").post(forgotPassword);
router.route("/resetpassword/:token").put(resetPassword);
router.route("/updateuser").put(isAuthenticatedUser, updateUser);
router.route("/getsingleuser").get(isAuthenticatedUser, getSingleUser);
router.route("/findallusers").get(isAuthenticatedUser, findAllUsers);
router.route("/findnewusers").get(isAuthenticatedUser, findNewUsersInTimeframe);
router.route("/userusage/:id").post(isAuthenticatedUser, userUsage);
router.route("/singleuserusage").get(isAuthenticatedUser, singleUserUsage);
router.route("/updatecredits").get(isAuthenticatedUser, updateCredits);
router.route("/getapitrialusers").get(getApiTrialUsers);

router.route("/heartbeat").post(heartbeat);

router.route("/testapi").get(testingApi);

module.exports = router;
