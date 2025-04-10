const { Schema, model } = require("mongoose");

const scrapedImagesSchema = new Schema({
  successImages: [
    {
      image_url: {
        type: String,
      },
      image_content: {
        type: String,
      },
      ActiveModels: {
        type: Array,
      },
    },
  ],
  unSuccessImages: [
    {
      image_url: {
        type: String,
      },
      image_content: {
        type: String,
      },
    },
  ],
  emptyImages: [
    {
      image_url: {
        type: String,
      },
      image_content: {
        type: String,
      },
    },
  ],

  domain_url: {
    type: String,
    required: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = model("scrapedImages", scrapedImagesSchema);
