// The one Google app this dashboard signs in with, so each person only clicks Connect and signs in.
// It is a Google "Desktop app" client: Google treats its secret as not confidential, because it ships inside apps people run themselves.
// Anyone who would rather use their own Google app can set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.
export const GOOGLE_APP = {
  clientId: process.env.GOOGLE_CLIENT_ID || "684561729599-n0jlj47puuc2sic8thq4l6e90kit1qls.apps.googleusercontent.com",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "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",
};
