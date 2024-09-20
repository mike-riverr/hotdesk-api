const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { google } = require('googleapis');

const app = express();
app.use(bodyParser.json());  // Enable JSON parsing for incoming requests

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const CALENDAR_ID = 'primary';  // Default to 'primary' calendar, or set this to the specific calendar ID

// Load service account credentials from the key file
//const serviceAccount = require('./service-account-key.json');

const serviceAccount = {
  client_email: process.env.SERVICE_ACCOUNT_EMAIL,
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'), // Fix newlines
};

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
    console.log('Error authenticating', err);
    return;
  }
  console.log('Successfully authenticated');
});

// Fetch the working location from the specified calendar
app.get('/working-location', (req, res) => {
  // Use the authenticated JWT client to access the Google Calendar API
  const calendar = google.calendar({ version: 'v3', auth: jwtClient });

  const calendarId = req.query.calendarId || CALENDAR_ID;  // Use the provided calendarId, or default to 'primary'
  const now = new Date().toISOString();

  calendar.events.list({
    calendarId: calendarId,
    timeMin: now,
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, response) => {
    if (err) {
      return res.status(500).send('The API returned an error: ' + err);
    }

    const events = response.data.items;
    if (!events || events.length === 0) {
      return res.json({ working_location: 'No working location found for today' });
    }

    // Filter for events with eventType 'workingLocation'
    const workingLocationEvents = events.filter(event => event.eventType === 'workingLocation');
    
    if (workingLocationEvents.length === 0) {
      return res.json({ working_location: 'No working location events found for today' });
    }

    // Sort by most recent event
    const mostRecentWorkingLocation = workingLocationEvents.sort((a, b) => new Date(b.updated) - new Date(a.updated))[0];
    const workingLocation = mostRecentWorkingLocation.summary || 'No working location summary found';

    res.json({ working_location: workingLocation });
  });
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
