const { GCS_URL } = require("./constants");
const { Storage } = require("@google-cloud/storage");
const path = require("path");
const filePath = path.join(__dirname, "../middleware/gcp-bucket-file.json");
const storage = new Storage({
  keyFilename: filePath,
  projectId: "lucid-box-387617",
});
const bucket = storage.bucket("proptexx-store-images");

exports.uploadImageToGCP = async (file) => {
    return new Promise((resolve, reject) => {
        const blob = bucket.file(
            `${Date.now()}_${file.fileName?.replace(/[\(\)\s]/g, "")}`
        );
        const blobStream = blob.createWriteStream();

        blobStream.on("error", (err) => {
            console.log('blob error')
            reject(err);
        });

        blobStream.on("finish", async () => {
            const uploadedFileURL = `${GCS_URL}/${blob.name}`;
            resolve(uploadedFileURL);
        });

        blobStream.end(file.buffer);
    });
};

