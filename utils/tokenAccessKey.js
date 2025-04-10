const { google, JWT } = require("google-auth-library");

async function getAccessToken() {
  const creds = {
    type: "service_account",
    project_id: "lucid-box-387617",
    private_key_id: "fdea055ffe792f53184d3d34e5f884bae857afb5",
    private_key:
      "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCoZPJZSunCD9c0\nZVveXgVKNTj11p4NcyJ3HKmbpC07jTTN2e692WctaCmmrmyvpVar/2WtefeKtEyP\nr/7LTKSli+OcPEr8W1JrBZdusT8a2k+WZym5J5dgGgLPSKZVFGG7N70pK6Puum4H\nez/WJsCmlqm2ZkU+d8WypBLN51dfyqGbNvKZah7ahYVGgYoECT7cYlB0igBWMVzt\nrj11ozVBB4OXCNISiBSviscR0PxwRbVPZYtUHZ3U4S89PrBaqt4FzLB+u7fAnJHj\nmW2vpDqMzGV+EB30/mlsGJWFWuvhNVSMVN1XeK8Psbu0qrFqYZoihFHp/h/N17X9\nYdBLdDjRAgMBAAECggEACcAnIY0fPBzAU4UNONL5Q9DRQJht2FXm7G5bIpNTCG5K\nrQMCEkmH8jrUYxW5XsIQUscoCT+NSjF6l60bYASbCcgv7Lp3xdUooIBvUmI2ZwjW\nOA13DrTkfLTC3gNtGLL0fgOKKyuvC04tm/aqtYzyxa6mivSQ7L8hEiESouwy7K2i\nIjiOZlzPERU+B7O9H5azvAQKTQk4LP3ka2a7glYw7qQ4TWW1O4IYLMtltvvbipax\n1kaTAc6krBtNV76PEvECRe7heYOCWLuwz0AYnp0DXLq8lch51bUFSqSF9FSFk6R3\n5vtr1BiiQl8vn/VDnWL+datlkj6zyDBwYiqS2nhOIQKBgQDatnhGRvIFvlNaXQSQ\nwPzzKGfwcfB3SNFp4DpYEhKarx5yjh+7u1ODq30Jm97sP379RaRIGRot5TcwGmB1\nOLgyerTQAoG3fU18NRUGt29nr3vSe4vyhtIq4E3vg+ZH0+fLyUObdXS0CglzNW23\nf9LIL+VKmdb5iOX2oxrRPtvKcQKBgQDFGl8dmAT9a7G3FgtpVXn9cUzR51X9J4cs\n3hOmCfFVHA0EstA1/HLqybiC83JeAoZKarF4bl7IzYJ6Aywo/oAR2M5KyOv892AZ\nRhPrq9yR831sNuhsxTgjd21Ce1dto2Dd+N/3BYgmUINAdrZAr069IAk5hPs6BpQ7\n3oUKsQ7EYQKBgQDPqA/qKdIAwgRB968uAQ4pkGOfV48IsoqiC9NZa09eroYqHebj\nR6izi07coLG3fVIFBupDyhGhIdCUS3bp1UCOLRMfrEGdBctb8spT5jZQK71UyxjE\n3F0PeIiGsKUj7X5XbnBSWeLETgNK75+MakCm8VKy0f3aTrCIy7Pal+P3AQKBgQCD\nYH+TtzdkP3tWQOBcVngYgYOlyZ+cPNOyCVhpbOkqRKc8wX9c7KcgblKJHoHVvbML\nOTCPyGlvSOQ2NZUiwfhVbQCcAm6hz7WDQx2WEZjUw8qO7c5gadhwc3MlRBdTYfn4\nGqIWAd7tQu8pcbcrSG6gSxE7ALN/ytDVUw20wa3JIQKBgGfdz4evbEckVYYSn5Mq\nWr77Vjgb8s9SHc9UcRN/EiAOf8nsttsvxcYb2Z6XAamLTlHjuB57IwmRbRM09rA9\ny8I343sLIZP6unHbx6+ixFvM5NWPnW2G4RdQnA3d10O99/rpKaa0iJTUGjWttWkQ\njjG4nXSFN6LDRIa0S6oqr/kC\n-----END PRIVATE KEY-----",
    client_email:
      "axcelerateai-laravel-backend@lucid-box-387617.iam.gserviceaccount.com",
    client_id: "106968764681944031736",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url:
      "https://www.googleapis.com/robot/v1/metadata/x509/axcelerateai-laravel-backend%40lucid-box-387617.iam.gserviceaccount.com",
    universe_domain: "googleapis.com",
  };

  const client = new JWT(
    creds.client_email,
    null,
    creds.private_key,
    ["https://www.googleapis.com/auth/cloud-platform"],
    null
  );

  await client.authorize();

  const { token } = await client.getAccessToken();
  return token;
}
module.exports = getAccessToken;
