const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const WidgetModel = require("../models/WidgetModel");
const scrapedImagesModel = require("../models/scrapedImages");
const sendEmail = require("../utils/sendEmail");
const path = require("path");
const { Storage } = require("@google-cloud/storage");
const filePath = path.join(__dirname, "../middleware/gcp-bucket-file.json");
const storage = new Storage({
  keyFilename: filePath,
  projectId: "lucid-box-387617",
});

const excelJS = require("exceljs");
const fs = require("fs");

const widgetBucket = storage.bucket("proptexx-store-widget");
const {
  WidgetUserModel,
  ThemeModel,
  widgetModel,
  userlinksModel,
} = require("../models");
const sendToken = require("../utils/sendToken");
const WidgetUser = require("../models/WidgetUser");
const UserLinks = require("../models/UserLinks");
const { updateAndUploadFile } = require("../utils/updateAndUploadFile");
const { extractDomain } = require("../utils/uploadImage");
const axios = require("axios");
const querystring = require("querystring");

const puppeteer = require("puppeteer");
const { chromium } = require("playwright");

const { get } = require("http");
const { getImageHash } = require("../utils/getImageHash");
const { Builder, By, Key, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const { error } = require("console");

exports.createWidgetDomain = catchAsyncErrors(async (req, res, next) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    domain,
    version,
    urls,
    jsfile,
    region,
    prohibitedUrls,
    ctaId,
    scrapingArrayId,
  } = req.body;
  if (!firstName || !lastName || !email || !phone || !jsfile || !domain) {
    return res.status(200).json({
      success: false,
      message: "**Field is empty (fill the field name)",
    });
  }

  let user = await WidgetUserModel.findOne({ email, phone });
  if (user) {
    return res.status(400).json({
      success: false,
      message: "Email already exists for other product. Use another email",
    });
  }

  const regexPattern = domain
    .map((url) => `^(?:https?://)?(?:www\\.)?${extractDomain(url)}(?:/)?$`)
    .join("|");

  const widgetData = await WidgetModel.findOne({
    domain: { $elemMatch: { $regex: new RegExp(regexPattern, "i") } },
  });

  if (widgetData) {
    return res.status(400).json({
      success: false,
      message: "Domain already exists for other product. Use another domain",
    });
  }

  user = await WidgetUserModel.create({
    firstName,
    lastName,
    email,
    phone,
    joinedOrigin: jsfile,
    role: "admin",
  });
  if (!user) {
    return res.status(400).json({
      success: false,
      message: "Widget user not created",
    });
  }

  let theme = await ThemeModel.findOne({ refDomain: jsfile });

  if (!theme) {
    theme = await ThemeModel.create({ refDomain: jsfile });
    theme.userId.push(user?._id);
    await theme.save();
  } else {
    if (!theme.userId.includes(user?._id)) {
      theme.userId.push(user?._id);
      await theme.save();
    }
  }

  // user.role = "admin";
  user.theme = theme?._id;
  // user.joinedOrigin = jsfile;
  await user.save();

  const widget = await WidgetModel.create({
    email,
    domain,
    urls,
    version,
    jsfile,
    region,
    prohibitedUrls,
    ctaId,
    scrapingArrayId,
  });
  if (!widget) {
    return res.status(400).json({
      success: false,
      message: "Widget not created",
    });
  }

  if (user && theme) {
    res.status(200).json({
      success: true,
      user,
      theme,
      widget,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "Not added",
    });
  }
});

exports.getAllWidgetDomains = catchAsyncErrors(async (req, res, next) => {
  const { page, limit, search } = req.query;

  const options = {
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 10,
  };

  const filter = {};

  if (search && search?.trim().length > 0) {
    const trimmedSearch = search.trim();
    const regexSearch = { $regex: trimmedSearch, $options: "i" };

    // Adjust the filter to search within the 'domain' array for substrings
    filter.$or = [{ domain: regexSearch }];
  }
  try {
    const widgets = await WidgetModel.paginate(filter, options);

    if (widgets) {
      res.status(200).json({
        success: true,
        widgets,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "No widgets found",
      });
    }
  } catch (error) {
    console.error("Error fetching widgets:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});
exports.getWidgetVersions = catchAsyncErrors(async (req, res, next) => {
  const [files] = await widgetBucket.getFiles();
  const versionList =
    process.env.NODE_ENV === "development"
      ? files
          .filter(
            ({ name }) =>
              (name.match(/main1_v\d+(\.\d+)*\.js/) ||
                name.match(/guest1_v\d+(\.\d+)*\.js/)) &&
              name.includes("_v")
          )
          .map(({ name }) => name)
      : files
          .filter(
            ({ name }) =>
              (name.match(/main_v\d+(\.\d+)*\.js/) ||
                name.match(/guest_v\d+(\.\d+)*\.js/)) &&
              name.includes("_v")
          )
          .map(({ name }) => name);
  console.log(versionList);
  res.status(200).json({
    success: true,
    versionList,
  });
});

exports.updateWidgetDomain = catchAsyncErrors(async (req, res, next) => {
  const {
    name,
    email,
    domain,
    urls,
    prohibitedUrls,
    version,
    ctaId,
    scrapingArrayId,
  } = req.body;

  const regexPattern = domain
    .map((url) => `^(?:https?://)?(?:www\\.)?${extractDomain(url)}(?:/)?$`)
    .join("|");
  const widgetData = await WidgetModel.findOne({
    domain: { $elemMatch: { $regex: new RegExp(regexPattern, "i") } },
    _id: { $ne: req.params.id },
  });

  if (widgetData) {
    return res.status(400).json({
      success: false,
      message: "At least one domain already exists",
    });
  }
  await WidgetModel.findOneAndUpdate(
    { _id: req.params.id },
    {
      name,
      email,
      domain,
      urls,
      prohibitedUrls,
      version,
      ctaId,
      scrapingArrayId,
    },
    { upsert: true, new: true }
  );
  const getWidget = await WidgetModel.findById(req.params.id);
  const result = await updateAndUploadFile(getWidget, version);
  if (getWidget) {
    res.status(200).json({
      success: true,
      widget: getWidget,
      result,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "Failed to update",
    });
  }
});
exports.deleteWidgetDomain = catchAsyncErrors(async (req, res, next) => {
  const Widget = await WidgetModel.findByIdAndDelete(req.params.id);

  const user = await WidgetUserModel.findOneAndRemove({ email: Widget.email });
  console.log(user, Widget);
  await widgetBucket.file(req.body?.jsfile).delete();

  res.status(200).json({
    success: true,
    message: "Deleted successfully",
  });
});

exports.authWidgetDomain = catchAsyncErrors(async (req, res, next) => {
  const { domain, clientUrl, url, scriptSrc } = req.body;
  // let authVersion = false;

  const regex = new RegExp(
    `^(?:https?://)?(?:www\\.)?${extractDomain(domain)}(?:/)?$`,
    "i"
  );

  const theme = await ThemeModel.findOne({
    refDomain: clientUrl,
  });
  const widgetData = await WidgetModel.findOne({
    jsfile: clientUrl,
    domain: {
      $regex: regex,
    },
  });

  // if (widgetData) {
  //   let dbVersion = widgetData?.version.replace(" ", "_");
  //   authVersion = scriptSrc.includes(dbVersion);
  // }

  try {
    const checkUrl = url == "/" ? null : url;
    if (widgetData?.urls?.length) {
      const widgetData1 = await WidgetModel.findOne({
        jsfile: clientUrl,
        urls: {
          $regex: new RegExp(checkUrl),
        },
      });
      if (
        widgetData1
        // && authVersion
      ) {
        return res.status(200).json({
          success: true,
          theme,
          message: "Correct credentials",
        });
      }
    }

    if (widgetData?.prohibitedUrls?.length) {
      const widgetData1 = await WidgetModel.findOne({
        jsfile: clientUrl,
        prohibitedUrls: {
          $regex: new RegExp(checkUrl),
        },
      });

      if (
        widgetData1
        // || !authVersion
      ) {
        return res.status(400).json({
          success: false,
          message: "Not Correct credentials",
        });
      } else {
        return res.status(200).json({
          success: true,
          theme,
          message: "Correct credentials",
        });
      }
    }
    if (
      widgetData &&
      !widgetData?.urls?.length &&
      !widgetData?.prohibitedUrls?.length
      // && authVersion
    ) {
      return res.status(200).json({
        success: true,
        theme,
        widgetData,
        message: "Correct credentials",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Not Correct credentials",
      });
    }
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Not Correct credentials",
    });
  }
});

// widget user register ...
exports.userRegistration = catchAsyncErrors(async (req, res, next) => {
  const { email, phone, joinedOrigin, userSource } = req.body;
  let { isEmailSend } = req.body;
  isEmailSend = isEmailSend === false ? false : true;
  if (!email || !phone || !joinedOrigin) {
    return res
      .status(400)
      .json({ success: false, message: "Pleaase provide all credentials" });
  }
  const adminUserCheck = await WidgetUserModel.findOne({
    email,
    firstName: { $ne: "" },
    role: "admin",
  });

  if (adminUserCheck) {
    return res
      .status(400)
      .json({ success: false, message: "User already registered" });
  }
  const regex = new RegExp(
    `^(?:https?://)?(?:www\\.)?${extractDomain(joinedOrigin)}(?:/)?$`,
    "i"
  );

  const widgetData = await WidgetModel.findOne({
    domain: {
      $elemMatch: { $regex: regex },
    },
  });
  const widgetDomains = widgetData ? widgetData.domain : [];
  let regexPattern = widgetDomains
    .map((url) => `^(?:https?://)?(?:www\\.)?${extractDomain(url)}(?:/)?$`)
    .join("|");
  const user = await WidgetUserModel.findOne({
    email,
    firstName: { $ne: "" },
    joinedOrigin: {
      $regex: new RegExp(regexPattern, "i"),
    },
  });
  if (user) {
    return res.status(400).json({
      success: false,
      message: "User already exists on this website, please try again",
    });
  }
  const otp = Math.floor(
    Math.random() * (999999 - 100000 + 1) + 100000
  )?.toString();
  const newUser = await WidgetUserModel.findOneAndUpdate(
    { email, joinedOrigin: { $regex: new RegExp(regexPattern, "i") } },
    { email, phone, otp, joinedOrigin, userSource },
    { upsert: true, new: true }
  );
  if (!newUser) {
    return res.status(400).json({
      success: false,
      message: "Not registered",
    });
  }

  if (isEmailSend) {
    await sendEmail({
      email,
      subject: `Welcome to Proptexx AI - Complete Your Verification!`,
      message:
        "Hi there,<br/><br/> Welcome aboard! We're thrilled to have you join the Proptexx AI community, where we blend the wonders of artificial intelligence with property technology to deliver unparalleled accuracy, speed, and assurance.",
      otp,
      click: "",
      url: "",
    });
  }
  return res.status(200).json({
    success: true,
    message: "Verify your email",
  });
});

// widget user verification
exports.phoneVerification = catchAsyncErrors(async (req, res, next) => {
  const { email, otp, joinedOrigin } = req.body;
  const getData = await WidgetUserModel.findOne({ email, joinedOrigin });

  if (getData) {
    const update = await WidgetUserModel.updateOne(
      { email, otp, joinedOrigin },
      { $set: { otp: "" } }
    );
    if (update?.matchedCount === 1) {
      res.status(200).json({ message: "OTP verified" });
    } else {
      res.status(400).json({ error: "Invalid OTP" });
    }
    // const verificationCheck = await client.verify.v2
    //   .services(verifySid)
    //   .verificationChecks.create({ to: phone, code: otp });
    // if (verificationCheck.status === "approved") {
    //   res.status(200).json({ message: "OTP verified" });
    // } else {
    //   res.status(400).json({ error: "Invalid OTP" });
    // }
  } else {
    res.status(500).json({
      success: true,
      message: "Not verified",
    });
  }
});

// update username
exports.updateusername = catchAsyncErrors(async (req, res, next) => {
  const { firstName, lastName, email, joinedOrigin } = req.body;
  const regex = new RegExp(
    `^(?:https?://)?(?:www\\.)?${extractDomain(joinedOrigin)}(?:/)?$`,
    "i"
  );

  const user = await WidgetUserModel.findOneAndUpdate(
    { email, joinedOrigin: { $regex: regex } },
    { $set: { firstName, lastName } },
    { new: true }
  );
  if (user) {
    sendToken(user, 200, res);
  } else {
    res.status(200).json({
      success: false,
      message: "Not registered",
    });
  }
});

// update username
exports.updateUser = catchAsyncErrors(async (req, res, next) => {
  const { interested, userId } = req.body;
  const user = await WidgetUserModel.findByIdAndUpdate(userId, {
    $set: { interested },
  });
  if (user) {
    sendToken(user, 200, res);
  } else {
    res.status(400).json({
      success: false,
      message: "User not updated",
    });
  }
});

// user login ..
exports.userLogin = catchAsyncErrors(async (req, res, next) => {
  const { email, phone, joinedOrigin, isAdmin } = req.body;
  let user;

  if (!email && !phone) {
    return res
      .status(403)
      .json({ success: false, message: "Email or Phone is required" });
  }
  const regex = new RegExp(
    `^(?:https?://)?(?:www\\.)?${extractDomain(joinedOrigin)}(?:/)?$`,
    "i"
  );

  const widgetData = await WidgetModel.findOne({
    domain: {
      $elemMatch: { $regex: regex },
    },
  });

  let regexPattern = widgetData?.domain
    .map((url) => `^(?:https?://)?(?:www\\.)?${extractDomain(url)}(?:/)?$`)
    .join("|");
  regexPattern = regexPattern || "abc.com";
  if (regexPattern) {
    user = await WidgetUserModel.findOne({
      email,
      phone,
      ...(isAdmin && { role: "admin" }),
      ...(!isAdmin && widgetData && { joinedOrigin: new RegExp(regexPattern) }),
      firstName: { $ne: "" },
    });
  }
  if (user) {
    user.lastLoggedIn = new Date();
    user.lastLoggedOut = null;
    await user.save();
    sendToken(user, 200, res);
  } else {
    res.status(400).json({
      success: false,
      message: "Invalid mobile number or email, please try again to proceed",
    });
  }
});

// user logout
exports.userLogout = catchAsyncErrors(async (req, res, next) => {
  const {
    body: { userId },
  } = req;

  if (!userId) {
    return res
      .status(403)
      .json({ success: false, message: "User ID not found" });
  }

  const user = await WidgetUserModel.findOne({ _id: userId });

  await user.logout();
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

// heartbeat
exports.heartbeat = catchAsyncErrors(async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(403).send("User ID not found");
    }

    const { lastLoggedOut } = await WidgetUserModel.findById(userId);

    if (!lastLoggedOut) {
      await WidgetUserModel.findByIdAndUpdate(userId, {
        lastActive: new Date(),
        active: true,
      });
      res.status(200).json({
        success: true,
        message: "Activity acknowledged",
      });
    }

    res
      .status(403)
      .json({ success: true, message: "Session ended, already logged out" });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

exports.getAllWidgetUsers = catchAsyncErrors(async (req, res, next) => {
  try {
    const { page, limit, search, grid, userSource } = req.query;
    const options = { page, limit };

    const filter = {};
    let startDate, endDate;
    switch (grid) {
      case "newUsersLast1Day":
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case "newUsersLast7Days":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "newUsersLast30Days":
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "newUsersLastYears":
        const lastYear = new Date().getFullYear() - 1;
        startDate = new Date(lastYear, 0, 1);
        endDate = new Date(lastYear, 11, 31);
        break;
      default:
        startDate = new Date(0);
        break;
    }
    endDate = new Date();
    filter.createdAt = { $gte: startDate, $lte: endDate };
    if (userSource) {
      filter.userSource = userSource;
    }
    filter.role = { $ne: "admin" };

    if (search && search?.trim()?.length > 0) {
      const trimmedSearch = search?.trim();
      const regexSearch = { $regex: trimmedSearch, $options: "i" };
      const isId = /^[a-f\d]{24}$/i.test(trimmedSearch);
      if (isId) {
        filter.$or = [
          { _id: trimmedSearch },
          { email: regexSearch },
          { firstName: regexSearch },
          { lastName: regexSearch },
        ];
      } else {
        filter.$or = [
          { email: regexSearch },
          { firstName: regexSearch },
          { lastName: regexSearch },
        ];
      }
    }

    const result = await WidgetUser.paginate(filter, options);

    const widgetAdmins = await WidgetUser.find({
      role: "admin",
    }).sort({ createdAt: -1 });

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    // get users analytics
    const getActiveUserDataByTime = async (time) => {
      const usersByTime = await WidgetUser.countDocuments({
        ...(time && { lastActive: { $gte: time } }),
        ...(userSource && { userSource: userSource }),
        role: { $ne: "admin" },
      });
      return usersByTime;
    };

    const getNewUserDataByTime = async (time) => {
      const usersByTime = await WidgetUser.countDocuments({
        ...(time && { createdAt: { $gte: time } }),
        ...(userSource && { userSource: userSource }),
        role: { $ne: "admin" },
      });
      return usersByTime;
    };

    const weeklyActiveUsers = await getActiveUserDataByTime(oneWeekAgo);
    const monthlyActiveUsers = await getActiveUserDataByTime(oneMonthAgo);
    const newUsersLast1Day = await getNewUserDataByTime(
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    const newUsersLast7Days = await getNewUserDataByTime(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    const newUsersLast30Days = await getNewUserDataByTime(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    const totalWidgetUsers = await getNewUserDataByTime(null);
    res.status(200).json({
      success: true,
      data: result,
      weeklyActiveUsers,
      monthlyActiveUsers,
      totalWidgetUsers,
      widgetAdmins,
      analytics: {
        newUsersLast1Day,
        newUsersLast7Days,
        newUsersLast30Days,
      },
    });
  } catch (err) {
    console.log("getAllWidgetUsers Error", err);
    return res.status(400).json({
      success: false,
      message: err,
    });
  }
});

// Export Data
exports.getAllWidgetUsersWithoutPagination = catchAsyncErrors(
  async (req, res, next) => {
    const { interested, grid, start, end } = req.query;
    const filter = {};

    let startDate, endDate;

    if (start && end) {
      startDate = new Date(start);
      endDate = new Date(end);
    } else {
      switch (grid) {
        case "newUsersLast1Day":
          startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
          break;
        case "newUsersLast7Days":
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "newUsersLast30Days":
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "newUsersLastYears":
          const lastYear = new Date().getFullYear() - 1;
          startDate = new Date(lastYear, 0, 1);
          endDate = new Date(lastYear, 11, 31);
          break;
        default:
          startDate = new Date(0);
          break;
      }
    }
    const widgetData = await WidgetModel.findOne({
      jsfile: req.user?.user?.joinedOrigin,
    });

    const regexPattern = widgetData?.domain
      .map((url) => `^(?:https?://)?(?:www\\.)?${extractDomain(url)}(?:/)?$`)
      .join("|");

    if (interested) {
      filter.interested = interested;
    }

    endDate = endDate || new Date();
    filter.createdAt = { $gte: startDate, $lte: endDate };
    filter.joinedOrigin = { $regex: new RegExp(regexPattern, "i") };
    filter.role = { $ne: "admin" };
    if (
      req.user.user?.joinedOrigin ==
      "https://storage.googleapis.com/proptexx-store-widget/main_1704897524007.js"
    ) {
      filter.userSource = "doorinsider";
    } else {
      filter.userSource = "widget";
    }

    const result = await WidgetUser.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: result,
    });
  }
);

// new users in a timeframe
exports.findNewExtUsersInTimeframe = catchAsyncErrors(
  async (req, res, next) => {
    const { start, end, userSource } = req.query;

    // Validate start and end dates
    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: "Start and end dates are required.",
      });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Please provide valid dates.",
      });
    }
    endDate.setDate(endDate.getDate() + 1);

    // Find new users created within the specified timeframe
    const newUsersInTimeframe = await WidgetUser.find({
      createdAt: { $gte: startDate, $lte: endDate },
      ...(userSource === "extension" && { userSource }),
      ...(userSource !== "extension" && {
        $or: [
          { userSource: { $ne: "extension" } },
          { userSource: { $exists: false } },
        ],
      }),
    });

    res.status(200).json({
      success: true,
      data: newUsersInTimeframe,
    });
  }
);

exports.getAllWidgetUserActions = catchAsyncErrors(async (req, res, next) => {
  const userId = req.params.id;

  const result = await UserLinks.find({ userId })?.populate("feedback");

  // Calculate additional statistics
  const totalActions = result?.length;
  const uniqueModels = new Set();
  const actionsPerModel = {};

  result?.forEach((entry) => {
    let model = entry?.optJson?.model;
    if (model) {
      uniqueModels.add(model);
      if (actionsPerModel[model]) {
        actionsPerModel[model]++;
      } else {
        actionsPerModel[model] = 1;
      }
    }
  });
  res.status(200).json({
    success: true,
    data: {
      results: result,
      totalActions,
      totalUniqueModels: uniqueModels.size,
      actionsPerModel,
    },
  });
});

// widget user -- Admin..
exports.widgetAdminRegistration = catchAsyncErrors(async (req, res) => {
  const { joinedOrigin } = req.body;

  const user = await WidgetUserModel.findOne({ email: req.body.email });
  if (user) {
    if (user?.role == "admin") {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    } else {
      const theme = await ThemeModel.findOne({ refDomain: joinedOrigin });

      if (!theme) {
        const newTheme = await ThemeModel.create({ refDomain: joinedOrigin });
        newTheme.userId.push(user?._id);
        await newTheme.save();
      } else {
        if (!theme.userId.includes(user?._id)) {
          theme.userId.push(user?._id);
          await theme.save();
        }
      }

      await WidgetUserModel.findOneAndUpdate(
        { email: user.email },
        {
          role: "admin",
          theme: theme?._id,
          joinedOrigin,
        }
      );
      return res.status(200).json({
        success: true,
        theme,
        user,
        message: "This user is now admin",
      });
    }
  } else {
    const theme = await ThemeModel.findOneAndUpdate(
      {
        refDomain: joinedOrigin,
      },
      {},
      { upsert: true, new: true }
    );
    const newUser = await WidgetUserModel.create({
      ...req.body,
      role: "admin",
      theme: theme?._id,
    });
    if (!newUser) {
      return res.status(400).json({
        success: false,
        message: "Not registered",
      });
    } else {
      theme.userId = [...theme.userId, newUser?._id];
      await theme.save();

      res.status(200).json({
        success: true,
        user: newUser,
        theme: theme,
        message: "Registered",
      });
    }
  }
});

// get dashboard users --admin
exports.adminUsers = catchAsyncErrors(async (req, res, next) => {
  const widgetData = await WidgetUserModel.find({
    role: "user",
    joinedOrigin: { $in: req.user.user.joinedOrigin },
  });
  if (widgetData?.length) {
    return res.status(200).json({
      success: true,
      message: "",
      widgetData,
    });
  } else {
    return res.status(400).json({
      success: false,
      message: "Not Correct credentials",
    });
  }
});
exports.getWidgetUsers = catchAsyncErrors(async (req, res, next) => {
  const { page, limit, search, grid, interested, start, end } = req.query;

  const options = { page, limit };

  const filter = {};
  let startDate, endDate;
  if (grid !== "customDateRange") {
    switch (grid) {
      case "newUsersLast1Day":
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case "newUsersLast7Days":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "newUsersLast30Days":
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "newUsersLastYears":
        const lastYear = new Date().getFullYear() - 1;
        startDate = new Date(lastYear, 0, 1);
        endDate = new Date(lastYear, 11, 31);
        break;
      default:
        startDate = new Date(0);
        endDate = new Date();
        break;
    }
  } else {
    startDate = start ? new Date(start) : new Date(0);
    endDate = end ? new Date(end) : new Date();
  }

  filter.createdAt = { $gte: startDate, $lte: endDate };
  if (
    req.user.user?.joinedOrigin ==
    "https://storage.googleapis.com/proptexx-store-widget/main_1704897524007.js"
  ) {
    filter.userSource = "doorinsider";
  } else {
    filter.userSource = "widget";
  }
  if (search && search?.trim()?.length > 0) {
    const trimmedSearch = search?.trim();
    const regexSearch = { $regex: trimmedSearch, $options: "i" };
    const isId = /^[a-f\d]{24}$/i.test(trimmedSearch);
    if (isId) {
      filter.$or = [
        { _id: trimmedSearch },
        { email: regexSearch },
        { firstName: regexSearch },
        { lastName: regexSearch },
      ];
    } else {
      filter.$or = [
        { email: regexSearch },
        { firstName: regexSearch },
        { lastName: regexSearch },
      ];
    }
  }

  const widgetData = await WidgetModel.findOne({
    jsfile: req.user.user?.joinedOrigin,
  });

  const regexPattern = widgetData?.domain
    .map((url) => `^(?:https?://)?(?:www\\.)?${extractDomain(url)}(?:/)?$`)
    .join("|");

  if (interested) {
    filter.interested = interested;
  }

  filter.joinedOrigin = { $regex: new RegExp(regexPattern, "i") };
  filter.role = { $ne: "admin" };

  // const result = await WidgetUser.paginate(filter, options);
  let result = await WidgetUser.paginate(filter, options);
  const promises = result?.results?.map(async (item) => {
    const userlinks = await UserLinks.find({ userId: item?._id }).populate(
      "feedback"
    );
    return { ...item?.toObject(), userlinks }; // Assuming `item` is a Mongoose document, use `toObject()` to convert it to a plain JS object
  });
  const arr = await Promise.all(promises);

  result = { ...result, results: arr };

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  // get users analytics
  const getDataByTime = async (time, createdAt) => {
    const byTimeUsers = await WidgetUser.countDocuments({
      ...(time && { lastActive: { $gte: time } }),
      ...(createdAt && { createdAt: { $gte: createdAt } }),
      joinedOrigin: { $regex: new RegExp(regexPattern, "i") },
      role: { $ne: "admin" },
    });
    return byTimeUsers;
  };
  const weeklyActiveUsers = await getDataByTime(oneWeekAgo);
  const monthlyActiveUsers = await getDataByTime(oneMonthAgo);
  const newUsersLast1Day = await getDataByTime(
    new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  const newUsersLast7Days = await getDataByTime(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
  const newUsersLast30Days = await getDataByTime(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  const totalWidgetUsers = await getDataByTime(null);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const dailyNewUsers = await getDataByTime(null, startOfToday);

  res.status(200).json({
    success: true,
    data: result,
    xAxis: widgetData?.xAxis,
    yAxis: widgetData?.yAxis,
    isNotfloatingIcon: widgetData?.isNotfloatingIcon,
    logoWithText: widgetData?.logoWithText,
    logoIcon: widgetData?.logoIcon,
    weeklyActiveUsers,
    monthlyActiveUsers,
    totalWidgetUsers,
    dailyNewUsers,
    analytics: {
      newUsersLast1Day,
      newUsersLast7Days,
      newUsersLast30Days,
    },
  });
});

// widget position
exports.widgetPosition = catchAsyncErrors(async (req, res, next) => {
  const widget = await widgetModel.findOne({
    jsfile: req.user.user.joinedOrigin,
  });

  if (!widget) {
    return res.status(404).json({
      success: false,
      message: "widget not found",
    });
  }

  const updatewidget = await widgetModel.findByIdAndUpdate(
    widget._id,
    req.body,
    {
      new: true,
    }
  );
  if (!updatewidget) {
    return res.status(400).json({
      success: false,
      message: "widget not updated",
    });
  }

  return res.status(200).json({
    success: true,
    widget: updatewidget,
    message: "widget update successfully",
  });
});

//Widget custom logo
exports.widgetLogo = catchAsyncErrors(async (req, res, next) => {
  const widget = await widgetModel.findOne({
    jsfile: req.user.user.joinedOrigin,
  });

  if (!widget) {
    return res.status(404).json({
      success: false,
      message: "widget not found",
    });
  }

  const updatewidget = await widgetModel.findByIdAndUpdate(
    widget._id,
    req.body,
    {
      new: true,
    }
  );
  if (!updatewidget) {
    return res.status(400).json({
      success: false,
      message: "widget not updated",
    });
  }

  return res.status(200).json({
    success: true,
    widget: updatewidget,
    message: "widget update successfully",
  });
});

exports.getScrapedImages = catchAsyncErrors(async (req, res, next) => {
  const { domain_url, image_url } = req.body;
  const API_URL = process.env.API_AI_DETECT_ROOM_TYPE;
  const api_key = process.env.WIDGET_USER_ID;
  let hashedContent = await getImageHash(image_url);
  const rejectLabels = [
    "Wine Cellar",
    "Workshop",
    "Athletic Court",
    "Children's Room",
    "Garage",
    "Gym",
    "Pantry",
    "Play Room",
    "Spa/sauna Room",
    "Basement",
  ];
  const image_urls = [
    "https://cdn.chime.me/image/fs/sitebuild/site-cms/listing-detail/3d.jpeg",
    "https://www.remax.ro/images/menus/9zffw-imobid-menu.jpg",
    "ia",
  ];

  const existingDomainData = await scrapedImagesModel.findOne({ domain_url });
  // Check if document with given domain_url exists
  try {
    const successImagesQuery = {
      "successImages.image_url": image_url,
      "successImages.image_content": hashedContent,
    };
    const unSuccessAndEmptyImagesQuery = {
      $or: [
        {
          "unSuccessImages.image_url": image_url,
          "unSuccessImages.image_content": hashedContent,
        },
        {
          "emptyImages.image_url": image_url,
          "emptyImages.image_content": hashedContent,
        },
      ],
    };
    const successImage = await scrapedImagesModel.findOne(successImagesQuery);
    if (successImage) {
      const image = successImage.successImages.find(
        (image) => image.image_url === image_url
      );
      return res.status(200).json({
        success: true,
        message: "Image already exist in successImages",
        image,
      });
    }
    const unSuccessAndEmptyImages = await scrapedImagesModel.findOne(
      unSuccessAndEmptyImagesQuery
    );

    if (unSuccessAndEmptyImages) {
      return res.status(400).json({
        success: false,
        message: "Image already exist in unSuccessImages or emptyImages",
        error: "image cannot be proceed",
      });
    }

    if (existingDomainData) {
      // let detect_room_type = `${process.env.API_AI_DETECT_ROOM_TYPE}?input_image_url=${image_url}&api_key=${process.env.WIDGET_USER_ID}`;
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
            "x-api-key": api_key
          },
        }
      );

      if (response) {
        let activeModels = [];

        const data = response.data;
        console.log(data, "data");
        if (
          rejectLabels.some((label) =>
            data?.input_room_types?.includes(label)
          ) ||
          image_urls.includes(image_url)
        ) {
          existingDomainData.unSuccessImages.push({
            image_url,
            image_content: hashedContent,
          });
          await existingDomainData.save();
          return res.status(400).json({
            success: false,
            message: "Image Pushed in unSuccessImages",
            error: "This image cannot be proceed",
          });
        } else {
          activeModels.push(
            data?.input_room_types?.includes("Empty Room")
              ? "virtualStaging"
              : "refurnishing"
          );
          if (data?.input_room_types?.includes("Empty Room")) {
            existingDomainData.emptyImages.push({
              image_url,
              image_content: hashedContent,
            });
            await existingDomainData.save();
            return res.status(400).json({
              success: false,
              message: "Image Pushed in emptyImages",
              error: "This image cannot be proceed",
            });
          }
          existingDomainData.successImages.push({
            image_url,
            image_content: hashedContent,
            ActiveModels: activeModels,
          });
          await existingDomainData.save();
          return res.status(200).json({
            success: true,
            message: "Image Pushed in successImages",
            image: {
              image_url,
              ActiveModels: activeModels,
            },
          });
        }
      }
    } else {
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
            "x-api-key": api_key,
          },
        }
      );

      if (response) {
        let activeModels = [];

        const data = response.data;
        console.log(data, "data");
        if (
          rejectLabels.some((label) =>
            data?.input_room_types.includes(label)
          ) ||
          image_urls.includes(image_url)
        ) {
          const newScrapedImages = await scrapedImagesModel.create({
            domain_url,
            unSuccessImages: [
              {
                image_url,
                image_content: hashedContent,
              },
            ],
            successImages: [],
            emptyImages: [],
          });

          if (newScrapedImages) {
            return res.status(400).json({
              success: false,
              message: "New document created with the image",
              error: "This image cannot be proceed",
            });
          }
        } else {
          activeModels.push(
            !data?.input_room_types?.includes("Empty Room") && "refurnishing"
          );

          if (data?.input_room_types?.includes("Empty Room")) {
            const newScrapedImages = await scrapedImagesModel.create({
              domain_url,
              emptyImages: [
                {
                  image_url,
                  image_content: hashedContent,
                },
              ],
              successImages: [],
              unSuccessImages: [],
            });
            if (newScrapedImages) {
              return res.status(400).json({
                success: false,
                message: "New document created with the image",
                error: "This image cannot be proceed",
              });
            }
          }

          const newScrapedImages = await scrapedImagesModel.create({
            domain_url,
            successImages: [
              {
                image_url,
                image_content: hashedContent,
                ActiveModels: activeModels,
              },
            ],
            unSuccessImages: [],
            emptyImages: [],
          });
          if (newScrapedImages) {
            return res.status(200).json({
              success: true,
              message: "New document created with the image",
              image: {
                image_url,
                ActiveModels: activeModels,
              },
            });
          }
        }
      }
    }
  } catch (err) {
    if (
      err?.response?.data?.error?.includes("Outdoor") ||
      err?.response?.data?.error?.includes("Irrelevant")
    ) {
      if (existingDomainData) {
        existingDomainData.unSuccessImages.push({
          image_url,
          image_content: hashedContent,
        });
        await existingDomainData.save();
        return res.status(400).json({
          success: false,
          message: "Image Pushed in unSuccessImages",
          error: "This image cannot be proceed",
        });
      } else {
        const newScrapedImages = await scrapedImagesModel.create({
          domain_url,
          unSuccessImages: [
            {
              image_url,
              image_content: hashedContent,
            },
          ],
          successImages: [],
          emptyImages: [],
        });

        if (newScrapedImages) {
          return res.status(400).json({
            success: false,
            message: "New document created with the image",
            error: "This image cannot be proceed",
          });
        }
      }
    }
  }
});

exports.getScrapedImagesDoorinsider = catchAsyncErrors(
  async (req, res, next) => {
    const { domain_url, image_url } = req.body;
    const API_URL = process.env.API_AI_DETECT_ROOM_TYPE;
    const api_key = process.env.WIDGET_USER_ID;
    let hashedContent = await getImageHash(image_url);
    const rejectLabels = [
      "Wine Cellar",
      "Workshop",
      "Athletic Court",
      "Children's Room",
      "Garage",
      "Gym",
      "Pantry",
      "Play Room",
      "Spa/sauna Room",
    ];
    const image_urls = [
      "https://cdn.chime.me/image/fs/sitebuild/site-cms/listing-detail/3d.jpeg",
      "https://www.remax.ro/images/menus/9zffw-imobid-menu.jpg",
      "ia",
    ];

    // Check if document with given domain_url exists
    try {
      const existingDomainData = await scrapedImagesModel.findOne({
        domain_url,
      });

      if (existingDomainData) {
        const isInSuccessImages = existingDomainData.successImages.some(
          (image) => {
            return (
              image.image_url === image_url &&
              image.image_content === hashedContent
            );
          }
        );

        const isInUnSuccessImages = existingDomainData.unSuccessImages.some(
          (image) => {
            return (
              image.image_url === image_url &&
              image.image_content === hashedContent
            );
          }
        );
        const isInEmptyImages = existingDomainData.emptyImages.some((image) => {
          return (
            image.image_url === image_url &&
            image.image_content === hashedContent
          );
        });

        if (isInSuccessImages) {
          const matchingImage = existingDomainData.successImages.find(
            (image) => image.image_url === image_url
          );

          return res.status(200).json({
            success: true,
            message: "Image_url already exists in successImages",
            image: matchingImage,
          });
        } else if (isInUnSuccessImages || isInEmptyImages) {
          return res.status(200).json({
            success: false,
            message: "Image_url already exists in unSuccessImages",
            error: "This image cannot be proceed",
          });
        } else {
          // let detect_room_type = `${process.env.API_AI_DETECT_ROOM_TYPE}?input_image_url=${image_url}&api_key=${process.env.WIDGET_USER_ID}`;
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
                "x-api-key": api_key,
              },
            }
          );

          if (response) {
            let activeModels = [];

            const data = response.data;
            if (
              data?.error ||
              data === "Please provide an indoor image" ||
              rejectLabels.some((label) =>
                data?.input_room_types?.includes(label)
              ) ||
              image_urls.includes(image_url)
            ) {
              existingDomainData.unSuccessImages.push({
                image_url,
                image_content: hashedContent,
              });
              await existingDomainData.save();
              return res.status(200).json({
                success: false,
                message: "Image Pushed in unSuccessImages",
                error: "This image cannot be proceed",
              });
            } else {
              activeModels.push(
                !["Basement", "Empty Room"].some((label) =>
                  data?.result?.includes(label)
                )
                  ? "refurnishing"
                  : "virtualStaging"
              );

              existingDomainData.successImages.push({
                image_url,
                image_content: hashedContent,
                ActiveModels: activeModels,
              });
              await existingDomainData.save();
              return res.status(200).json({
                success: true,
                message: "Image Pushed in successImages",
                image: {
                  image_url,
                  ActiveModels: activeModels,
                },
              });
            }
          }
        }
      } else {
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
              "x-api-key": api_key,
            },
          }
        );

        if (response) {
          let activeModels = [];

          const data = response.data;
          if (
            data?.error ||
            data === "Please provide an indoor image" ||
            rejectLabels.some((label) =>
              data?.input_room_types?.includes(label)
            ) ||
            image_urls.includes(image_url)
          ) {
            const newScrapedImages = await scrapedImagesModel.create({
              domain_url,
              unSuccessImages: [
                {
                  image_url,
                  image_content: hashedContent,
                },
              ],
              successImages: [],
              emptyImages: [],
            });

            if (newScrapedImages) {
              return res.status(200).json({
                success: false,
                message: "New document created with the image",
                error: "This image cannot be proceed",
              });
            }
          } else {
            activeModels.push(
              !["Basement", "Empty Room"].some((label) =>
                data?.result?.includes(label)
              )
                ? "refurnishing"
                : "virtualStaging"
            );

            const newScrapedImages = await scrapedImagesModel.create({
              domain_url,
              successImages: [
                {
                  image_url,
                  image_content: hashedContent,
                  ActiveModels: activeModels,
                },
              ],
              unSuccessImages: [],
              emptyImages: [],
            });
            if (newScrapedImages) {
              return res.status(200).json({
                success: true,
                message: "New document created with the image",
                image: {
                  image_url,
                  ActiveModels: activeModels,
                },
              });
            }
          }
        }
      }
    } catch (err) {
      console.log(err, "Internal Server Error");
      return res.status(400).json({
        success: false,
        message: err,
      });
    }
  }
);

//get website link and scrape images
async function crawlWebsite(
  driver,
  baseUrl,
  visitedUrls = new Set(),
  notVisitedUrls = new Set()
) {
  while (notVisitedUrls.size > 0) {
    const currentUrl = notVisitedUrls.values().next().value; // Get the first URL from notVisitedUrls
    notVisitedUrls.delete(currentUrl); // Remove the current URL from notVisitedUrls

    if (visitedUrls.has(currentUrl)) continue; // Skip if already visited

    let page;
    try {
      // Navigate to current URL
      await driver.get(currentUrl);

      // Wait for the page to load completely
      await driver.wait(until.elementLocated(By.tagName("body")), 10000);

      // Add current URL to visitedUrls
      visitedUrls.add(currentUrl);

      // Extract URLs from the page
      const urls = await driver.executeScript(() => {
        const anchors = Array.from(document.querySelectorAll("a[href]"));
        return anchors
          .map((anchor) => anchor.href)
          .filter(
            (url) =>
              !url.includes("#!") &&
              !url.includes("#") &&
              !url.includes("search") &&
              !url.includes("404")
          );
      });

      // Scrape images from the page
      const scrapImages = await driver.executeScript(async () => {
        const images = Array.from(document.querySelectorAll("img"))
          .filter((img) => {
            const src = img.src.toLowerCase();
            return (
              src.includes("https") &&
              img.naturalWidth > 200 &&
              img.naturalHeight > 200 &&
              !/(logo|icon|arrow|map|button|btn|avatar|badge|member|svg)/.test(
                src
              )
            );
          })
          .map((img) => img.src);

        return images;
      });

      for (const imageUrl of scrapImages) {
        try {
          const response = await axios.post(
            `${process.env.BACKEND_URL}api/widget/getScrapedimages`,
            {
              image_url: imageUrl,
              domain_url: currentUrl,
            },
            {
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
          const data = response?.data;
          console.log("Done", imageUrl, data);
        } catch (error) {
          console.log({
            success: false,
            imageUrl,
            error: error?.response?.data,
          });
        }
      }

      // Iterate through the collected image URLs and make a POST request for each image

      // Filter out internal URLs and remove duplicates
      const internalUrls = urls.filter(
        (url) => url.startsWith(baseUrl) && !visitedUrls.has(url)
      );

      const internalUrlsSet = new Set(internalUrls);
      const uniqueInternalUrls = [...internalUrlsSet];
      console.log(
        "URLs found on",
        currentUrl,
        ":",
        uniqueInternalUrls,
        scrapImages
      );

      // Add internal URLs to the list of notVisitedUrls
      uniqueInternalUrls.forEach((url) => notVisitedUrls.add(url));
    } catch (error) {
      console.error("Error while crawling:", error);
    } finally {
      if (page) {
        await page
          .close()
          .catch((error) => console.error("Error while closing page:", error));
      }
    }
  }
}
//main
async function main(websiteUrl) {
  // Launch headless Chrome browser
  const options = new chrome.Options();
  options.addArguments("--headless");
  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();
  const visitedUrls = new Set();
  const notVisitedUrls = new Set([websiteUrl]); // Start with the provided websiteUrl

  await crawlWebsite(driver, websiteUrl, visitedUrls, notVisitedUrls);

  await driver.quit();

  console.log("Visited URLs:", visitedUrls);
  console.log("Not Visited URLs:", notVisitedUrls);

  return { visitedUrls, notVisitedUrls };
}

// Define scrapeImages function
exports.crawlUrls = catchAsyncErrors(async (req, res, next) => {
  try {
    const { websiteUrl } = req.query;
    const { visitedUrls, notVisitedUrls } = await main(websiteUrl);
    console.log("Visited URLs s:", visitedUrls);
    console.log("Not Visited URLs s:", notVisitedUrls);

    return res.status(200).json({
      success: true,
      message: "Urls Scraping Done",
      visitedUrls: Array.from(visitedUrls),
      notVisitedUrls: Array.from(notVisitedUrls),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

exports.usageByUser = catchAsyncErrors(async (req, res, next) => {
  const { userId } = req.query;
  const result = {};
  try {
    const user = await WidgetUserModel.findById(userId);
    const usage = await UserLinks.find({ userId });
    if (usage) {
      result.user = user;
      result.usage = usage.map((u) => {
        return {
          id: u?._id,
          date: u?.createdAt,
          model: u?.optJson?.model,
          appUrl: u?.optJson?.apiFields?.app_URL,
        };
      });
      res.status(200).json({
        success: true,
        result,
      });
    } else {
      res.status(200).json({
        success: false,
        message: "No usage found",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

exports.isDoorinsiderAdmin = catchAsyncErrors(async (req, res, next) => {
  let flag = false;
  try {
    const widgetData = await WidgetModel.findOne({
      jsfile: req.user.user?.joinedOrigin,
    });

    if (widgetData) {
      widgetData?.domain.forEach((d) => {
        if (d.includes("doorinsider")) {
          flag = true;
        }
      });

      res.status(200).json({
        success: true,
        flag,
      });
    } else {
      res.status(200).json({
        success: false,
        message: "No widget found",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

exports.modelsRunningByDate = catchAsyncErrors(async (req, res) => {
  const { startDate, endDate } = req.query;
  const { userId } = req.params;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const results = [];

  try {
    for (
      let date = new Date(start);
      date <= end;
      date.setDate(date.getDate() + 1)
    ) {
      const currentDateEnd = new Date(date);
      currentDateEnd.setDate(currentDateEnd.getDate() + 1);
      const pipeline1 = [
        {
          $match: {
            createdAt: {
              $gte: new Date(date),
              $lt: currentDateEnd,
            },
            "optJson.model": "decluttering",
            "optJson.apiFields.app_URL": {
              $regex: /en\/properties|fr\/annonces/,
            },
            ...(userId && { userId }),
          },
        },
        {
          $group: {
            _id: "$optJson.apiFields.app_URL",
            count: { $sum: 1 },
          },
        },
      ];
      const pipeline2 = [
        {
          $match: {
            createdAt: {
              $gte: new Date(date),
              $lt: currentDateEnd,
            },
            "optJson.model": "virtual staging",
            "optJson.apiFields.app_URL": {
              $regex: /en\/properties|fr\/annonces/,
            },
            ...(userId && { userId }),
          },
        },
        {
          $group: {
            _id: "$optJson.apiFields.app_URL",
            count: { $sum: 1 },
          },
        },
      ];
      const [result1, result2] = await Promise.all([
        userlinksModel.aggregate(pipeline1),
        userlinksModel.aggregate(pipeline2),
      ]);

      results.push({
        date: new Date(date).toISOString().split("T")[0],
        website: "Doorinsider",
        Decluttering_Count: result1,
        VirtualStaging_Count: result2,
      });
    }

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      success: false,
      message: err,
    });
  }
});

// model usage
exports.usageByModel = catchAsyncErrors(async (req, res, next) => {
  try {
    // const usage = await UserLinks.find({
    //   "optJson.model": "virtual renovation",
    // });
    const usage = await UserLinks.aggregate([
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 },
        },
      },
    ]);
    if (usage) {
      const workbook = new excelJS.Workbook();
      let worksheet = workbook.addWorksheet("Usage");
      worksheet.columns = [
        { header: "Id", key: "id" },
        { header: "date", key: "date" },
        { header: "model", key: "model" },
        { header: "image", key: "image" },
        { header: "perview", key: "perview" },
      ];

      const result = usage.map((u) => {
        return {
          id: u?._id,
          date: u?.createdAt,
          model: u?.optJson?.model,
          image: u?.optJson?.apiFields?.app_URL,
          perview: u?.optJson?.perview,
        };
      });
      worksheet.addRows(result);

      // Write the workbook to a file
      const filename = "renovation.xlsx";
      workbook.xlsx
        .writeFile(filename)
        .then(() => {
          res.status(200).json({
            count: result?.length,
            usage,
          });
        })
        .catch((error) => {
          console.error("Error creating Excel file:", error);
        });
    } else {
      res.status(200).json({
        success: false,
        message: "No usage found",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});
