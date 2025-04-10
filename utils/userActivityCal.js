const { ACTIVE_THRESHOLD } = require("./constants");

const isActive = function (lastActive) {
  const activeUntil = new Date(lastActive).getTime() + ACTIVE_THRESHOLD;
  return Date.now() < activeUntil;
};

module.exports = {
  isActive
};