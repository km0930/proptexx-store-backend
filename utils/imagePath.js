exports.imagePath = (path) => {
  if (Array.isArray(path)) {
    return path.map((p) => `${process.env.BACKEND_URL}${p}`);
  } else {
    return `${process.env.BACKEND_URL}${path}`;
  }
};
