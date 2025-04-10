const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");

require("dotenv").config();
const connectDatabase = require("./config/database");
const {
  userRoute,
  planRoute,
  modelsRoute,
  paymentRoutes,
  socialRoutes,
  widgetRoutes,
  docsRoutes,
  themeRoutes,
  contactRoutes,
} = require("./routes");
const cron = require("node-cron");
const sendEmail = require("./utils/sendEmail");
const { userModel, widgetModel, partnerModel } = require("./models");
const moment = require("moment");
const WidgetUser = require("./models/WidgetUser");
const scrapedImagesModel = require("./models/scrapedImages");
const { isActive } = require("./utils/userActivityCal");
const {
  USER_DEACTIVATION_CRON_FREQUENCY,
  ACTIVE_THRESHOLD,
} = require("./utils/constants");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
//db config
connectDatabase();

//middlwaresmodels/uploadjsfile
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser({ limit: "10mb" }));
app.use(bodyParser.json({ limit: "20mb" }));
app.use(bodyParser.urlencoded({ limit: "20mb", extended: true }));

const generateUniqueUUID = async () => {
  let uniqueID;
  let existingPartner;
  do {
    uniqueID = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    existingPartner = await partnerModel.findOne({ uuid: uniqueID }).exec();
  } while (existingPartner);
  return uniqueID;
}

//cron job
const notifyUpcomingSubscriptionExpiry = async () => {
  try {
    const currentDate = moment();

    // Find users with isApi set to true in the creditSchema
    const users = await userModel
      .find({
        planName: { $ne: "free" },
      })
      .populate({
        path: "usercredit", // Assuming 'usercredit' is the ref in the User schema
        select: "isApi",
      });

    // Use for...of loop to iterate asynchronously
    for (const user of users) {
      await processUser(user, currentDate);
    }

    const processUser = async (user, currentDate) => {
      let {
        planDuration,
        paymentCreatedAt,
        creditsPerMonth,
        paymentUpdatedAt,
        credits,
        usercredit,
        createdAt,
      } = user;
      paymentCreatedAt = paymentCreatedAt || createdAt;
      if (planDuration === "monthly") {
        // Check if monthly credits are exhausted
        if (
          creditsPerMonth <= 0 ||
          currentDate.isAfter(moment(paymentCreatedAt).add(1, "month"))
        ) {
          // Update plan to free
          user.planName = "free";
          user.creditsPerMonth = 0;
          user.credits = 0;
          user.price = 0;
          user.planDuration = "";
          user.paymentUpdatedAt = currentDate.toDate();
        }
      } else if (planDuration === "annual") {
        // Check if a month has passed since the last update
        const lastMonthUpdate = moment(paymentUpdatedAt).add(1, "month");
        // After every month, renew creditsPerMonth
        if (currentDate.isAfter(lastMonthUpdate)) {
          const remainingMonths = moment(paymentCreatedAt)
            .add(1, "year")
            .diff(currentDate, "months");
          const creditsToAdd = Math.floor(credits / remainingMonths);

          // Update creditsPerMonth and deduct credits
          user.creditsPerMonth = creditsToAdd;
          user.credits -= creditsToAdd;
          user.paymentUpdatedAt = currentDate.toDate();
        }

        // Check if yearly plan has expired
        if (currentDate.isAfter(moment(paymentCreatedAt).add(1, "year"))) {
          // Update plan to free
          user.planName = "free";
          user.credits = 0;
          user.creditsPerMonth = 0;
          user.price = 0;
          user.planDuration = "";
        }
      }

      // Save the updated user to the database
      await user.save();
    };
  } catch (error) {
    console.error("Error checking subscription expiry:", error.message);
  }
};
// Assuming this is the path to your utilities
const deactivateInactiveUsers = async () => {
  console.log(
    "Running daily inactive user check at:",
    new Date().toTimeString()
  );

  const inactiveSince = new Date(Date.now() - ACTIVE_THRESHOLD);

  try {
    const criteria = {
      lastActive: { $lt: inactiveSince },
      lastLoggedOut: null,
    };

    // Fetch only the _id fields because we don't need the other data
    const appUserIds = (await userModel.find(criteria, "_id")).map(
      (user) => user._id
    );
    const widgetUserIds = (await WidgetUser.find(criteria, "_id")).map(
      (user) => user._id
    );

    // Perform bulk updates to log out all inactive users at once
    if (appUserIds.length > 0) {
      await userModel.updateMany(
        { _id: { $in: appUserIds } },
        {
          lastLoggedOut: new Date(),
        }
      );
      appUserIds.forEach((userId) => {
        console.log(`App User ${userId} logged out due to inactivity.`);
      });
    }

    if (widgetUserIds.length > 0) {
      await WidgetUser.updateMany(
        { _id: { $in: widgetUserIds } },
        {
          lastLoggedOut: new Date(),
        }
      );
      widgetUserIds.forEach((userId) => {
        console.log(`Widget User ${userId} logged out due to inactivity.`);
      });
    }
  } catch (error) {
    console.error("Error in daily inactive user check:", error);
  }
};

const updateScrapedImages = async (req, res) => {
  const { url } = req.body;
  try {
    const documents = await scrapedImagesModel.find({
      "unSuccessImages.image_url": url,
    });

    if (documents) {
      documents.forEach((document) => {
        // Find the index of the object with the specified image_url in successImages
        const index = document.unSuccessImages.findIndex(
          (image) => image.image_url === url
        );

        // If the image_url exists in successImages, move the entire object to unSuccessImages
        if (index !== -1) {
          const imageToMove = document.unSuccessImages.splice(index, 1)[0]; // Remove the object from successImages
          document.successImages.push(imageToMove); // Push the object to unSuccessImages
          document.save();
        }
      });
      return res.status(200).json({
        success: true,
        message: "Image updated successfully",
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      success: false,
      message: err,
    });
  }
};

const getScrapedImages = async (req, res) => {
  const { domain_url } = req.body;
  console.log(domain_url);
  try {
    const documents = await scrapedImagesModel.find({
      domain_url: { $regex: domain_url },
    });
    if (documents) {
      return res.status(200).json({
        success: true,
        message: "Image fetched successfully",
        data: documents,
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      success: false,
      message: err,
    });
  }
};

const updatewidget = async (req, res) => {
  try {
    const result = await widgetModel.updateMany(
      {},
      {
        $set: {
          logoWithText:
            "https://storage.googleapis.com/proptexx-store-widget/duda-assets/nexalogo.png",
          logoIcon:
            "https://storage.googleapis.com/proptexx-store-widget/duda-assets/nexaicon.png",
        },
      }
    );
    if (result) {
      return res.status(200).json({
        success: true,
        message: "Widget updated successfully",
      });
    }
  } catch (err) {
    console.log(err);
  }
};

module.exports = {
  deactivateInactiveUsers,
};

cron.schedule("0 3 * * *", notifyUpcomingSubscriptionExpiry);
cron.schedule(USER_DEACTIVATION_CRON_FREQUENCY, deactivateInactiveUsers);

//prod test route
app.get("/test", (req, res) => {
  res.send("Hello World prod test route check done");
});

app.post("/updateScrapedImages", updateScrapedImages);

app.get("/getScrapedImages", getScrapedImages);

app.post("/updatewidget", updatewidget);

let ilistData = null;
let expData = null;
let vikingData = null;
let kwcpData = null;
let c21Data = null;
let realsmartData = null;
let cbData = null;
let realtyData = null;
let userDetails = null; // user detail information from CRM
let newCreatedUserDetails = null; // user detail information when signup api is called

app.post('/api/getDetailsIlist', (req, res) => {
  console.log('Received Payload:', req.body);
  if (req.body) {
    ilistData = req.body;
    res.status(200).json({ message: 'Data stored successfully', data: req.body });
  } else {
    res.status(400).json({ error: 'Invalid payload' });
  }
});

app.post('/api/getDetailsExp', (req, res) => {
  console.log('Received Payload:', req.body);
  if (req.body) {
    expData = req.body;
    res.status(200).json({ message: 'Data stored successfully', data: req.body });
  } else {
    res.status(400).json({ error: 'Invalid payload' });
  }
});

app.post('/api/getDetailsViking', (req, res) => {
  console.log('Received Payload:', req.body);
  if (req.body) {
    vikingData = req.body;
    res.status(200).json({ message: 'Data stored successfully', data: req.body });
  } else {
    res.status(400).json({ error: 'Invalid payload' });
  }
});
app.post('/api/getDetailsKwcp', (req, res) => {
  console.log('Received Payload:', req.body);
  if (req.body) {
    kwcpData = req.body;
    res.status(200).json({ message: 'Data stored successfully', data: req.body });
  } else {
    res.status(400).json({ error: 'Invalid payload' });
  }
});
app.post('/api/getDetailsC21', (req, res) => {
  console.log('Received Payload:', req.body);
  if (req.body) {
    c21Data = req.body;
    res.status(200).json({ message: 'Data stored successfully', data: req.body });
  } else {
    res.status(400).json({ error: 'Invalid payload' });
  }
});

app.post('/api/getDetailsCb', (req, res) => {
  console.log('Received Payload:', req.body);
  if (req.body) {
    cbData = req.body;
    res.status(200).json({ message: 'Data stored successfully', data: req.body });
  } else {
    res.status(400).json({ error: 'Invalid payload' });
  }
});

app.post('/api/getDetailsRealsmart', (req, res) => {
  console.log('Received Payload:', req.body);
  if (req.body) {
    realsmartData = req.body;
    res.status(200).json({ message: 'Data stored successfully', data: req.body });
  } else {
    res.status(400).json({ error: 'Invalid payload' });
  }
});

app.post('/api/getDetailsRealty', (req, res) => {
  if (req.body) {
    realtyData = req.body;
    res.status(200).json({ message: 'Data stored successfully', data: req.body });
  } else {
    res.status(400).json({ error: 'Invalid payload' });
  }
});

app.get('/api/getDetailsIlist', (req, res) => {
  if (ilistData) {
    res.status(200).json(ilistData);
  } else {
    res.status(404).json({ error: 'No data found' });
  }
});

app.get('/api/getDetailsExp', (req, res) => {
  if (expData) {
    res.status(200).json(expData);
  } else {
    res.status(404).json({ error: 'No data found' });
  }
});

app.get('/api/getDetailsViking', (req, res) => {
  if (vikingData) {
    res.status(200).json(vikingData);
  } else {
    res.status(404).json({ error: 'No data found' });
  }
});

app.get('/api/getDetailsKwcp', (req, res) => {
  if (kwcpData) {
    res.status(200).json(kwcpData);
  } else {
    res.status(404).json({ error: 'No data found' });
  }
});

app.get('/api/getDetailsC21', (req, res) => {
  if (c21Data) {
    res.status(200).json(c21Data);
  } else {
    res.status(404).json({ error: 'No data found' });
  }
});

app.get('/api/getDetailsCb', (req, res) => {
  if (cbData) {
    res.status(200).json(cbData);
  } else {
    res.status(404).json({ error: 'No data found' });
  }
});

app.get('/api/getDetailsRealsmart', (req, res) => {
  if (realsmartData) {
    res.status(200).json(realsmartData);
  } else {
    res.status(404).json({ error: 'No data found' });
  }
});

app.get('/api/getDetailsRealty', (req, res) => {
  if (realtyData) {
    res.status(200).json(realtyData);
  } else {
    res.status(404).json({ error: 'No data found' });
  }
});

// Get user details

app.get('/api/getUserDetail', (req, res) => {
  if (userDetails) {
    res.status(200).json(userDetails);
  } else {
    res.status(404).json({ error: 'No user data found' });
  }
});

// sign up

app.post('/api/signup', async (req, res) => {
  try {
    console.log('Received sign up Payload:', req.body);
    const { partner_token, name, email, typeOfBusiness, countryCode, countryLanguage, type, region_id } = req.body;

    const customer = await stripe.customers.create(
      {
        email: email,
      },
      {
        apiKey: process.env.STRIPE_SECRET_KEY,
      }
    );
    const uuid = await generateUniqueUUID();
    console.log('generated uuid', uuid);
    const userData = new userModel({
      name: name,
      email: email,
      password: "",
      typeOfBusiness: typeOfBusiness,
      countryCode: countryCode,
      countryLanguage: countryLanguage,
      countryPhone: "",
      stripeCustomerId: customer.id,
      rememberToken: "",
      ip: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      type: type,
      expiry: null,
      planName: "free",
      planDuration: null,
      price: 0,
      credits: 0,
      active: false,
      role: "user",
      creditsPerMonth: 5,
    });
    const updatedUser = await userData.save({ validateBeforeSave: false });
    const partnerData = new partnerModel({
      userId: updatedUser._id,
      uuid: uuid,
      appTheme: type,
      params: JSON.stringify({
        name: name,
        email: email,
        region_id: region_id,
        country_code: countryCode,
        language_code: countryLanguage,
        partner_token: partner_token,
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const savedPartner = await partnerData.save({ validateBeforeSave: false });
    console.log('saved new partner', savedPartner);
    const newUserDetails = {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      credits: updatedUser.credits,
      stripeCustomerId: updatedUser.stripeCustomerId,
      planName: updatedUser.planName,
      planDuration: updatedUser.planDuration,
      creditsPerMonth: updatedUser.creditsPerMonth,
      role: updatedUser.role,
      active: updatedUser.active,
      price: updatedUser.price,
    }
    console.log('new created user detail', newUserDetails)
    newCreatedUserDetails = newUserDetails;
    const user_ref = type + '-' + uuid;
    res.status(200).json({
      success: true,
      user_ref,
      email
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Store user details when log in the app

app.post('/api/getDetails', async (req, res) => {
  try {
    console.log('Received Payload:', req.body);
    const { userRef } = req.body;

    if (!userRef) {
      res.status(404).json({ error: 'No User found' });
    }

    const uuid = userRef.split('-')[1];
    const appTheme = userRef.split('-')[0];
    console.log('user ref', userRef)
    const userData = await partnerModel.findOne({ uuid, appTheme });
    if (userData) {
      const { params } = userData;
      console.log('user data', userData)
      const nameMatch = params.match(/"name":\s*"([^"]+)"/);
      const emailMatch = params.match(/"email":\s*"([^"]+)"/);
      const name = nameMatch ? nameMatch[1] : null;
      const email = emailMatch ? emailMatch[1] : null;
      const extractedUser = await userModel
      .findOne({ email })
      .select(
        'credits stripeCustomerId planName planDuration creditsPerMonth role active price countryLanguage'
      )
      .lean();

      if (!extractedUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      const {
        _id,
        credits,
        stripeCustomerId,
        planName,
        planDuration,
        creditsPerMonth,
        role,
        active,
        price,
        countryLanguage
      } = extractedUser;
      console.log('extracted user', countryLanguage);
      const details = {
        _id,
        name,
        email,
        credits,
        stripeCustomerId,
        planName,
        planDuration,
        creditsPerMonth,
        role,
        active,
        price,
        countryLanguage
      }

      console.log('User Details:', details);
      userDetails = details;
      res.status(200).json({
        success: true,
      });
    } else {
      console.log('User not found');
      const customer = await stripe.customers.create(
        {
          email: appTheme + uuid + "@proptexx.com",
        },
        {
          apiKey: process.env.STRIPE_SECRET_KEY,
        }
      );
      console.log('email', appTheme + uuid + "@proptexx.com");
      const userData = new userModel({
        name: "anonymous-" + userRef,
        email: appTheme + uuid + "@proptexx.com",
        password: "",
        typeOfBusiness: appTheme + "-agent",
        countryCode: "",
        countryLanguage: "",
        countryPhone: "",
        stripeCustomerId: customer.id,
        rememberToken: "",
        ip: "",
        createdAt: new Date(),
        updatedAt: null,
        type: appTheme,
        expiry: null,
        planName: "free",
        planDuration: null,
        price: 0,
        credits: 0,
        active: false,
        role: "user",
        creditsPerMonth: 5,
      });
      const updatedUser = await userData.save({ validateBeforeSave: false });
      const partnerData = new partnerModel({
        userId: updatedUser._id,
        uuid: uuid,
        appTheme: appTheme,
        params: JSON.stringify({
          name: updatedUser.name,
          email: updatedUser.email,
          region_id: "",
          country_code: "",
          language_code: "",
          partner_token: "",
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      const savedPartner = await partnerData.save({ validateBeforeSave: false });
      console.log('saved new partner', savedPartner);
      const newUserDetails = {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        credits: updatedUser.credits,
        stripeCustomerId: updatedUser.stripeCustomerId,
        planName: updatedUser.planName,
        planDuration: updatedUser.planDuration,
        creditsPerMonth: updatedUser.creditsPerMonth,
        role: updatedUser.role,
        active: updatedUser.active,
        price: updatedUser.price,
      }
      console.log('new created user detail', newUserDetails)
      userDetails = newUserDetails;
      res.status(200).json({
        success: true,
      });
    }
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use("/api/users", userRoute);
app.use("/api/plans", planRoute);
app.use("/api/models", modelsRoute);
app.use("/api/payment", paymentRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/widget", widgetRoutes);
app.use("/api/docs", docsRoutes);
app.use("/api/themes", themeRoutes);
app.use("/api/contacts", contactRoutes);

app.use("/image", express.static("image"));
app.use("/watermark", express.static("watermark"));
app.use("/watermark_image", express.static("watermark_image"));
//port
const PORT = process.env.PORT || 5000;

//listen
const server = app.listen(PORT, () => {
  console.log(`Server Running On Port ${PORT}`);
});

// Unhandled Promise Rejection
process.on("SIGTERM", (err) => {
  console.log(`Error: ${err.message}`);
  console.log(`Shutting down the server due to Unhandled Promise Rejection`);

  server.close(() => {
    process.exit(1);
  });
});
