// This is an example, you would implement this in a route handler or script.
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config({ path: '.env.local' });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Replace this with the code you just got from the URL
const code = '4/0AVMBsJipRXkl3DFM3qrkiqC8w2axLuEIDhADDxkEk1cXXFxPlt6weJXQYDwuut6MtkTFNg'; 

async function getToken() {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    const { refresh_token } = tokens;

    console.log("------------------------------------------");
    console.log("Your Google Refresh Token:");
    console.log(refresh_token); 
    console.log("------------------------------------------");
    console.log("Save this token in your .env.local file.");
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
  }
}

getToken();