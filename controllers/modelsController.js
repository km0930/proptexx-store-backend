const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const axios = require("axios");
const Promise = require("bluebird");
const {
  creditusageModel,
  userlinksModel,
  userModel,
  UserCreditsModel,
} = require("../models");
const querystring = require("querystring");
const applyWatermark = require("../utils/watermarkImage");
const { imagePath } = require("../utils/imagePath");
const path = require("path");
const { dummyImages } = require("../utils/dummyImages");
const { Storage } = require("@google-cloud/storage");
const getImageDimensions = require("../utils/getImageDimentions");
const { GCS_URL, uniqueNumbers } = require("../utils/constants");
const WidgetUser = require("../models/WidgetUser");

const filePath = path.join(__dirname, "../middleware/gcp-bucket-file.json");
const storage = new Storage({
  keyFilename: filePath,
  projectId: "lucid-box-387617",
});
const bucket = storage.bucket("proptexx-store-images");
const widgetBucket = storage.bucket("proptexx-store-widget");

const getAccessToken = async () => {
  try {
    const response = await axios.post(`${process.env.API_GET_ACCESSTOKEN}`,
      {
        scopes: {}
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Apikey NmJjYWIzYTktYWZhMy00ZDdhLWIwNjQtYzAzZjFiOGVkOWNlfDAxMDc1ZDA5LTJiODgtNGYzNS1iZTE2LTg1ZjdjODYxNmI2MQ',
        }
      });

    if (response.status !== 200) {
      throw new Error('Failed to authenticate');
    }

    const data = response.data;
    return data?.$accessToken;
  } catch (error) {
    console.error('Error fetching access token:', error.message);
    return null;
  }
};

exports.imageProcessing = catchAsyncErrors(async (req, res) => {
  const {
    image_url,
    room_type,
    room_object,
    return_mask,
    material_type,
    modelName,
    mask_url,
    isWidget,
  } = req.body;
  let userLink, finalImage, mask, response, watermarkImage;
  const Authorization = isWidget
    ? [process.env?.WIDGET_USER_ID, true]
    : [req.user.user._id, true];
  const API_URL =
    modelName == "virtual renovation"
      ? process.env.API_AI_VIRTUAL_RENOVATION
      : process.env.API_AI_VIRTUAL_REFURNISHING;
  if (return_mask) {
    response = await axios.post(
      API_URL,
      {
        instances: [
          {
            image_url,
            mode: "renovation",
            room_type,
            return_mask,
          },
        ],
      },
      {
        headers: {
          Authorization,
          "Content-Type": "application/json",
        },
      }
    );
    mask = response?.data?.result;
  } else {
    if (material_type) {
      response = await axios.post(
        API_URL,
        {
          instances: [
            {
              image_url,
              room_type,
              return_mask: false,
              mode: "renovation",
              room_object,
              upscale: true,
              material_type,
              mask_url,
              // override_prompt,
            },
          ],
        },
        {
          headers: {
            Authorization,
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      response = await axios.post(
        API_URL,
        {
          instances: [
            {
              image_url,
              room_type,
              return_mask: false,
              upscale: true,
              mode: "renovation",
              room_object,
              mask_url,
              // override_prompt,
            },
          ],
        },
        {
          headers: {
            Authorization,
            "Content-Type": "application/json",
          },
        }
      );
    }
  }
  if (!return_mask && mask_url) {
    finalImage = response?.data?.result;

    watermarkImage = await applyWatermark(
      finalImage,
      imagePath(`watermark_image/proptexx.png`)
    );
    // create credit usages
    const creditUsage = await creditusageModel.create({
      userId: req.user.user._id,
      productCode: modelName,
      apiUrl: process.env.API_AI_VIRTUAL_RENOVATION,
      inputJson: image_url,
      fileSource: image_url,
      status: "processing",
    });
    userLink = await userlinksModel.create({
      userId: req.user.user._id,
      ref: creditUsage?._id,
      Appname: modelName,
      optJson: {
        image: image_url,
        apiFields: {
          imageUrl: image_url,
          maskUrl: mask_url,
          room_object,
          material_type,
          refine: true,
        },
        model: modelName,
        perview: watermarkImage,
      },
      response: finalImage,
    });
  }
  res.status(200).json({
    success: true,
    link: userLink?._id || "",
    image: return_mask ? mask : "",
    preview: !return_mask ? watermarkImage : "",
    detected_objects: return_mask ? response?.data?.detected_objects : null,
  });
});

exports.virtualRenovation = catchAsyncErrors(async (req, res, next) => {
  try {
    const {
      image_url,
      room_type,
      room_object,
      return_mask,
      material_type,
      modelName,
      mask_url,
      isWidget,
      isDoorInsider,
    } = req.body;

    const requiredFields = ["image_url"];
    if (isWidget) {
      requiredFields.push("app_URL");
    }

    // Check if all required fields are present
    const missingFields = requiredFields.filter(
      (field) => !req.body.hasOwnProperty(field)
    );
    if (missingFields.length > 0) {
      // If any required field is missing, send an error response
      return res.status(400).json({
        error: `Missing required field(s): ${missingFields.join(", ")}`,
      });
    }

    // api
    const API_URL = process.env.API_AI_VIRTUAL_RENOVATION;
    const api_key = isWidget ? process.env.WIDGET_USER_ID : req.user.user._id;
    let response, mask, userLink, creditUsage, watermarkedImage;

    if (return_mask) {
      const requestBody = {
        room_type: room_type,
        return_mask,
      };
      const queryParams = {
        input_image_url: image_url,
        api_key: api_key,
      };
      const fullUrl = `${API_URL}?${querystring.stringify(queryParams)}`;
      response = await axios.post(fullUrl, requestBody, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
      if (response) {
        mask = response?.data[0];
      }
    } else {
      const requestBody = {
        room_type: room_type,
        room_object,
      };
      const queryParams = {
        input_image_url: image_url,
        api_key: api_key,
      };
      const fullUrl = `${API_URL}?${querystring.stringify(queryParams)}`;

      response = await axios.post(fullUrl, requestBody, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
      if (response) {
        const finalImage = response?.data;
        watermarkedImage = await applyWatermark(
          finalImage,
          imagePath(
            isDoorInsider
              ? "watermark_image/doorinsider.png"
              : "watermark_image/proptexx.png"
          ),
          isDoorInsider
        );

        // create credit usages
        creditUsage = await creditusageModel.create({
          userId: req.user.user._id,
          productCode: modelName,
          apiUrl: process.env.API_AI_VIRTUAL_RENOVATION,
          inputJson: image_url,
          fileSource: image_url,
          status: "processing",
        });
        userLink = await userlinksModel.create({
          userId: req.user.user._id,
          ref: creditUsage?._id,
          Appname: modelName,
          optJson: {
            image: image_url,
            apiFields: {
              imageUrl: image_url,
              maskUrl: mask_url,
              room_object,
              material_type,
              refine: true,
            },
            model: modelName,
            perview: watermarkedImage,
          },
          response: finalImage,
        });
      }
    }

    res.status(200).json({
      success: true,
      link: userLink?._id || "",
      image: return_mask ? mask : "",
      preview: !return_mask ? watermarkedImage : "",
      detected_objects: return_mask ? response?.data[1] : null,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// virtual refurnishing
exports.virtualRefurnishing = (async (req, res, next) => {
  try {
    const {
      image_url,
      room_type,
      architecture_style,
      do_preprocess,
      isWidget,
      app_URL
    } = req.body;

    const requiredFields = ["image_url"];
    if (isWidget) {
      requiredFields.push("app_URL");
    }

    // Check if all required fields are present
    const missingFields = requiredFields.filter(
      (field) => !req.body.hasOwnProperty(field)
    );
    if (missingFields.length > 0) {
      // If any required field is missing, send an error response
      return res.status(400).json({
        error: `Missing required field(s): ${missingFields.join(", ")}`,
      });
    }

    let accessToken = await getAccessToken();
    if (!accessToken) {
      return res.status(400).json({
        error: 'Failed to retrieve access token',
      });
    }
    const API_URL = process.env.API_AI_VIRTUAL_REFURNISHING;

    // api
    // const api_key = isWidget ? process.env.WIDGET_USER_ID : req.user.user._id;
    let response, mask, userLink, creditUsage, watermarkedImage;

    if (do_preprocess) {
      const requestBody = {
        imageUrl: image_url,
        room_type: room_type,
        architecture_style: architecture_style,
      };
      // const queryParams = {
      //   input_image_url: image_url,
      //   api_key: api_key,
      // };
      response = await axios.post(API_URL, requestBody, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
      });
      if (response) {
        return res.status(200).json({
          success: true,
          message: response.data,
        });
      }
    } else {
      const requestBody = {
        room_type: room_type,
        room_object,
      };
      const queryParams = {
        input_image_url: image_url,
        api_key: api_key,
      };
      const fullUrl = `${API_URL}?${querystring.stringify(queryParams)}`;

      response = await axios.post(fullUrl, requestBody, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
      if (response) {
        const finalImage = response?.data;
        watermarkedImage = await applyWatermark(
          finalImage,
          imagePath(
            isDoorInsider
              ? "watermark_image/doorinsider.png"
              : "watermark_image/proptexx.png"
          ),
          isDoorInsider
        );

        // create credit usages
        creditUsage = await creditusageModel.create({
          userId: req.user.user._id,
          productCode: modelName,
          apiUrl: process.env.API_AI_VIRTUAL_RENOVATION,
          inputJson: image_url,
          fileSource: image_url,
          status: "processing",
        });
        console.log('credit usage', creditUsage);
        userLink = await userlinksModel.create({
          userId: req.user.user._id,
          ref: creditUsage?._id,
          Appname: modelName,
          optJson: {
            image: image_url,
            apiFields: {
              imageUrl: image_url,
              maskUrl: mask_url,
              room_object,
              material_type,
              refine: true,
            },
            model: modelName,
            perview: watermarkedImage,
          },
          response: finalImage,
        });
      }
    }

    res.status(200).json({
      success: true,
      link: userLink?._id || "",
      image: return_mask ? mask : "",
      preview: !return_mask ? watermarkedImage : "",
      detected_objects: return_mask ? response?.data[1] : null,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// virtual staging ..
exports.virtualStaging = (async (req, res, next) => {
  const {
    imageUrl,
    room_type,
    isWidget,
    app_URL,
    architecture_style,
    do_preprocess,
  } = req.body;
  const requiredFields = ["imageUrl"];
  if (isWidget) {
    requiredFields.push("app_URL");
  }

  // Check if all required fields are present
  const missingFields = requiredFields.filter(
    (field) => !req.body.hasOwnProperty(field)
  );

  if (missingFields.length > 0) {
    // If any required field is missing, send an error response
    return res.status(400).json({
      error: `Missing required field(s): ${missingFields.join(", ")}`,
    });
  }

  // api
  let accessToken = await getAccessToken();
  if (!accessToken) {
    return res.status(400).json({
      error: 'Failed to retrieve access token',
    });
  }
  const API_URL = process.env.API_AI_VIRTUAL_STAGING;
  // const api_key = isWidget ? process.env.WIDGET_USER_ID : req.user.user._id;

  if (do_preprocess) {
    try {
      const requestBody = {
        imageUrl: imageUrl,
        room_type: room_type,
        architecture_style: architecture_style,
      };
      // const queryParams = {
      //   input_imageUrl: imageUrl,
      //   do_preprocess: true,
      //   bypass_checks: true,
      //   api_key: api_key,
      // };
      const response = await axios.post(API_URL, requestBody, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
      });
      if (response) {
        return res.status(200).json({
          success: true,
          message: response.data,
        });
      }
    } catch (err) {
      console.log(
        err.response?.data,
        "response?.data?.error",
        req.user.user._id
      );
      return res.status(400).json({
        success: false,
        message: err.response?.data,
      });
    }
  } else {
    async function sendRequest(seed) {
      let response;
      try {
        const requestBody = {
          room_type: room_type,
          architecture_style: architecture_style,
          seed,
        };
        const queryParams = {
          input_imageUrl: imageUrl,
          api_key: api_key,
          bypass_checks: true,
        };
        const fullUrl = `${API_URL}?${querystring.stringify(queryParams)}`;

        response = await axios.post(fullUrl, requestBody, {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });

        const finalImage = response?.data;
        const watermarkedImage = await applyWatermark(
          finalImage,
          imagePath(
            isDoorInsider
              ? "watermark_image/doorinsider.png"
              : "watermark_image/proptexx.png"
          ),
          isDoorInsider
        );

        return { finalImage, watermarkedImage };
      } catch (err) {
        console.log(err, "ml error");
      }
    }

    try {
      const promises = uniqueNumbers
        .slice(0, 4)
        .map((number) => sendRequest(number));
      // const promises = Array.from({ length: 4 }, () => sendRequest(API_URL));

      const responses = await Promise.all(promises);

      const finalImages = responses.flatMap((response) => response.finalImage);
      const finalWaterMarkImages = responses.flatMap(
        (response) => response.watermarkedImage
      );

      // create credit usages
      const creditUsage = await creditusageModel.create({
        userId: req.user.user._id,
        productCode: modelName,
        apiUrl: process.env.API_AI_VIRTUAL_STAGING,
        inputJson: imageUrl,
        fileSource: imageUrl,
        status: "processing",
      });
      console.log('credit usage', creditUsage);
      const userLink = await userlinksModel.create({
        userId: req.user.user._id,
        ref: creditUsage?._id,
        Appname: modelName,
        optJson: {
          image: imageUrl,
          apiFields: {
            imageUrl: imageUrl,
            room_type,
            refine: true,
            ...(app_URL && { app_URL }),
          },
          model: modelName,
          perview: finalWaterMarkImages || "",
        },
        response: finalImages,
      });

      res.status(200).json({
        success: true,
        link: userLink?._id || "",
        preview: finalWaterMarkImages || "",
      });
    } catch (err) {
      console.log(err);
      res.status(400).json({
        success: false,
        message: "something wrong",
      });
    }
  }
});

// decluttering
exports.decluttering = catchAsyncErrors(async (req, res, next) => {
  const {
    image_url,
    room_type,
    architecture_style,
    isWidget,
    isDoorInsider,
    modelName,
    app_URL,
  } = req.body;

  const requiredFields = [
    "image_url",
    "room_type",
    "architecture_style",
    "modelName",
  ];
  if (isWidget) {
    requiredFields.push("app_URL");
  }
  // Check if all required fields are present
  const missingFields = requiredFields.filter(
    (field) => !req.body.hasOwnProperty(field)
  );

  if (missingFields.length > 0) {
    // If any required field is missing, send an error response
    return res.status(400).json({
      error: `Missing required field(s): ${missingFields.join(", ")}`,
    });
  }
  // auth
  const api_key = isWidget ? process.env.WIDGET_USER_ID : req.user.user._id;

  // api
  const API_URL = process.env.API_AI_CLUTTERING_STAGING;

  async function sendRequest(seed) {
    let response;

    try {
      const requestBody = {
        room_type: room_type,
        architecture_style: architecture_style,
        seed,
      };
      const queryParams = {
        input_image_url: image_url,
        api_key,
        bypass_checks: true,
      };
      const fullUrl = `${API_URL}?${querystring.stringify(queryParams)}`;

      response = await axios.post(fullUrl, requestBody, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      const finalImage = response?.data;
      const watermarkedImage = await applyWatermark(
        finalImage,
        imagePath(
          isDoorInsider
            ? "watermark_image/doorinsider.png"
            : "watermark_image/proptexx.png"
        ),
        isDoorInsider
      );

      return { finalImage, watermarkedImage };
    } catch (err) {
      console.log(err, "ml error");
    }
  }

  try {
    // Send requests using the first four unique numbers
    const promises = uniqueNumbers
      .slice(0, 4)
      .map((number) => sendRequest(number));
    // const promises = Array.from({ length: 4 }, () => sendRequest(API_URL));

    const responses = await Promise.all(promises);

    const finalImages = responses.flatMap((response) => response.finalImage);
    const finalWaterMarkImages = responses.flatMap(
      (response) => response.watermarkedImage
    );

    // const [
    //   {
    //     finalImages: finalImagesArray1,
    //     watermarkedImages: watermarkImagesArray1,
    //   },
    //   {
    //     finalImages: finalImagesArray2,
    //     watermarkedImages: watermarkImagesArray2,
    //   },
    // ] = await Promise.all([sendRequest(API_URL), sendRequest(API_URL)]);

    // const finalImages = finalImagesArray1.concat(finalImagesArray2);
    // const finalWaterMarkImages = watermarkImagesArray1.concat(
    //   watermarkImagesArray2
    // );

    // create credit usages ..
    const creditUsage = await creditusageModel.create({
      userId: req.user.user._id,
      productCode: modelName,
      apiUrl: API_URL,
      inputJson: image_url,
      fileSource: image_url,
      status: "processing",
    });

    const userLink = await userlinksModel.create({
      userId: req.user.user._id,
      ref: creditUsage?._id,
      Appname: modelName,
      optJson: {
        image: image_url,
        apiFields: {
          imageUrl: image_url,
          room_type,
          architecture_style,
          refine: true,
          ...(app_URL && { app_URL }),
        },
        model: modelName,
        perview: finalWaterMarkImages || "",
      },
      response: finalImages || "",
    });

    res.status(200).json({
      success: true,
      link: userLink?._id || "",
      preview: finalWaterMarkImages || "",
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      success: false,
      message: "something wrong",
    });
  }
});

// photo enhancement
exports.photoEnhancement = (async (req, res, next) => {
  const { image_url, modelName } = req.body;
  const API_URL =
    modelName == "sky replacement"
      ? process.env.API_AI_SKY_REPLACEMENT
      : modelName == "grass repair"
        ? process.env.API_AI_GRASS_REPAIR
        : process.env.API_AI_PHOTO_ENHANCEMENT;

  // const api_key = req.user.user._id;

  let response;
  try {
    if (modelName) {
      const requestBody = {
        image_url: image_url,
      };

      let accessToken = await getAccessToken();
      if (!accessToken) {
        return res.status(400).json({
          error: 'Failed to retrieve access token',
        });
      }

      response = await axios.post(API_URL, requestBody, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
      });
      if (response) {
        return res.status(200).json({
          success: true,
          message: response.data,
        });
      }
    } else {
      response = await axios.post(
        API_URL,
        {
          instances:
            modelName == "sky"
              ? [{ image_url, sky_type: "cloudy" }]
              : [{ image_url }],
        },
        {
          headers: {
            Authorization: req.user.user._id,
            "Content-Type": "application/json",
          },
        }
      );
    }
    if (response?.data) {
      const finalImage =
        modelName == "grass" ? response?.data : response?.data?.result;

      const watermarkImage = await applyWatermark(
        finalImage,
        imagePath(`watermark_image/proptexx.png`)
      );
      const creditUsage = await creditusageModel.create({
        userId: req.user.user._id,
        productCode: modelName,
        apiUrl: API_URL,
        inputJson: API_URL,
        fileSource: image_url,
        status: "processing",
      });
      const userLink = await userlinksModel.create({
        userId: req.user.user._id,
        ref: creditUsage?._id,
        Appname: modelName,
        optJson: {
          image: image_url,
          apiFields: {
            imageUrl: image_url,
            refine: true,
          },
          model: modelName,
          perview: watermarkImage,
        },
        response: finalImage,
      });
      res.status(200).json({
        success: true,
        link: userLink._id,
        image: finalImage,
        preview: watermarkImage,
      });
    }
  } catch (err) {
    console.log(err);
    res.status(400).json({
      success: false,
      message: "model error",
    });
  }
});

// object removal
exports.objectRemoval = catchAsyncErrors(async (req, res) => {
  const { image_url, mask_url, ref } = req.body;
  const API_URL = process.env.API_AI_OBJECT_REMOVAL;
  const api_key = req.user.user._id;
  let userLinkDetail, finalImage, watermarkedImage;
  if (ref) {
    userLinkDetail = await userlinksModel.findOne({ _id: ref });
  }

  const requestBody = {
    mask_url: mask_url,
  };
  const queryParams = {
    input_image_url: ref ? userLinkDetail?.response[0] : image_url,
    api_key: api_key,
    bypass_checks: true,
  };
  const fullUrl = `${API_URL}?${querystring.stringify(queryParams)}`;

  const response = await axios.post(fullUrl, requestBody, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  if (response) {
    finalImage = response?.data;
    watermarkedImage = await applyWatermark(
      finalImage,
      imagePath("watermark_image/proptexx.png")
    );
  }

  // create credit usages
  const creditUsage = await creditusageModel.create({
    userId: req.user.user._id,
    productCode: "object removal",
    apiUrl: process.env.PI_AI_OBJECT_REMOVAL,
    inputJson: image_url,
    fileSource: image_url,
    status: "processing",
  });
  const userLink = await userlinksModel.create({
    userId: req.user.user._id,
    ref: creditUsage?._id,
    Appname: "object removal",
    optJson: {
      image: image_url,
      apiFields: {
        imageUrl: image_url,
        maskUrl: mask_url,
        refine: true,
      },
      model: "object removal",
      perview: watermarkedImage,
    },
    response: finalImage,
  });
  if (finalImage) {
    res.status(200).json({
      success: true,
      link: userLink?._id,
      finalImage,
      watermarkImage: watermarkedImage,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "something wrong",
    });
  }
});

// room type
exports.roomType = catchAsyncErrors(async (req, res, next) => {
  const { image_url } = req.body;
  const API_URL = process.env.API_AI_DETECT_ROOM_TYPE;
  const api_key = process.env.WIDGET_USER_ID;
  try {
    const queryParams = {
      input_image_url: image_url,
    };
    const fullUrl = `${API_URL}?${querystring.stringify(queryParams)}`;
    const response = await axios.post(
      fullUrl,
      {},
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": api_key,
        },
      }
    );
    if (response?.data && response?.data?.input_scenes[0] == "Indoor") {
      return res.status(200).json({
        success: true,
        room_type: response?.data?.input_room_types[0],
        message: "successful",
      });
    } else {
      return res.status(500).json({
        success: false,
        message: `${response?.data?.input_scenes[0]} image detected`,
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      success: false,
      message: err?.response.data?.error || "something wrong",
    });
  }
});

// text generation
exports.textGeneration = catchAsyncErrors(async (req, res, next) => {
  const { image_url } = req.body;
  const API_URL = process.env.API_AI_TEXT_GENERATION;
  const api_key = req.user.user._id;
  let response;

  try {
    const queryParams = {
      input_image_url: image_url,
      api_key: api_key,
    };
    const fullUrl = `${API_URL}?${querystring.stringify(queryParams)}`;

    response = await axios.post(
      fullUrl,
      {},
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    if (response?.data) {
      const userDetail = await userModel
        .findOne({ email: req.user.user.email })
        .populate("usercredit");
      if (!userDetail) {
        return res.status(400).json({
          success: false,
          message: "please login first",
        });
      }

      // if (userDetail.creditsPerMonth > 0) {
      //   userDetail.creditsPerMonth -= 1;
      //   await userDetail.save();

      //   return res.status(200).json({
      //     success: true,
      //     text: response.data?.result,
      //     user: userDetail,
      //     message: "successful",
      //   });
      // } else if (
      //   userDetail.planName == "free" &&
      //   userDetail.usercredit.altTextGeneratorCredit == 1
      // ) {
      // await UserCreditsModel.updateOne(
      //   { userId: userDetail._id },
      //   { $set: { altTextGeneratorCredit: 0 } }
      // );

      res.status(200).json({
        success: true,
        text: response.data?.result[0],
        user: userDetail,
        message: "successful",
      });
    }
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err,
    });
  }
});

// text generation
exports.descriptionGeneration = catchAsyncErrors(async (req, res, next) => {
  const {
    location,
    material,
    building_style,
    architecture,
    area,
    offer_type,
    objects,
  } = req.body;
  const response = await axios.post(
    process.env.API_AI_DESCRIPTION_GENERATION,
    {
      instances: [
        {
          property_details: {
            location,
            material,
            building_style,
            architecture,
            area,
            offer_type,
            objects,
          },
        },
      ],
    },
    {
      headers: {
        Authorization: [req.user.user._id, true],
        "Content-Type": "application/json",
      },
    }
  );
  if (response?.data) {
    const userDetail = await userModel
      .findOne({ email: req.user.user.email })
      .populate("usercredit");
    if (!userDetail) {
      return res.status(400).json({
        success: false,
        message: "please login first",
      });
    }

    if (userDetail.creditsPerMonth > 0) {
      userDetail.creditsPerMonth -= 1;
      await userDetail.save();

      return res.status(200).json({
        success: true,
        text: response.data?.body?.description?.replaceAll("\n", ""),
        user: userDetail,
        message: "successful",
      });
    } else if (
      userDetail.planName == "free" &&
      userDetail.usercredit.descriptionGeneratorCredit == 1
    ) {
      await UserCreditsModel.updateOne(
        { userId: userDetail._id },
        { $set: { descriptionGeneratorCredit: 0 } }
      );
      const UserDetail = await userModel
        .findOne({ email: req.user.user.email })
        .populate("usercredit");
      res.status(200).json({
        success: true,
        text: response.data?.body?.description?.replaceAll("\n", ""),
        user: UserDetail,
        message: "successful",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "No credit to generate text",
      });
    }
  } else {
    res.status(400).json({
      success: false,
      response: "model not getting result",
    });
  }
});

// download image
exports.downloadImage = catchAsyncErrors(async (req, res, next) => {
  const userDetail = await userModel
    .findOne({ email: req.user.user.email })
    .populate("usercredit");
  const userLinks = await userlinksModel.findOne({ _id: req.query.links });
  //const modelName = await userlinksModel.findOne({ _id: req.query.modelName });
  // const crditUsage = await creditusageModel.findOne({ _id: userLinks.ref });
  if (!userDetail) {
    res.status(400).json({
      success: false,
      message: "please login first",
    });
  }
  // if (userDetail.creditsPerMonth > 0 && userDetail.planName != "free") {
  //   userDetail.creditsPerMonth -= 1;
  //   await userDetail.save();

  //   if (crditUsage) {
  //     crditUsage.status = "active";
  //     await crditUsage.save();
  //   }
  //   res.status(200).json({
  //     success: true,
  //     image: userLinks.response,
  //   });
  // } else if (userDetail.usercredit[req.query.modelName] == 1) {
  //   await UserCreditsModel.updateOne(
  //     { userId: userDetail._id },
  //     {
  //       $set: { [req.query.modelName]: 0 },
  //     }
  //   );
  res.status(200).json({
    success: true,
    image: userLinks.response,
  });
  // } else {
  //   res.status(400).json({
  //     success: false,
  //     message: "no credits",
  //   });
  // }
});

// dummy result api
exports.dummyImagePreview = catchAsyncErrors(async (req, res, next) => {
  const watermarkImage = await applyWatermark(
    req.body.image_url,
    imagePath(`watermark_image/proptexx.png`)
  );
  if (watermarkImage) {
    // const userLink = await userlinksModel.create({
    //   userId: req.user.user._id,
    //   optJson: {
    //     image: req.body.image_url,
    //     perview: watermarkImage,
    //   },
    // });
    res.status(200).json({
      success: true,
      image: watermarkImage,
      // link: userLink._id,
    });
  } else {
    res.status(400).json({
      success: false,
      image: null,
    });
  }
});

exports.dummyResult = catchAsyncErrors(async (req, res, next) => {
  const dummy = dummyImages.find(
    (item) => item.image === req.body.selectedImage
  );
  setTimeout(() => {
    res.status(201).json({
      success: true,
      dummy,
    });
  }, 10000);
});

// upload image to gcp
exports.uploadImage = (async (req, res, next) => {
  const { isMultiImages } = req.body;
  const { modelName } = req.query;
  // const userDetail = await userModel
  //   .findOne({ email: req.user.user.email })
  //   .populate("usercredit");

  // if (!userDetail) {
  //   const widgetUser = await WidgetUser.findOne({ email: req.user.user.email });
  //   if (!widgetUser) {
  //     return res.status(400).json({
  //       success: false,
  //       message: "please login first",
  //     });
  //   }
  // }
  const files = req.files["image"];
  if (!files?.length) {
    return res.status(400).send("No file uploaded.");
  }
  const uploadedFiles = [];
  const uploadPromises = files.map(async (file) => {
    const blob = bucket.file(
      `${Date.now()}_${file.originalname?.replace(/[\(\)\s]/g, "")}`
    );
    const blobStream = blob.createWriteStream();

    return new Promise((resolve) => {
      blobStream.on("error", (err) => {
        uploadedFiles.push({
          image: null,
          success: false,
        });
        resolve();
      });

      blobStream.on("finish", async () => {
        uploadedFiles.push({
          fileurl: `${GCS_URL}/${blob.name}`,
          success: true,
        });
        resolve();
      });

      blobStream.end(file.buffer);
    });
  });
  await Promise.all(uploadPromises);

  if (req?.query?.modelName == "") {
    return res.status(200).json({
      fileurl: uploadedFiles,
      success: true,
    });
  }
  // let user;
  // if (
  //   userDetail.creditsPerMonth >= files.length &&
  //   userDetail.planName !== "free"
  // ) {
  //   /// userDetail.creditsPerMonth -= uploadedFiles.length;
  //   // await userDetail.save();
  // } else if (
  //   (userDetail.usercredit[req.query.modelName] === 1 ||
  //     userDetail.usercredit[req.query.modelName] === 2) &&
  //   modelName !== "imageTaggingCredit"
  // ) {
  //   await UserCreditsModel.updateOne(
  //     { userId: userDetail._id },

  //     {
  //       $set: {
  //         [req.query.modelName]: userDetail.usercredit[req.query.modelName] - 1,
  //       },
  //     }
  //   );
  //   user = await userModel
  //     .findOne({ email: userDetail.email })
  //     .populate("usercredit");
  // }
  // else {
  //   return res.status(400).json({
  //     success: false,
  //     message: "no credits",
  //   });
  // }

  res.status(200).json({
    fileurl: isMultiImages ? uploadedFiles : uploadedFiles[0]?.fileurl,
    success: true,
  });
});

// upload js file to gcp
exports.uploadJsFile = catchAsyncErrors(async (req, res, next) => {
  const { version } = req.params;
  const [fileType, VersionNumber] = version.split(" ");
  const date = new Date();
  const jsBlob = widgetBucket.file(`${fileType}_${date?.getTime()}.js`);
  const jsBlobStream = jsBlob.createWriteStream();

  jsBlobStream.on("error", (err) => {
    res.status(500).json({
      success: false,
      message: "Failed to create the JS file.",
    });
  });

  jsBlobStream.on("finish", () => {
    res.status(200).json({
      jsFileUrl: `https://storage.googleapis.com/proptexx-store-widget/${jsBlob.name}`,
      success: true,
    });
  });

  const jsContent = `
  window.REACT_VARS = {
    'clientUrl': 'https://storage.googleapis.com/proptexx-store-widget/${jsBlob.name}',
}
var rootDiv = document.createElement("div");
rootDiv.id = "widget-property-root";
document.body.appendChild(rootDiv);
var script = document.createElement('script');
script.type = 'text/javascript';
script.src = '${process.env.WIDGET_JS_FILE}/${fileType}_${VersionNumber}.js';
document.head.appendChild(script);

var link = document.createElement('link');
link.type = 'text/css';
link.rel = 'stylesheet';
link.href = '${process.env.WIDGET_JS_FILE}/${fileType}_${VersionNumber}.css';
var lastChild = document.head.lastChild;
document.head.insertBefore(link, lastChild.nextSibling);
`;
  jsBlobStream.end(jsContent);
});

// smart detection
exports.smartDetection = catchAsyncErrors(async (req, res, next) => {
  // API_AI_SMART_DETECTION
  const user = await userModel
    .findOne({ email: req.user.user.email })
    .populate("usercredit");
  const { image_url } = req.body;

  if (!user) {
    return res.status(400).json({
      success: false,
      message: "please login first",
    });
  }
  // else if (
  //   (!user.creditsPerMonth && user.planName != "free") ||
  //   (user.usercredit.imageTaggingCredit == 0 && user.planName == "free")
  // ) {
  //   return res.status(400).json({
  //     success: false,
  //     message: "No credit to generate",
  //   });
  // }
  const API_URL = process.env.API_AI_SMART_DETECTION;
  const api_key = req.user.user._id;
  const queryParams = {
    input_image_url: image_url,
    api_key: api_key,
  };
  const fullUrl = `${API_URL}?${querystring.stringify(queryParams)}`;

  try {
    const response = await axios.post(
      fullUrl,
      {},
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    if (response) {
      let boundryBoxes = [];
      let objects = [];

      //start

      // if (Object.keys(response?.data).includes("exterior_models")) {
      //   const res1 = response.data?.exterior_models;
      //   const keys = Object.keys(res1);
      //   keys.forEach((item) => {
      //     if (
      //       res1[item]?.classes &&
      //       res1[item]?.classes?.length > 0 &&
      //       item !== "time_taken"
      //     ) {
      //       objects.push({
      //         modelName: item,
      //         class: res1[item]?.classes[0],
      //         score: res1[item]?.scores[0],
      //       });
      //     }
      //   });
      // }
      // else if (Object.keys(response?.data).includes("floor_plan")) {
      //   const ploorPlan = response?.data?.floor_plan?.result;
      //   ploorPlan.forEach((item) => {
      //     objects.push({
      //       modelName: "floor_plan",
      //       class: item[0],
      //       score: item[1],
      //     });
      //   });
      // }
      //  else if (Object.keys(response?.data).includes("interior_models")) {
      //   const res1 = response.data?.interior_models;
      //   const keys = Object.keys(res1);
      //   keys?.forEach((item) => {
      //     if (item === "room_objects" || item == "rff") {
      //       for (let i = 0; i < res1[item].bboxes?.length; i++) {
      //         boundryBoxes.push({
      //           bbox: res1[item].bboxes[i],
      //           area:
      //             (res1[item].bboxes[i][2] - res1[item].bboxes[i][0]) *
      //             (res1[item].bboxes[i][3] - res1[item].bboxes[i][1]),
      //           result: item == "rff" ? res1[item].labels[i] : res1[item].result[i],
      //           score: res1[item].scores[i],
      //         });
      //       }
      //     } else if (item == "room_types") {
      //       for (let i = 0; i < res1[item].result?.length; i++) {
      //         objects.push({
      //           modelName: item,
      //           class: res1[item]?.result[i],
      //           score: res1[item]?.scores[i],
      //         });
      //       }
      //     }
      //   });
      //   const maxAreas = {};

      //   boundryBoxes.forEach((item) => {
      //     const result = item.result;
      //     const area = item.area;

      //     if (!maxAreas[result] || area > maxAreas[result]) {
      //       maxAreas[result] = area;
      //     }
      //   });

      //   // Filter objects based on the maximum area for each unique result name
      //   boundryBoxes = boundryBoxes.filter((item) => {
      //     const result = item.result;
      //     const area = item.area;

      //     return area === maxAreas[result];
      //   });
      // }
      //end

      if (response.data.scene_classification.result.includes("Indoor")) {
        const room_objects = response?.data?.room_objects_detection;
        for (let i = 0; i < room_objects.bboxes?.length; i++) {
          boundryBoxes.push({
            bbox: room_objects.bboxes[i],
            area:
              (room_objects.bboxes[i][2] - room_objects.bboxes[i][0]) *
              (room_objects.bboxes[i][3] - room_objects.bboxes[i][1]),
            result: room_objects.result[i],
            score: room_objects.score[i],
          });
        }

        const room_type = response?.data?.room_type_classification;
        for (let i = 0; i < room_type.result?.length; i++) {
          objects.push({
            modelName: "room_type",
            class: room_type?.result[i],
            score: room_type?.score[i],
          });
        }

        const maxAreas = {};

        boundryBoxes.forEach((item) => {
          const result = item.result;
          const area = item.area;

          if (!maxAreas[result] || area > maxAreas[result]) {
            maxAreas[result] = area;
          }
        });

        // Filter objects based on the maximum area for each unique result name
        boundryBoxes = boundryBoxes.filter((item) => {
          const result = item.result;
          const area = item.area;

          return area === maxAreas[result];
        });
      } else if (
        response.data.scene_classification.result.includes("Outdoor")
      ) {
        const res1 = response.data;
        const keys = Object.keys(res1);
        keys.forEach((item) => {
          if (
            res1[item]?.result &&
            res1[item]?.result?.length > 0 &&
            item !== "scene_classification"
          ) {
            objects.push({
              modelName: item,
              class: res1[item]?.result[0],
              score: res1[item]?.score[0],
            });
          }
        });
      } else if (
        response.data.scene_classification.result.includes("Floor plan")
      ) {
        const floor_plan = response?.data.scene_classification;
        objects.push({
          modelName: "floor_plan",
          class: floor_plan.result[0],
          score: floor_plan.score[0],
        });
      }

      const dimention = await getImageDimensions(image_url);
      res.status(200).json({
        success: true,
        boundryBoxes,
        objects,
        qualityScores: response?.data?.quality_scores,
        imageWidth: dimention?.width,
        imageHeight: dimention?.height,
        user,
        response: response?.data,
      });
    }
    // if (user.planName !== "free") {
    //   user.creditsPerMonth -= 1;
    //   await user.save();
    // } else {
    //   await UserCreditsModel.updateOne(
    //     { userId: user._id },
    //     {
    //       $set: { imageTaggingCredit: 0 },
    //     }
    //   );
    // }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// compliance check
exports.complianceDetection = catchAsyncErrors(async (req, res, next) => {
  const user = await userModel
    .findOne({ email: req.user.user.email })
    ?.populate("usercredit");
  // API_AI_SMART_DETECTION

  // down credit
  if (!user) {
    return res.status(400).json({
      success: false,
      message: "please login first",
    });
  }
  // else if (
  //   (!user.creditsPerMonth && user.planName != "free") ||
  //   (user.usercredit?.imageComplianceCredit == 0 && user.planName == "free")
  // ) {
  //   return res.status(400).json({
  //     success: false,
  //     message: "No credit to generate",
  //   });
  // }

  const response = await axios.post(
    process.env.API_AI_COMPLIANCE_DETECTION,
    {
      instances: [
        {
          image_url: req.body.image_url,
        },
      ],
    },
    {
      headers: {
        Authorization: [req.user.user._id, true],
        "Content-Type": "application/json",
      },
    }
  );
  let boundryBoxes = [];
  const res1 = response.data?.result;
  for (let i = 0; i < res1.bbox?.length; i++) {
    boundryBoxes.push({
      bbox: res1.bbox[i],
      result: res1.classes[i],
      score: res1.scores[i],
    });
  }
  const dimention = await getImageDimensions(req.body.image_url);

  if (response?.data) {
    // if (user.planName !== "free") {
    //   user.creditsPerMonth -= 1;
    //   await user.save();
    // } else {
    //   await UserCreditsModel.updateOne(
    //     { userId: user._id },
    //     {
    //       $set: { imageComplianceCredit: 0 },
    //     }
    //   );
    // }
    res.status(200).json({
      success: true,
      boundryBoxes,
      imageWidth: dimention?.width,
      imageHeight: dimention?.height,
      user,
    });
  } else {
    return res.status(400).json({
      success: false,
      message: "objects not detected",
    });
  }
});

// room object detection
exports.roomObjectDetection = catchAsyncErrors(async (req, res, next) => {
  const user = await userModel
    .findOne({ email: req.user.user.email })
    ?.populate("usercredit");
  // down credit
  if (!user) {
    return res.status(400).json({
      success: false,
      message: "please login first",
    });
  }
  // else if (
  //   (!user.creditsPerMonth && user.planName != "free") ||
  //   (user.usercredit?.imageComplianceCredit == 0 && user.planName == "free")
  // ) {
  //   return res.status(400).json({
  //     success: false,
  //     message: "No credit to generate",
  //   });
  // }

  const response = await axios.post(
    process.env.API_AI_ROOM_OBJECT_DETECT,
    {
      instances: [
        {
          image_url: req.body.image_url,
        },
      ],
    },
    {
      headers: {
        Authorization: [req.user.user._id, true],
        "Content-Type": "application/json",
      },
    }
  );
  let boundryBoxes = [];
  const maxAreas = {};
  const res1 = response.data?.detection_details;
  for (let i = 0; i < res1?.length; i++) {
    boundryBoxes.push({
      bbox: res1[i].box,
      area:
        (res1[i].box[2] - res1[i].box[0]) * (res1[i].box[3] - res1[i].box[1]),
      result: response.data.detections[i],
      score: response.data.scores[i],
    });
  }
  boundryBoxes.forEach((item) => {
    const result = item.result;
    const area = item.area;

    if (!maxAreas[result] || area > maxAreas[result]) {
      maxAreas[result] = area;
    }
  });
  boundryBoxes = boundryBoxes.filter((item) => {
    const result = item.result;
    const area = item.area;

    return area === maxAreas[result];
  });

  if (response?.data) {
    // if (user.planName !== "free") {
    //   user.creditsPerMonth -= 1;
    //   await user.save();
    // } else {
    //   await UserCreditsModel.updateOne(
    //     { userId: user._id },
    //     {
    //       $set: { imageComplianceCredit: 0 },
    //     }
    //   );
    // }
    res.status(200).json({
      success: true,
      boundryBoxes,
      user,
    });
  } else {
    return res.status(400).json({
      success: false,
      message: "objects not detected",
    });
  }
});

// room type
exports.roomTypeDetection = catchAsyncErrors(async (req, res, next) => {
  const { image_url } = req.body;
  const response = await axios.post(
    process.env.API_AI_ROOM_TYPE,
    {
      instances: [{ image_url }],
    },
    {
      headers: {
        Authorization: [process.env.DETECT_API_KEY, true],
        "Content-Type": "application/json",
      },
    }
  );
  let boundryBoxes = [];
  const res1 = response.data.result.label;
  for (let i = 0; i < res1?.length; i++) {
    boundryBoxes.push({
      result: res1[i],
      score: response.data.result.scores[i],
    });
  }
  if (response?.data) {
    res.status(200).json({
      success: true,
      boundryBoxes,
      message: "successful",
    });
  } else {
    res.status(400).json({
      success: false,
      response: "model not getting result",
    });
  }
});

// detect architecture
exports.detectArchitecture = catchAsyncErrors(async (req, res, next) => {
  const { image_url, model_name } = req.body;
  let API_URL;
  if (model_name === "building_style") {
    API_URL = process.env.API_AI_BUILDING_STYLE;
  } else if (model_name === "architecture") {
    API_URL = process.env.API_AI_DETECT_ARCHITECTURE;
  } else {
    API_URL = process.env.API_AI_DETECT_MATERIAL;
  }
  const response = await axios.post(
    API_URL,
    {
      instances: [{ image_url }],
    },
    {
      headers: {
        Authorization: [req.user.user._id, true],
        "Content-Type": "application/json",
      },
    }
  );
  let boundryBoxes = [];
  const res1 =
    model_name === "building_style"
      ? response.data.result
      : response.data.label;
  for (let i = 0; i < res1?.length; i++) {
    boundryBoxes.push({
      result: res1[i],
      score: response.data?.scores[i],
      predictions: response?.data?.predictions
        ? response?.data?.predictions[i]
        : "",
    });
  }
  if (response?.data) {
    res.status(200).json({
      success: true,
      boundryBoxes,
      message: "successful",
    });
  } else {
    res.status(400).json({
      success: false,
      response: "model not getting result",
    });
  }
});

exports.modelsRunningByDate = catchAsyncErrors(async (req, res) => {
  const { date, modelName } = req.body;
  const { userId } = req.params;
  const parts = date.split("/");
  let year = parseInt(parts[2]);
  let month = parseInt(parts[1]) - 1; // Months are zero-indexed in JavaScript Date object
  let day = parseInt(parts[0]);

  // Validate the date components
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    // Handle invalid date format
    return res.status(400).json({ error: "Invalid date format" });
  }

  const results = [];

  // Function to adjust month and year for negative days
  const adjustDate = (currentYear, currentMonth, currentDay) => {
    while (currentDay < 1) {
      if (currentMonth === 0) {
        currentMonth = 11;
        currentYear--;
      } else {
        currentMonth--;
      }

      const daysInPreviousMonth = new Date(
        currentYear,
        currentMonth + 1,
        0
      ).getDate();
      currentDay = daysInPreviousMonth + currentDay;
    }

    return { year: currentYear, month: currentMonth, day: currentDay };
  };

  // Loop through the previous 60 days
  for (let i = 80; i >= 1; i--) {
    const adjustedDate = adjustDate(year, month, day - i);
    const currentDate = new Date(
      adjustedDate.year,
      adjustedDate.month,
      adjustedDate.day,
      0,
      0,
      0,
      0
    );

    if (isNaN(currentDate.getTime())) {
      console.log("Invalid date:", currentDate);
      continue;
    }

    const startDate = new Date(currentDate);
    const endDate = new Date(currentDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    startDate.setDate(startDate.getDate() - 1);
    endDate.setDate(endDate.getDate() - 1);
    console.log(startDate, endDate);
    console.log(currentDate.toISOString().split("T")[0]);

    try {
      const result = await userlinksModel.countDocuments({
        createdAt: {
          $gte: startDate,
          $lt: endDate,
        },
        "optJson.model": modelName,
        $or: [
          { "optJson.apiFields.app_URL": { $regex: "en/properties" } },
          { "optJson.apiFields.app_URL": { $regex: "fr/annonces" } },
        ],
        ...(userId && { userId }),
      });

      results.push({
        date: currentDate.toISOString().split("T")[0],
        website: "Doorinsider",
        modelName,
        count: result,
      });
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err,
      });
    }
  }

  return res.status(200).json({
    success: true,
    data: results,
  });
});
