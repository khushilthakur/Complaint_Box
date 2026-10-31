const https = require('https');

/**
 * Universal SMS Gateway Dispatcher
 * Supports:
 * 1. Fast2SMS (Indian SMS Gateway - Direct instant delivery to +91 numbers)
 *    Free account & API key at: https://www.fast2sms.com
 * 2. Twilio (International Gateway)
 *    Account at: https://www.twilio.com
 * 3. Development / Simulation Mode (Returns code on-screen & console so offline testing never gets blocked)
 */

/**
 * Send SMS via Fast2SMS (Indian SMS Gateway)
 * Documentation: https://docs.fast2sms.com
 */
async function sendViaFast2Sms(mobile, otpCode, apiKey) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      route: 'otp',
      variables_values: otpCode,
      numbers: mobile
    });

    const options = {
      hostname: 'www.fast2sms.com',
      port: 443,
      path: '/dev/bulkV2',
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.return === true || json.status_code === 200) {
            console.log(`[FAST2SMS SUCCESS] Delivered real OTP to +91 ${mobile}`);
            resolve({ success: true, provider: 'fast2sms', response: json });
          } else {
            console.warn(`[FAST2SMS FAILED] Gateway response: ${json.message || body}`);
            resolve({ success: false, error: json.message || 'Fast2SMS returned failure' });
          }
        } catch {
          resolve({ success: false, error: 'Failed to parse Fast2SMS response' });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[FAST2SMS ERROR]', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Send SMS via Twilio (International Gateway)
 * Documentation: https://www.twilio.com/docs/sms/api
 */
async function sendViaTwilio(mobile, otpCode, accountSid, authToken, fromNumber) {
  return new Promise((resolve) => {
    const toNumber = mobile.startsWith('+') ? mobile : `+91${mobile}`;
    const messageBody = `Your Student Complaint Box verification code is: ${otpCode}. Valid for 10 minutes.`;

    const postData = new URLSearchParams({
      To: toNumber,
      From: fromNumber,
      Body: messageBody
    }).toString();

    const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[TWILIO SUCCESS] Dispatched SMS to ${toNumber} (SID: ${json.sid})`);
            resolve({ success: true, provider: 'twilio', response: json });
          } else {
            console.warn(`[TWILIO FAILED] Error: ${json.message || body}`);
            resolve({ success: false, error: json.message || 'Twilio delivery failed' });
          }
        } catch {
          resolve({ success: false, error: 'Failed to parse Twilio response' });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[TWILIO ERROR]', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Main SMS Dispatcher
 */
exports.sendOtpSms = async (mobile, otpCode) => {
  const cleanMobile = mobile.replace(/[^0-9]/g, '');
  const tenDigitMobile = cleanMobile.length > 10 ? cleanMobile.slice(-10) : cleanMobile;

  // 1. Try Fast2SMS (Indian Gateway)
  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  if (fast2smsKey && !fast2smsKey.includes('your_fast2sms') && !fast2smsKey.includes('PASTE_')) {
    console.log(`[SMS SERVICE] Dispatching REAL SMS via Fast2SMS to +91 ${tenDigitMobile}...`);
    const result = await sendViaFast2Sms(tenDigitMobile, otpCode, fast2smsKey.trim());
    if (result.success) {
      return {
        delivered: true,
        provider: 'fast2sms',
        isDevMode: false
      };
    }
    console.warn(`[SMS SERVICE] Fast2SMS dispatch failed (${result.error}). Falling back...`);
  }

  // 2. Try Twilio (International Gateway)
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  if (twilioSid && twilioAuth && twilioFrom && !twilioSid.includes('PASTE_')) {
    console.log(`[SMS SERVICE] Dispatching REAL SMS via Twilio to +91 ${tenDigitMobile}...`);
    const result = await sendViaTwilio(tenDigitMobile, otpCode, twilioSid.trim(), twilioAuth.trim(), twilioFrom.trim());
    if (result.success) {
      return {
        delivered: true,
        provider: 'twilio',
        isDevMode: false
      };
    }
    console.warn(`[SMS SERVICE] Twilio dispatch failed (${result.error}). Falling back...`);
  }

  // 3. Fallback / Development Simulation mode
  console.log(`[SMS SIMULATOR] Real SMS Gateway key (FAST2SMS_API_KEY or TWILIO_ACCOUNT_SID) not set in environment.`);
  console.log(`[SMS SIMULATOR] >>> OTP for +91 ${tenDigitMobile} is: [${otpCode}] <<<`);

  return {
    delivered: false,
    provider: 'simulator',
    isDevMode: true
  };
};
