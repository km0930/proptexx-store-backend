const jimp = require("jimp");
const axios = require("axios");
const { Storage } = require("@google-cloud/storage");
const path = require("path");
const { GCS_URL } = require("./constants");
const filePath = path.join(__dirname, "../middleware/gcp-bucket-file.json");
const storage = new Storage({
  keyFilename: filePath,
  projectId: "lucid-box-387617",
});

async function applyWatermark(baseImageUrl, watermarkImageUrl, isDoorInsider) {
  try {
    const baseImageResponse = await axios.get(baseImageUrl, {
      responseType: "arraybuffer",
    });

    const watermarkImageResponse = await axios.get(watermarkImageUrl, {
      responseType: "arraybuffer",
    });

    const baseImage = await jimp.read(baseImageResponse.data);
    const watermarkImage = await jimp.read(watermarkImageResponse.data);

    const watermarkWidth = isDoorInsider ? baseImage.getWidth() : 150; // Adjust the watermark width to your preference
    const watermarkHeight =
      watermarkImage.bitmap.height *
      (watermarkWidth / watermarkImage.bitmap.width);
    watermarkImage.resize(watermarkWidth, watermarkHeight);

    const baseImageWidth = baseImage.getWidth();
    const baseImageHeight = baseImage.getHeight();

    // Place the watermark at the bottom right corner
    const x = baseImageWidth - watermarkWidth;
    const y = baseImageHeight - watermarkHeight;

    baseImage.composite(watermarkImage, x, y, {
      mode: jimp.BLEND_SOURCE_OVER,
      opacitySource: 1,
      opacityDest: 1,
    });

    // Save the modified image
    const buffer = await baseImage.getBufferAsync(jimp.MIME_JPEG);

    const outputFilePath = `generated_images/${Date.now()}_image.jpg`;
    const file = storage.bucket("proptexx-store-images").file(outputFilePath);
    await file.save(buffer, {
      metadata: { contentType: "image/jpeg" },
    });
    // await baseImage.writeAsync(outputFilePath);

    console.log("Watermark applied successfully.");
    return `${GCS_URL}/${outputFilePath}`;
  } catch (error) {
    console.error("Error applying watermark:", error);
  }
}

module.exports = applyWatermark;
