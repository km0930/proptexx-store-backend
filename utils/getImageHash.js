const crypto = require("crypto");
const axios = require("axios");

exports.getImageHash = async (imageUrl) => {
  try {
    // Fetch the image data
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const imageData = Buffer.from(response.data, "binary");

    // Create a hash using SHA-256
    const hash = crypto.createHash("sha256").update(imageData).digest("hex");

    return hash;
  } catch (error) {
    // Handle errors, e.g., if the image URL is invalid or if there's an issue with fetching the image
    console.error("Error:", error.message);
    return null;
  }
};
