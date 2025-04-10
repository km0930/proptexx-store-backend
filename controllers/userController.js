const {
  userModel,
  userlinksModel,
  creditusageModel,
  UserCreditsModel,
} = require("../models");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const sendToken = require("../utils/sendToken");
const sendEmail = require("../utils/sendEmail");
const ErrorHander = require("../utils/errorHandler");
const crypto = require("crypto");
const { default: axios } = require("axios");
const { find } = require("../models/UserModel");
const { PLANS } = require("../utils/constants");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.register = catchAsyncErrors(async (req, res, next) => {
  const {
    name,
    email,
    password,
    typeOfBusiness,
    countryCode,
    ip,
    googleId,
    linkedInId,
    whiteLabeled,
  } = req.body;
  let user;
  user = await userModel.findOne({ email })?.populate("usercredit");
  if (user && user.emailVerifiedAt) {
    if ((googleId || linkedInId) && !user.whiteLabeled) {
      const updatedUser = await userModel
        .findOneAndUpdate(
          { email: user.email },
          { lastLoggedIn: new Date(), lastLoggedOut: null },
          {
            new: true,
          }
        )
        ?.populate("usercredit");
      sendToken(updatedUser, 200, res);
    } else if (user.whiteLabeled) {
      return res.status(400).json({
        success: false,
        message: "User not exist",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }
  } else {
    let newUser;
    if (!user) {
      if (googleId || linkedInId) {
        const customer = await stripe.customers.create(
          {
            email,
          },
          {
            apiKey: process.env.STRIPE_SECRET_KEY,
          }
        );
        user;

        if (linkedInId) {
          newUser = await userModel.create({
            name,
            email,
            linkedInId,
            emailVerifiedAt: Date.now(),
            stripeCustomerId: customer.id,
            lastLoggedIn: new Date(),
            lastLoggedOut: null,
            credits: 0,
            creditsPerMonth: 5
          });
        } else {
          newUser = await userModel.create({
            name,
            email,
            googleId,
            emailVerifiedAt: Date.now(),
            stripeCustomerId: customer.id,
            lastLoggedIn: new Date(),
            lastLoggedOut: null,
            credits: 0,
            creditsPerMonth: 5
          });
        }
        const credituser = await UserCreditsModel.create({
          userId: newUser._id,
        });
        newUser.usercredit = credituser._id;
        await newUser.save({ validateBeforeSave: false });
      } else if (whiteLabeled) {
        newUser = await userModel.create({
          name,
          email,
          password,
          typeOfBusiness,
          countryCode,
          whiteLabeled,
          emailVerifiedAt: Date.now(),
          ip,
          lastLoggedIn: new Date(),
          lastLoggedOut: null,
          credits: 0,
          creditsPerMonth: 5
        });
      } else {
        newUser = await userModel.create({
          name,
          email,
          password,
          typeOfBusiness,
          countryCode,
          ip,
          lastLoggedIn: new Date(),
          lastLoggedOut: null,
          credits: 0,
          creditsPerMonth: 5
        });
      }
    } else newUser = user;
    // Get ResetPassword Token
    if (!googleId && !linkedInId) {
      const verifyAccount = newUser.getResetPasswordToken();
      await newUser.save({ validateBeforeSave: false });
      const verificationUrl = `${process.env.FRONTEND_URL}/accountverification/${verifyAccount}`;
      try {
        await sendEmail({
          email: newUser.email,
          subject: `Welcome to Proptexx AI - Complete Your Verification!`,
          message:
            "Hi there,<br/><br/> Welcome aboard! We're thrilled to have you join the Proptexx AI community, where we blend the wonders of artificial intelligence with property technology to deliver unparalleled accuracy, speed, and assurance.",
          click: "to verify your account.",
          otp: "",
          url: verificationUrl,
        });
        res.status(200).json({
          success: true,
          message: `Email sent to ${newUser.email} successfully`,
        });
      } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({ validateBeforeSave: false });
        return next(new ErrorHander(error.message, 500));
      }
    } else {
      const populatedUser = await userModel
        .findById(newUser._id)
        .populate("usercredit");
      sendToken(populatedUser, 200, res);
    }
  }
});

// accountountverificatio verfication
exports.accountverification = catchAsyncErrors(async (req, res, next) => {
  const accountVerificationToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await userModel.findOne({
    resetPasswordToken: accountVerificationToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: "Reset Password Token is invalid or has been expired",
    });
  }

  // stripe customer id
  const customer = await stripe.customers.create(
    {
      email: user.email,
    },
    {
      apiKey: process.env.STRIPE_SECRET_KEY,
    }
  );

  const usercreditCreate = await UserCreditsModel.create({
    userId: user._id,
  });
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  user.stripeCustomerId = customer.id;
  user.usercredit = usercreditCreate._id;
  user.emailVerifiedAt = Date.now();
  const updatedUser = await user.save({ validateBeforeSave: false });
  const populatedUser = await userModel
    .findById(updatedUser._id)
    .populate("usercredit");
  sendToken(populatedUser, 200, res);
});

// login user
exports.login = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;
  const domain = [
    "https://axcelerateai-store.proptexx.com",
    "https://redfin-store.proptexx.ai",
  ].includes(req.headers.origin)
    ? true
    : false;
  if (!email || !password) {
    res.status(400).json({
      success: false,
      message: "Please Enter Email & Password",
    });
    return;
  }

  const user = await userModel
    .findOne({ email })
    .select("+password")
    .populate("usercredit");
  if (
    !user ||
    (user.whiteLabeled && !domain) ||
    (!user.whiteLabeled && domain) ||
    !user.emailVerifiedAt
  ) {
    return res.status(400).json({
      success: false,
      message: "User not found",
    });
  }
  let isPasswordMatched = false;
  if (user && user.password) {
    isPasswordMatched = await user.comparePassword(password);
  }

  if (!isPasswordMatched) {
    return res.status(400).json({
      success: false,
      message: "Invalid email or password",
    });
  }
  const updatedUser = await userModel
    .findOneAndUpdate(
      { email: user.email },
      { lastLoggedIn: new Date(), lastLoggedOut: null },
      {
        new: true,
      }
    )
    ?.populate("usercredit");
  sendToken(updatedUser, 200, res);
});

// Logout
exports.logout = catchAsyncErrors(async (req, res, next) => {
  const {
    body: { userId },
  } = req;
  if (!userId) {
    return res
      .status(403)
      .json({ success: false, message: "User ID not found" });
  }

  const user = await userModel.findOne({ _id: userId });
  if (user) await user?.logout();
  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: "Logged Out",
  });
});

// heartbeat
exports.heartbeat = catchAsyncErrors(async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(403).send("User ID not found");
    }

    const { lastLoggedOut } = await userModel.findById(userId);

    if (!lastLoggedOut) {
      await userModel.findByIdAndUpdate(userId, {
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

exports.forgotPassword = catchAsyncErrors(async (req, res, next) => {
  const user = await userModel.findOne({ email: req.body.email });

  if (!user) {
    res.status(400).json({
      success: false,
      message: "User not found",
    });
    return;
  }

  // Get ResetPassword Token
  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });
  const resetPasswordUrl = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;

  try {
    await sendEmail({
      email: user.email,
      subject: `Password Recovery`,
      message: "",
      otp: "",
      click: "to reset your password.",
      url: resetPasswordUrl,
    });

    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save({ validateBeforeSave: false });

    return next(new ErrorHander(error.message, 500));
  }
});

// Reset Password
exports.resetPassword = catchAsyncErrors(async (req, res, next) => {
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await userModel
    .findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    })
    .populate("usercredit");

  if (!user) {
    res.status(400).json({
      success: false,
      message: "Token has been expired",
    });
    return;
  }

  if (req.body.password !== req.body.confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Password not matched",
    });
  }

  lastLoggedIn = new Date();
  lastLoggedOut = null;
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  const updatedUser = await user.save();

  sendToken(updatedUser, 200, res);
});

// update User password
exports.updateUser = catchAsyncErrors(async (req, res, next) => {
  const { oldPassword, confirmPassword, newPassword } = req.body;
  const user = await userModel
    .findById(req.user.user._id)
    .select("+password")
    .populate("usercredit");
  if (user) {
    const isPasswordMatched = await user.comparePassword(oldPassword);

    if (!isPasswordMatched) {
      res.status(400).json({
        success: false,
        message: "Old password is incorrect",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: "password does not match",
      });
      return;
    }
    user.password = newPassword;
    await user.save();

    sendToken(user, 200, res);
  }
});

// get Single users
exports.getSingleUser = catchAsyncErrors(async (req, res, next) => {
  if (req?.user) {
    const user = await userModel
      .findOne({ email: req.user.user.email })
      .populate("usercredit");
    res.status(200).json({
      success: true,
      user,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "User not found",
    });
  }
});
// find all users
exports.findAllUsers = catchAsyncErrors(async (req, res, next) => {
  const { page, limit, sortBy, search, grid } = req.query;

  const options = { page, limit, sortBy, populate: "usercredit" };

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
    default:
      startDate = new Date(0);
      break;
  }
  endDate = new Date();

  filter.createdAt = { $gte: startDate, $lte: endDate };

  if (search && search.trim().length > 0) {
    const trimmedSearch = search.trim();
    const isId = /^[a-f\d]{24}$/i.test(trimmedSearch);
    const regexSearch = { $regex: trimmedSearch, $options: "i" };

    if (isId) {
      filter._id = trimmedSearch;
    } else {
      filter.name = regexSearch;
    }
  }

  // Assuming User is your user model with a planName and lastActive fields
  const result = await userModel.paginate(filter, options);

  // Dates for weekly and monthly calculations
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const PLANS = ["free", "pro", "premium", "power_user", "basic"];

  // overall
  const weeklyActiveOverall = await userModel.countDocuments({
    lastActive: { $gte: oneWeekAgo },
  });

  const monthlyActiveOverall = await userModel.countDocuments({
    lastActive: { $gte: oneMonthAgo },
  });

  const totalUsersOverall = await userModel.countDocuments({});

  // New users created in the last 24 hours, 7 days, and 30 days
  const newUsersLast1DayCount = await userModel.countDocuments({
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });

  const newUsersLast7DaysCount = await userModel.countDocuments({
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  });

  const newUsersLast30DaysCount = await userModel.countDocuments({
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  });

  const newUsersLast1Day = await userModel.paginate(
    {
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    options
  );

  const newUsersLast7Days = await userModel.paginate(
    {
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    options
  );

  const newUsersLast30Days = await userModel.paginate(
    {
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    options
  );

  const planAnalytics = {};

  for (const plan of PLANS) {
    if (plan === "all") continue;
    // weekly
    const weeklyActive = await userModel.countDocuments({
      planName: plan,
      lastActive: { $gte: oneWeekAgo },
    });
    // monthly
    const monthlyActive = await userModel.countDocuments({
      planName: plan,
      lastActive: { $gte: oneMonthAgo },
    });

    // Total users for a plan
    const totalUsers = await userModel.countDocuments({ planName: plan });

    // Add to analytics
    planAnalytics[plan] = {
      weeklyActive,
      monthlyActive,
      totalUsers,
    };
  }
  const analytics = {
    overall: {
      weeklyActive: weeklyActiveOverall,
      monthlyActive: monthlyActiveOverall,
      totalUsers: totalUsersOverall,
      newUsersLast1DayCount,
      newUsersLast7DaysCount,
      newUsersLast30DaysCount,
    },
    newUsers: {
      newUsersLast1Day,
      newUsersLast7Days,
      newUsersLast30Days,
    },
    planAnalytics, // Contains the weekly, monthly, and total count for each plan
  };

  // Add the plan analytics to the response
  res.status(200).json({
    success: true,
    data: result,
    analytics, // Contains the weekly, monthly, and total count for each plan
  });
});

// new users in a timeframe
exports.findNewUsersInTimeframe = catchAsyncErrors(async (req, res, next) => {
  const { start, end } = req.query;

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
  const newUsersInTimeframe = await userModel.find({
    createdAt: { $gte: startDate, $lte: endDate },
  });

  res.status(200).json({
    success: true,
    data: newUsersInTimeframe,
  });
});

// user usage
exports.userUsage = catchAsyncErrors(async (req, res, next) => {
  const { page, limit } = req.query;
  const userId = req.params.id;
  const options = { page, limit, lean: true }; // 'lean' for performance optimization

  // Get the paginated usage data for the user
  const usage = await userlinksModel.paginate({ userId }, options);

  if (req.user.user.role === "admin") {
    // Query to get all usage data for analytics (not paginated)
    const allUsage = await userlinksModel.find({ userId }).lean(); // 'lean' to get plain JavaScript objects

    // Initialize analytics data
    let totalActions = 0;
    let uniqueModels = new Set();
    let actionsPerModel = {};

    // Process the entire usage data for analytics
    allUsage.forEach((doc) => {
      totalActions++; // Increment total actions
      uniqueModels.add(doc.optJson.model); // Track unique models

      // Track actions per model
      actionsPerModel[doc.optJson.model] =
        (actionsPerModel[doc.optJson.model] || 0) + 1;
    });

    // Prepare the analytics data to be included in the response
    const analytics = {
      totalActions: totalActions,
      totalUniqueModels: uniqueModels.size,
      actionsPerModel: actionsPerModel,
    };

    // Send the paginated usage data along with the global analytics data
    res.status(200).json({
      success: true,
      usage, // This contains the paginated usage data
      analytics, // This contains the computed analytics for all data
    });
  } else {
    // If the user is not an admin, send an error response
    res.status(403).json({
      success: false,
      message: "Not authorized to view this data",
    });
  }
});

// signlr user usage
exports.singleUserUsage = catchAsyncErrors(async (req, res, next) => {
  const usage = await userlinksModel.find({ userId: req.user.user._id });
  const refIds = usage.map((u) => u.ref);

  const activeCreditUsages = await creditusageModel.find({
    _id: { $in: refIds },
    status: "active",
  });
  const activeRefIds = activeCreditUsages.map((usage) => usage._id.toString());
  const arr = usage.filter((u) => activeRefIds.includes(u.ref.toString()));
  if (usage.length > 0) {
    res.status(200).json({
      success: true,
      usage: arr,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "No record found",
    });
  }
});

// update crdits
exports.updateCredits = catchAsyncErrors(async (req, res, next) => {
  const response = await axios.post(
    "https://us-central1-lucid-box-387617.cloudfunctions.net/test-mongo-authorization",
    {
      instances: [
        {
          image_url:
            "https://storage.googleapis.com/axcelerate/sample-images/room_type.jpg",
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
  res.status(200).json({
    success: true,
    result: response.data,
  });
});

exports.testingApi = catchAsyncErrors(async (req, res, next) => {
  const users = await userModel.find();
  users.forEach(async (user) => {
    const getuserCredit = await UserCreditsModel.findOne({ userId: user._id });
    let userCredits;
    if (!getuserCredit) {
      userCredits = await UserCreditsModel.create({
        userId: user._id,
      });
    } else userCredits = getuserCredit;
    const newUser = await userModel.findById(user._id).populate("usercredit");
    newUser.usercredit = userCredits._id;
    await newUser.save();
  });
});

exports.getApiTrialUsers = catchAsyncErrors(async (req, res, next) => {
  const trialUsers = await UserCreditsModel.find({ isTrial: true })
    .select("userId")
    .populate({ path: "userId", select: "+password" })
    .exec();

  const apiUsers = await UserCreditsModel.find({ isApi: true })
    .select("userId")
    .populate({ path: "userId", select: "+password" })
    .exec();
  if (apiUsers?.length || trialUsers?.length) {
    res.status(200).json({
      success: true,
      trialUsers: trialUsers || null,
      apiUsers: apiUsers || null,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "no result found",
    });
  }
});
