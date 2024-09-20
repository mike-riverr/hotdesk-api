const { google } = require('googleapis');

// Load service account credentials from environment variables
const serviceAccount = {
  client_email: process.env.SERVICE_ACCOUNT_EMAIL,
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
};

// Create a JWT client for machine-to-machine authentication
const jwtClient = new google.auth.JWT(
  serviceAccount.client_email,
  null,
  serviceAccount.private_key,
  ['https://www.googleapis.com/auth/calendar.readonly']  // Define the required scopes
);

exports.handler = async (event, context) => {
  try {
    const calendar = google.calendar({ version: 'v3', auth: jwtClient });

    const calendarId = event.queryStringParameters.calendarId || 'primary';
    const now = new Date().toISOString();

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

    const workingLocationEvents = events.filter(event => event.eventType === 'workingLocation');

    if (workingLocationEvents.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ working_location: 'No working location events found for today' }),
      };
    }

    const mostRecentWorkingLocation = workingLocationEvents.sort((a, b) => new Date(b.updated) - new Date(a.updated))[0];
    const workingLocation = mostRecentWorkingLocation.summary || 'No working location summary found';

    return {
      statusCode: 200,
      body: JSON.stringify({ working_location: workingLocation }),
    };
  } catch (error) {
    console.error('Error fetching working location:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error fetching working location' }),
    };
  }
};
