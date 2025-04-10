const express = require("express");
const router = express.Router();
const { isAuthenticatedUser } = require("../middleware/auth");
const { createDocs,getAllDocs,getDocById ,updateDoc,deleteDoc} = require("../controllers/docsController");

router.route("/createdocs").post( isAuthenticatedUser,createDocs);
router.route("/documents").get( getAllDocs);
router.route("/docs/:id").get( getDocById);
router.route("/docs/:id").put( isAuthenticatedUser,updateDoc);
router.route("/docs/:id").delete( isAuthenticatedUser,deleteDoc);

module.exports = router;
