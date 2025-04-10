const PLANS = {
  FREE: "free",
  PRO: "pro",
  PREMIUM: "premium",
  POWER_USER: "power_user",
  BASIC: "basic",
};

const ACTIVE_THRESHOLD = 2592000000;

const USER_DEACTIVATION_CRON_FREQUENCY = "*/30 * * * *"; // every 15 minutes

const GCS_URL = `https://storage.googleapis.com/proptexx-store-images`;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Create an array from 0 to 10 and shuffle it
const uniqueNumbers = shuffle(Array.from({ length: 11 }, (_, index) => index));

module.exports = {
  PLANS,
  ACTIVE_THRESHOLD,
  USER_DEACTIVATION_CRON_FREQUENCY,
  GCS_URL,
  uniqueNumbers,
};
