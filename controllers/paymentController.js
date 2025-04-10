const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { userModel, UserCreditsModel } = require("../models");
const UserCredits = require("../models/UserCredits");
const sendToken = require("../utils/sendToken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.processPayment = (async (req, res) => {
  const { user } = req.body;
  const domain = req.params.domain;
  let redirectUrl = '';
  switch (true) {
    case domain === 'ilist':
      redirectUrl = 'https://ilist.proptexx.ai';
      break;
    case domain === 'c21':
      redirectUrl = 'https://c21.proptexx.ai';
      break;
    case domain === 'cb':
      redirectUrl = 'https://cb.proptexx.ai';
      break;
    case domain === 'exp':
      redirectUrl = 'https://exp.proptexx.ai';
      break;
    case domain === 'kwcp':
      redirectUrl = 'https://kwcp.proptexx.ai';
      break;
    case domain === 'realsmart':
      redirectUrl = 'https://realsmart.proptexx.ai';
      break;
    case domain === 'viking':
      redirectUrl = 'https://viking.proptexx.ai';
      break;
    default:
      redirectUrl = 'https://ilist.proptexx.ai';
  }
  const { planName, planDuration, credits, price, prevPlan, priceId } =
    req.body;
  console.log('details', planName, planDuration, credits, price, prevPlan, priceId);
  let result;
  // let priceId = 'price_1QFwwmG7NVLOg4jtJqxu0ArC';  // temp price id in dev account
  if (user) {
    let tempStripeCustomerId = '';
    if (!user.stripeCustomerId) {
      const customer = await stripe.customers.create(
        {
          email: user.email,
        },
        {
          apiKey: process.env.STRIPE_SECRET_KEY,
        }
      );
      tempStripeCustomerId = customer.id;
      const tempUser = await userModel.findOne({ email: user.email });
      tempUser.stripeCustomerId = tempStripeCustomerId;
      await tempUser.save();
    }
    const subscriptions = await stripe.subscriptions.list({
      customer: user?.stripeCustomerId ?? tempStripeCustomerId,
    });

    // let id = 'cus_R8GMLVWR0EEJAg';
    // const subscriptions = await stripe.subscriptions.list({
    //   customer: user?.stripeCustomerId ?? id,
    // });
    if (prevPlan == "free") {
      result = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          allow_promotion_codes: true,
          success_url: `${redirectUrl}/success/${planDuration}_${credits}_${price}_${planName}`,
          cancel_url: `${redirectUrl}/cancel`,
          customer: user.stripeCustomerId ?? tempStripeCustomerId,
        },
        {
          apiKey: process.env.STRIPE_SECRET_KEY,
        }
      );
    } else {
      const subscription = subscriptions.data.find(
        (subscription) => subscription.status === "active"
      );

      const newPlan = await stripe.prices.retrieve(priceId);
      const newPlanAmount = newPlan.unit_amount;

      const today = new Date();
      const daysInMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      ).getDate();
      console.log('subscription data', subscription)
      const subscriptionCreatedDate = new Date(subscription.start_date * 1000);

      // Calculate the difference in days
      const differenceInTime =
        today.getTime() - subscriptionCreatedDate.getTime();
      const differenceInDays = differenceInTime / (1000 * 3600 * 24);
      const daysLeft = daysInMonth - differenceInDays;
      const proratedAmount = (daysLeft / daysInMonth) * newPlanAmount;
      const usedDays = differenceInDays?.toString().split(".")[0];

      const currentPlan = subscription.items.data[0].price;
      const priceDifference = newPlanAmount - currentPlan.unit_amount;
      await stripe.invoiceItems.create({
        customer: user?.stripeCustomerId ?? tempStripeCustomerId,
        amount: usedDays >= 20 ? Math.round(proratedAmount) : newPlanAmount,
        currency: "usd",
        description: "Prorated amount for the new plan",
      });

      // Immediately invoice the customer for the prorated amount
      const invoice = await stripe.invoices.create({
        customer: user?.stripeCustomerId ?? tempStripeCustomerId,
      });
      9;
      await stripe.invoices.pay(invoice.id);

      // Update the subscription to the new plan
      result = await stripe.subscriptions.update(subscription.id, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: priceId,
          },
        ],
      });
    }
  } else {
    res.status(400).json({
      success: false,
      message: "Please try again with valid stripe customer id",
    });
  }
  if (result) {
    res.status(200).json({
      success: true,
      result,
      message: `Thank you for puchasing ${planName} plan`,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "Please try again to subscribe to your plan",
    });
  }
});

// payment success
exports.paymentSuccess = (async (req, res, next) => {
  console.log('payment is successful')
  const { planName, planDuration, credits, price, user } = req.body;
  const tempUser = await userModel.findOne({ email: user.email });
  if (!tempUser) {
    res.status(400).json({
      success: false,
      message: `Please login first`,
    });
    return;
  }

  tempUser.planName = planName;
  // tempUser.price = price;
  tempUser.planDuration = planDuration;
  tempUser.creditsPerMonth += planDuration === "monthly" ? credits : credits * 12;
  tempUser.paymentCreatedAt = new Date();
  tempUser.paymentUpdatedAt = new Date();

  await tempUser.save();

  sendToken(tempUser, 200, res);
});

exports.subscriptionCancelation = (async (req, res, next) => {
  const user = req.user.user;
  const userDetail = await userModel.findOne({ email: user?.email });
  if (userDetail) {
    const subscriptions = await stripe.subscriptions.list({
      customer: user?.stripeCustomerId,
    });
    const subscription = subscriptions.data.find(
      (subscription) => subscription.status === "active"
    );
    const canceledSubscription = await stripe.subscriptions.del(
      subscription.id
    );
    if (canceledSubscription.collection_method == "charge_automatically") {
      userDetail.credits = 0;
      userDetail.creditsPerMonth = 0;
      userDetail.price = 0;
      userDetail.planName = "free";
      userDetail.planDuration = "";

      await userDetail.save();
      sendToken(userDetail, 200, res);
    } else {
      res.status(400).json({
        success: false,
        message: "subscription not cancelled",
      });
    }
  } else {
    res.status(400).json({
      success: false,
      message: "user not found",
    });
  }
});

// free trial
exports.paymentTrial = (async (req, res, next) => {
  const { name, email, password, credits } = req.body;
  const domain = req.params.domain;
  let redirectUrl = '';
  switch (true) {
    case domain === 'ilist':
      redirectUrl = 'https://ilist.proptexx.ai';
      break;
    case domain === 'c21':
      redirectUrl = 'https://c21.proptexx.ai';
      break;
    case domain === 'cb':
      redirectUrl = 'https://cb.proptexx.ai';
      break;
    case domain === 'exp':
      redirectUrl = 'https://exp.proptexx.ai';
      break;
    case domain === 'kwcp':
      redirectUrl = 'https://kwcp.proptexx.ai';
      break;
    case domain === 'realsmart':
      redirectUrl = 'https://realsmart.proptexx.ai';
      break;
    case domain === 'viking':
      redirectUrl = 'https://viking.proptexx.ai';
      break;
    default:
      redirectUrl = 'https://ilist.proptexx.ai';
  }
  const user = await userModel.findOne({ email }).populate("usercredit");
  let finalResult;
  if (!user) {
    const newUser = await userModel.create({
      name,
      email,
      password,
      credits: credits || 1000,
      creditsPerMonth: credits || 1000,
      price: 2990,
      emailVerifiedAt: Date.now(),
      planName: "power_user",
      planDuration: "monthly",
    });

    if (!newUser) {
      return res.status(400).json({
        success: false,
        message: "User not created",
      });
    }
    const res = await UserCreditsModel.create({
      userId: newUser?._id,
    });
    finalResult = newUser;
  } else if (user.usercredit?.isTrial && !credits) {
    return res.status(400).json({
      message: "user already in trial",
      success: false,
    });
  } else {
    user.credits = credits || 1000;
    user.creditsPerMonth = credits || 1000;
    user.price = 2990;
    user.planName = "power_user";
    user.planDuration = "monthly";
    await user.save();
    finalResult = user;
  }
  if (!credits) {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      success_url: redirectUrl,
      cancel_url: `${redirectUrl}/cancel`,
      line_items: [
        {
          price: process.env.TRIAL_PRICE_ID,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_settings: {
          end_behavior: {
            missing_payment_method: "cancel",
          },
        },
        trial_period_days: 30,
      },
      payment_method_collection: "if_required",
    });
    if (session) {
      await UserCreditsModel.updateOne(
        { userId: finalResult._id },
        {
          $set: { isTrial: true },
        }
      );
      return res.status(200).json({
        success: true,
        session,
      });
    }
  } else {
    await UserCreditsModel.updateOne(
      { userId: finalResult._id },
      {
        $set: { isApi: true },
      }
    );
    return res.status(200).json({
      success: true,
      api: finalResult._id,
    });
  }
});

exports.updateUser = (async (req, res, next) => {
  const { name, email, password, credits } = req.body;
  const userId = req.params.id;

  try {
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.name = name || user.name;
    user.email = email || user.email;

    if (password) {
      user.password = password;
    }

    if (credits) {
      user.creditsPerMonth = user.creditsPerMonth + (credits - user.credits);
      user.credits = credits || user.credits;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

exports.consumeCredits = (async (req, res, next) => {
  const { name, email, consumedCredits } = req.body;
  const userId = req.params.id;

  try {
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.name = name || user.name;
    user.email = email || user.email;

    if (consumedCredits) {
      user.creditsPerMonth -= consumedCredits;
      user.credits += consumedCredits;
    }
    await user.save();
    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Error updating user credit:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});
