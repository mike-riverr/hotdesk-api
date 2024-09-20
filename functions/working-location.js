const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const CALENDAR_ID = 'primary';  // Default calendar

// Path to the service account key
const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, 'service-account-key.json');

// Load the service account key
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

// Create a JWT client for machine-to-machine authentication
const jwtClient = new google.auth.JWT(
  serviceAccount.client_email,
  null,
  serviceAccount.private_key,
  SCOPES
);

// Ensure authentication via the service account
jwtClient.authorize((err, tokens) => {
  if (err) {
    console.error('Error authenticating', err);
  } else {
    console.log('Successfully authenticated');
  }
});

// Netlify function handler
exports.handler = async (event, context) => {
  try {
    const calendar = google.calendar({ version: 'v3', auth: jwtClient });

    // Get the calendarId from query parameters, or default to 'primary'
    const calendarId = event.queryStringParameters.calendarId || CALENDAR_ID;
    const now = new Date().toISOString();

    // Fetch events from the calendar
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: now,
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items;

    if (!events || events.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ working_location: 'No working location found for today' }),
      };
    }

    // Filter for events with eventType 'workingLocation'
    const workingLocationEvents = events.filter(event => event.eventType === 'workingLocation');

    if (workingLocationEvents.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ working_location: 'No working location events found for today' }),
      };
    }

    // Sort by most recent event
    const mostRecentWorkingLocation = workingLocationEvents.sort((a, b) => new Date(b.updated) - new Date(a.updated))[0];
    const workingLocation = mostRecentWorkingLocation.summary || 'No working location summary found';

    return {
      statusCode: 200,
      body: JSON.stringify({ working_location: workingLocation }),
    };
  } catch (error) {
    console.error('Error fetching events', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error fetching working location' }),
    };
  }
};
