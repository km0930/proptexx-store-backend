const fs = require("fs");
const axios = require("axios");
const sharp = require("sharp");

// image width height
const getImageDimensions = (imageUrl) => {
  const outputPath = "output.png";
  return new Promise((resolve, reject) => {
    let imageWidth, imageHeight;

    axios({
      method: "get",
      url: imageUrl,
      responseType: "stream",
    })
      .then((response) => {
        const outputStream = fs.createWriteStream(outputPath);
        response.data.pipe(outputStream);

        outputStream.on("finish", () => {
          sharp(outputPath)
            .metadata()
            .then((metadata) => {
              imageWidth = metadata.width;
              imageHeight = metadata.height;
              resolve({ width: imageWidth, height: imageHeight });
            })
            .catch((error) => {
              console.error("Error:", error);
              reject(error);
            });
        });
      })
      .catch((error) => {
        console.error("Error:", error);
        reject(error);
      });
  });
};
module.exports = getImageDimensions;
