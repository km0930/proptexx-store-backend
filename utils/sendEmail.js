const nodeMailer = require("nodemailer");
const sendEmail = async (options) => {
  const transporter = nodeMailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    service: process.env.SMTP_SERVICE,
    auth: {
      user: process.env.SMTP_MAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  transporter.verify(async function (error, success) {
    if (error) {
      console.log("email not found");
    } else {
      const mailOptions = {
        from: process.env.SMTP_EMAIL,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
</head>
<body style="background-color: #F2F5F8; margin: 0; padding: 20px 0px; font-family: Arial, sans-serif;">
    <div style="max-width: 600px; width: 90%; margin: 20px auto 10px auto; padding: 0px; background-color: #ffffff; border-top: 5px solid #0233E4;">
        <div style="max-width: 80%; width: 100%; padding: 15px 0px; border-bottom: 1px solid #ebebeb; margin:auto">
            <img src="https://storage.googleapis.com/proptexx-store-images/logos/Logo.png" style="margin: auto; display: flex; height: 55px; max-width: 180px; object-fit: contain; object-position: center;" alt="proptexx">
        </div>
        <div style="padding: 40px 20px;">
          <p style="color: #535258; line-height: 1.4rem; text-align: start;">${
            options.message
          }</p>  
         ${
           options?.click &&
           ` <div>
               <span style="font-size: 1.4rem; font-weight: 500; color: #484850; font-weight: 600;">
                 <a
                   target="_blank"
                   href=${options.url}
                   style="text-decoration: none; color: #5476ef;"
                 >
                   Click here
                 </a>
                 ${options.click}
               </span>
               <br />
               <br />
               <p style="margin: 0px; font-size: 0.85rem; color: #535258;">
                 Link will expire in 24 hours.
               </p>
             </div>`
         }
         ${
           options?.otp &&
           ` <div style="background-color:#F2F5F8;padding:5px; text-align:center;">
              <span style="font-size: 1.4rem; font-weight: 500; color: #484850; font-weight: 600;">
                
                OTP: ${options.otp}
              </span>
            </div>`
         }
            <p style="margin-top: 40px; margin-bottom: 0px; font-size: 0.9rem; color:#595762;">If you didn't request this or believe there's been a mistake, please contact our support team immediately at <a href="mailto:support@proptexx.com" style="color: #3f61dc; text-decoration: none;">support@proptexx.com.</a></p>
            <p style="font-size: 0.9rem; color: #595762;">Kind regards,<br/>The PropTexx Team.</p>
        </div>
    </div>
    <footer style="max-width: 500px; width: 85%; margin: 20px auto; text-align: center; margin-bottom: 50px;">
        <div style="max-width: 400px; margin: auto; margin-top: 30px;">
          <span style="font-size: 1.1rem; color: rgb(79, 79, 92); padding-bottom: 10px; line-height: 35px;">Proptexx, Inc.</span><br/>
          <span style="font-size: 0.9rem; line-height: 1.3rem; letter-spacing: 0.2px; color: #7e7e99;">PropTexx Inc, 548 Market St PMB 44712 San Francisco, California 94104-5401</span>
        </div>
        <div style="float: left; justify-content: center; align-items: center; margin-top: 10px; margin: auto; width: 100%; margin-top: 10px;">
            <a href="https://www.facebook.com/PropTexx/" style="margin: 0px 5px 0px auto;"><img style="height: 23px; opacity: 0.8;" src="https://storage.googleapis.com/store-gallery-img-results/email_verification_icons/fb.png" alt="fb"></a>
            <a href="https://www.linkedin.com/company/proptexx" style="margin: 0px auto 0px 5px;"><img style="height: 23px; opacity: 0.8;" src="https://storage.googleapis.com/store-gallery-img-results/email_verification_icons/linkedin.png" alt="linkedin"></a>
        </div>
    </footer>
</body>
</html>
        `,
      };

      await transporter.sendMail(mailOptions);
    }
  });
};

module.exports = sendEmail;
