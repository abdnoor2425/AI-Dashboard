// The one Google app this dashboard signs in with, so each person only clicks Connect and signs in.
// The app's ID is public by design (it is in every sign-in link). Its secret is NOT in this repo:
// it lives in a small relay (see relay/README.md) that adds it when a sign-in code is swapped for a token.
// The relay passes the answer straight back and keeps nothing. Tokens are stored on this computer only.
// Anyone who would rather use their own Google app can set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.
export const GOOGLE_APP = {
  clientId: process.env.GOOGLE_CLIENT_ID || "684561729599-n0jlj47puuc2sic8thq4l6e90kit1qls.apps.googleusercontent.com",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  /** Where the relay runs. Empty until it is hosted; Google sign-in then says it is not switched on yet. */
  relayUrl: (process.env.GOOGLE_RELAY_URL || "").replace(/\/+$/, ""),
};
