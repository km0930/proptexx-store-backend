const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  imageProcessing,
  virtualStaging,
  downloadImage,
  dummyImagePreview,
  dummyResult,
  uploadImage,
  photoEnhancement,
  roomType,
  objectRemoval,
  textGeneration,
  descriptionGeneration,
  uploadJsFile,
  smartDetection,
  complianceDetection,
  roomObjectDetection,
  roomTypeDetection,
  detectArchitecture,
  decluttering,
  modelsRunningByDate,
  virtualRenovation,
  virtualRefurnishing,
} = require("../controllers/modelsController");
const { isAuthenticatedUser } = require("../middleware/auth");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 10MB
});

router.route("/virtualRenovation").post(isAuthenticatedUser, virtualRenovation);

router.route("/virtualStaging").post(virtualStaging);

router.route("/virtualRefurnishing").post(virtualRefurnishing);

router.route("/decluttering").post(isAuthenticatedUser, decluttering);

router.route("/photoenhancement").post(photoEnhancement);

router.route("/objectremoval").post(isAuthenticatedUser, objectRemoval);

router.route("/downloadimage").get(isAuthenticatedUser, downloadImage);

router.route("/textgeneration").post(isAuthenticatedUser, textGeneration);

router
  .route("/descriptiongeneration")
  .post(isAuthenticatedUser, descriptionGeneration);

router.route("/roomtype").post(isAuthenticatedUser, roomType);

router.route("/dummypmagepreview").post(dummyImagePreview);

router.route("/dummyresult").post(dummyResult);
router
  .route("/uploadimage")
  .post(upload.fields([{ name: "image" }]), uploadImage);
router.route("/uploadjsfile/:version").get(uploadJsFile);

router.route("/smartdetection").post(isAuthenticatedUser, smartDetection);
router
  .route("/roomobjectdetection")
  .post(isAuthenticatedUser, roomObjectDetection);
router.route("/roomtypedetection").post(roomTypeDetection);
router
  .route("/detectarchitecture")
  .post(isAuthenticatedUser, detectArchitecture);

router
  .route("/compliancedetection")
  .post(isAuthenticatedUser, complianceDetection);

router.route("/modelsrunningbyDate").post(modelsRunningByDate);

module.exports = router;
