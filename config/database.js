const mongoose = require("mongoose");

const connectDatabase = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI
    );
    console.log(`MongoDB Connected ${conn.connection.host}`);
  } catch (error) {
    console.log(`Error : ${error.message}`.bgRed);
    process.exit(1);
  }
};

//export
module.exports = connectDatabase;
