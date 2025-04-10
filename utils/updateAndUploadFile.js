const path = require("path");
const axios = require("axios");
const { Storage } = require("@google-cloud/storage");
const filePath = path.join(__dirname, "../middleware/gcp-bucket-file.json");
const storage = new Storage({
  keyFilename: filePath,
  projectId: "lucid-box-387617",
});
const widgetBucket = storage.bucket("proptexx-store-widget");

exports.updateAndUploadFile = async (getWidget, version) => {
  // local file path
  const fileName = path.basename(getWidget.jsfile);
  try {
    const file = await widgetBucket.file(fileName);

    // Sets the cache-control metadata
    const metadata = {
      cacheControl: "no-cache",
    };

    // Updates the file's metadata
    await file.setMetadata(metadata);

    // Generate a signed URL for the file
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 15 * 60 * 1000, // URL will expire in 15 minutes
    });

    // Fetch the file content using the signed URL
    const response = await axios.get(signedUrl);
    let fileContent = response.data;

    const jsUrlRegex = /script\.src = '([^']+)';/;
    const cssUrlRegex = /link\.href = '([^']+)';/;
    const widgetId = /rootDiv\.id = "([^']+)";/;
    const jsMatch = fileContent.match(jsUrlRegex);
    const cssMatch = fileContent.match(cssUrlRegex);
    if (jsMatch && cssMatch) {
      const oldUrlJs = jsMatch[1];
      const oldUrlCss = cssMatch[1];
      const fileType = oldUrlJs.includes("main")
        ? process.env.NODE_ENV === "development"
          ? "main1"
          : "main"
        : process.env.NODE_ENV === "development"
        ? "guest1"
        : "guest";
      const [newFileType, newVersion] = version.split(" ");
      const jsUrl = oldUrlJs.replace(
        new RegExp(fileType + "_v\\d+(\\.\\d+)*\\.js"),
        `${newFileType}_${newVersion}.js`
      );
      const cssUrl = oldUrlCss.replace(
        new RegExp(fileType + "_v\\d+(\\.\\d+)*\\.css"),
        `${newFileType}_${newVersion}.css`
      );

      fileContent = fileContent
        ?.replace(jsUrlRegex, `script.src = '${jsUrl}';`)
        ?.replace(cssUrlRegex, `link.href = '${cssUrl}';`)
        ?.replace(widgetId, `rootDiv.id = 'widget-property-root';`);

      // Upload the updated content back to Google Cloud Storage
      await widgetBucket.file(fileName).save(fileContent, {
        contentType: "application/javascript", // Adjust the content type if needed
      });

      console.log("File updated and uploaded successfully.");
    }
  } catch (error) {
    console.error("Error:", error);
  }
};
