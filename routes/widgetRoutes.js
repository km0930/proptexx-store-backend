const express = require("express");
const {
  createWidgetDomain,
  getAllWidgetDomains,
  deleteWidgetDomain,
  updateWidgetDomain,
  authWidgetDomain,
  phoneVerification,
  userRegistration,
  updateusername,
  userLogin,
  getAllWidgetUsers,
  getAllWidgetUserActions,
  userLogout,
  heartbeat,
  widgetAdminRegistration,
  adminUsers,
  findNewExtUsersInTimeframe,
  getWidgetVersions,
  getAllWidgetUsersWithoutPagination,
  updateUser,
  getWidgetUsers,
  widgetPosition,
  getScrapedImages,
  getScrapedImagesDoorinsider,
  crawlUrls,
  widgetLogo,
  usageByUser,
  isDoorinsiderAdmin,
  modelsRunningByDate,
  usageByModel,
} = require("../controllers/widgetController");

const { isAuthenticatedUser } = require("../middleware/auth");
const {
  createAndUpdateFeedback,
  deleteFeedback,
} = require("../controllers/feedbackController");
const router = express.Router();

router.route("/createwidgetdomain").post(createWidgetDomain);
router.route("/getallwidgets").get(getAllWidgetDomains);
router.route("/getwidgetversions").get(getWidgetVersions);
router.route("/updatewidget/:id").put(updateWidgetDomain);
router.route("/deletewidget/:id").post(deleteWidgetDomain);
router.route("/authwidgetdomain").post(authWidgetDomain);
router.route("/userregister").post(userRegistration);
router.route("/phoneverification").post(phoneVerification);
router.route("/updateusername").put(updateusername);
router.route("/widgetuserlogin").post(userLogin);
router.route("/widgetuserlogout").post(userLogout);
router.route("/allWidgetUsers").get(isAuthenticatedUser, getAllWidgetUsers);
router.route("/widgetUsers").get(isAuthenticatedUser, getWidgetUsers);
router.route("/crawlUrls").get(crawlUrls);
router
  .route("/getAllWidgetUsersWithoutPagination")
  .get(isAuthenticatedUser, getAllWidgetUsersWithoutPagination);

router
  .route("/findnewextusers")
  .get(isAuthenticatedUser, findNewExtUsersInTimeframe);
router.route("/widgetUserActions/:id").get(getAllWidgetUserActions);
router.route("/heartbeat").post(heartbeat);
router.route("/adminregister").post(widgetAdminRegistration);
router.route("/adminusers").get(isAuthenticatedUser, adminUsers);
router.route("/widgetposition").put(isAuthenticatedUser, widgetPosition);
router.route("/widgetlogo").put(isAuthenticatedUser, widgetLogo);
router.route("/updateuser").put(updateUser);

// feedback apis
router
  .route("/feedback/:userLinkId")
  .delete(deleteFeedback)
  .post(createAndUpdateFeedback);
router.post("/getScrapedimages", getScrapedImages);

router.post("/getScrapedimagesV2", getScrapedImagesDoorinsider);
router.route("/usageByUser").get(isAuthenticatedUser, usageByUser);

router
  .route("/isDoorinsiderAdmin")
  .get(isAuthenticatedUser, isDoorinsiderAdmin);

router
  .route("/modelsRunningByDate")
  .get(isAuthenticatedUser, modelsRunningByDate);

router.route("/usagebymodel").get(usageByModel);

module.exports = router;
