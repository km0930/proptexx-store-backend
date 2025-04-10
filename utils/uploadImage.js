const multer = require("multer");
exports.imageupload = (pathname) => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, pathname);
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + file.originalname);
    },
  });

  return multer({ storage });
};

exports.extractDomain = (url) => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname || parsedUrl.href;
  } catch (error) {
    return url;
  }
};
