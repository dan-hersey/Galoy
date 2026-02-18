=============================================
GALOY SURVEY - WEBFLOW SETUP GUIDE
=============================================

This folder contains everything you need to add the Digital Asset
Readiness Survey to your Webflow site at galoy.io/survey


STEP 1: CREATE THE PAGE
-----------------------
1. In Webflow, go to Pages panel
2. Create a new page with slug: "survey"
3. This will make it available at galoy.io/survey


STEP 2: CONFIGURE THE PAGE BODY
-------------------------------
1. Select the Body element in the Navigator
2. Add a class called: survey-page-body
3. This gives the page the gradient background


STEP 3: ADD HEAD CODE (CSS)
---------------------------
1. Click the gear icon on your survey page (Page Settings)
2. Scroll to "Custom Code" section
3. In "Inside <head> tag" box, paste entire contents of:
   → 1-HEAD-CODE.html


STEP 4: ADD THE SURVEY (HTML)
-----------------------------
1. Delete any default content from the page
2. Add an "Embed" element (found in Add Elements → Components)
3. Double-click the Embed to open code editor
4. Paste entire contents of:
   → 2-EMBED-HTML.html

5. ⚠️ UPDATE THE LOGO URL:
   Find this line in the HTML:
   <img src="https://uploads-ssl.webflow.com/YOUR_SITE_ID/galoy-logo-white.svg"

   Replace with your actual logo URL from Webflow Assets


STEP 5: ADD FOOTER CODE (JavaScript)
------------------------------------
1. In Page Settings → Custom Code
2. In "Before </body> tag" box, paste entire contents of:
   → 3-FOOTER-CODE.html


STEP 6: SET UP GOOGLE SHEETS
----------------------------
1. Create a new Google Sheet with these headers in Row 1:
   A: Timestamp
   B: First Name
   C: Last Name
   D: Email
   E: Current Posture
   F: Asset Ranking
   G: Capabilities Interest
   H: Strategy Leadership

2. Go to Extensions → Apps Script

3. Paste the code from:
   → ../survey-google-apps-script.js

4. Click Deploy → New deployment → Web app
   - Execute as: Me
   - Who has access: Anyone
   - Click Deploy

5. Copy the Web App URL

6. In 3-FOOTER-CODE.html, find this line:
   const GOOGLE_SHEETS_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL';

   Replace with your Web App URL


STEP 7: PUBLISH
---------------
1. Save all changes in Webflow
2. Publish your site
3. Test the survey at galoy.io/survey


TROUBLESHOOTING
---------------
• Survey not showing? Check that the Embed element is visible
• Styles broken? Make sure all CSS is in Head Code, not Footer
• Form not submitting? Check browser console for errors
• Data not in Sheet? Verify the Google Apps Script URL is correct


FILES IN THIS FOLDER
--------------------
1-HEAD-CODE.html     → CSS styles (paste in Head Code)
2-EMBED-HTML.html    → Survey HTML (paste in Embed element)
3-FOOTER-CODE.html   → JavaScript (paste in Footer Code)
README.txt           → This file
