const fs = require("fs");
const axios = require("axios");
const path = require("path");

async function downloadImage(imageUrl, downloadFolderPath) {
  try {
    if (!fs.existsSync(downloadFolderPath)) {
      fs.mkdirSync(downloadFolderPath, { recursive: true });
    }

    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });
    const fileName = path.basename(new URL(imageUrl).pathname);
    const outputPath = path.join(downloadFolderPath, fileName);
    fs.writeFileSync(outputPath, response.data);
    return outputPath.toString();
  } catch (error) {
    console.error("Error downloading the image:", error.message);
  }
}
module.exports = downloadImage;
