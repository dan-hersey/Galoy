/**
 * ============================================
 * GALOY SURVEY - GOOGLE APPS SCRIPT
 * ============================================
 *
 * SETUP INSTRUCTIONS:
 *
 * 1. Create a new Google Sheet
 *    - Go to sheets.google.com and create a new spreadsheet
 *    - Name it "Digital Asset Readiness Survey Responses"
 *
 * 2. Add header row in Row 1:
 *    A1: Timestamp
 *    B1: First Name
 *    C1: Last Name
 *    D1: Email
 *    E1: Current Posture
 *    F1: Asset Ranking
 *    G1: Capabilities Interest
 *    H1: Strategy Leadership
 *
 * 3. Create Apps Script:
 *    - In Google Sheets, go to Extensions > Apps Script
 *    - Delete any existing code and paste this entire file
 *    - Click Save (Ctrl+S / Cmd+S)
 *
 * 4. Deploy as Web App:
 *    - Click "Deploy" > "New deployment"
 *    - Click the gear icon next to "Select type" and choose "Web app"
 *    - Description: "Survey Handler"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 *    - Click "Deploy"
 *    - Authorize the app when prompted
 *    - Copy the Web App URL
 *
 * 5. Update Survey Page:
 *    - Open survey.html
 *    - Find: const GOOGLE_SHEETS_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL';
 *    - Replace with your Web App URL
 *
 * 6. Test:
 *    - Submit a test response through the survey
 *    - Check your Google Sheet for the new row
 *
 * ============================================
 */

// Handle POST requests from the survey form
function doPost(e) {
  try {
    // Parse the incoming JSON data
    const data = JSON.parse(e.postData.contents);

    // Get the active spreadsheet and sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();

    // Prepare the row data
    const rowData = [
      data.timestamp || new Date().toISOString(),
      data.firstName || '',
      data.lastName || '',
      data.email || '',
      formatPosture(data.posture),
      data.ranking || '',
      data.capabilities || '',
      formatLeadership(data.leadership)
    ];

    // Append the row to the sheet
    sheet.appendRow(rowData);

    // Return success response
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: 'Data saved successfully' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Log the error and return error response
    console.error('Error processing survey submission:', error);

    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle GET requests (for testing)
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'active',
      message: 'Galoy Survey API is running. Use POST to submit data.'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Helper function to format posture values for readability
function formatPosture(value) {
  const mapping = {
    'actively_exploring': 'Actively exploring or building products',
    'monitoring': 'Monitoring / researching, no active initiatives',
    'not_priority': 'Not a priority right now'
  };
  return mapping[value] || value || '';
}

// Helper function to format leadership values for readability
function formatLeadership(value) {
  const mapping = {
    'executive': 'Executive leadership (CEO, CIO, COO)',
    'strategy': 'Strategy / innovation',
    'risk': 'Risk / compliance',
    'technology': 'Technology / core banking',
    'not_defined': 'Not formally defined yet'
  };
  return mapping[value] || value || '';
}

// Optional: Send email notification on new submission
function sendNotificationEmail(data) {
  // Uncomment and configure if you want email notifications
  /*
  const recipient = 'your-email@galoy.io';
  const subject = 'New Survey Response: ' + data.firstName + ' ' + data.lastName;
  const body = `
    New survey response received:

    Name: ${data.firstName} ${data.lastName}
    Email: ${data.email}
    Posture: ${formatPosture(data.posture)}
    Ranking: ${data.ranking}
    Capabilities: ${data.capabilities}
    Leadership: ${formatLeadership(data.leadership)}

    Submitted at: ${data.timestamp}
  `;

  MailApp.sendEmail(recipient, subject, body);
  */
}
