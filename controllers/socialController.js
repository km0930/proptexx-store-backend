const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const axios = require("axios");
const sendToken = require("../utils/sendToken");
const { userModel } = require("../models");

exports.linkedinLogin = catchAsyncErrors(async (req, res, next) => {
  const response = await axios.post(
    "https://www.linkedin.com/oauth/v2/accessToken",
    {
      params: {
        grant_type: "authorization_code",
        code: "AQR1UjwFM7orhC4gUmMgdZjMe0dVs1MkbN2dL_qTSgS3iGepEfwJVPae1qTYwxoRfqJuRwL_MKZT-ZJ0-A9qKHPIh6hN2ZeGT6q-dxv2YDzVhoUDL5uAV6eg6iegZslCCgEGIdCsAypcZzEw3IgrLypykRzH-Mxu1nGX-VlmSAkFjfTPWRcv8f_NUVa-Eot9b81NcrUayINEQjsvMzw",
        redirect_uri: "http://localhost:3000/linkedin-callback",
        client_id: "77co7dnh73tuz4",
        client_secret: "W6mHrajdkzEo9dYJ",
      },
    }
  );

  //   const accessToken = response.data.access_token;
  //   const profileResponse = await axios.get(
  //     "https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName)",
  //     {
  //       headers: {
  //         Authorization: `Bearer ${accessToken}`,
  //       },
  //     }
  //   );

  //   const emailResponse = await axios.get(
  //     "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))",
  //     {
  //       headers: {
  //         Authorization: `Bearer ${accessToken}`,
  //       },
  //     }
  //   );

  //   const customer = await stripe.customers.create(
  //     {
  //       email: emailResponse.data.elements[0]["handle~"].emailAddress,
  //     },
  //     {
  //       apiKey: process.env.STRIPE_SECRET_KEY,
  //     }
  //   );

  //   const user = await userModel.create({
  //     name: `${profileResponse.data.localizedFirstName} ${profileResponse.data.localizedLastName}`,
  //     email: emailResponse.data.elements[0]["handle~"].emailAddress,
  //     linkedInId: profileResponse.data.id,
  //     emailVerifiedAt: Date.now(),
  //     stripeCustomerId: customer.id,
  //   });

  //   sendToken(user, 200, res);
});

// google api
exports.googleMapSearch = catchAsyncErrors(async (req, res, next) => {
  const response = await axios.get(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${req.body.search}&key=${process.env.GOOGLE_MAP_API}`,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  res.status(200).json({
    success: true,
    result: response?.data?.results,
  });
});
