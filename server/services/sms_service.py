"""
Production SMS Gateway Service for Student Complaint Box
Supports:
1. Fast2SMS (Indian SMS Gateway - https://www.fast2sms.com)
2. Twilio SMS (https://www.twilio.com)
3. Cryptographically secure random OTP generation
"""
import os
import secrets
import json
import urllib.request
import urllib.parse
import base64
import logging

logger = logging.getLogger('sms_service')


def generate_secure_otp() -> str:
    """Generate a cryptographically secure 6-digit random OTP."""
    code = secrets.randbelow(900000) + 100000
    return str(code)


def is_sms_configured() -> bool:
    """Check if any real SMS gateway credentials are configured."""
    fast2sms_key = os.environ.get('FAST2SMS_API_KEY', '').strip()
    twilio_sid = os.environ.get('TWILIO_ACCOUNT_SID', '').strip()
    twilio_token = os.environ.get('TWILIO_AUTH_TOKEN', '').strip()
    twilio_from = os.environ.get('TWILIO_PHONE_NUMBER', '').strip()

    if fast2sms_key and fast2sms_key != 'your_fast2sms_api_key_here':
        return True
    if twilio_sid and twilio_token and twilio_from and 'your_' not in twilio_sid:
        return True
    return False


def get_configured_provider_name() -> str:
    """Return the name of the currently configured SMS provider."""
    fast2sms_key = os.environ.get('FAST2SMS_API_KEY', '').strip()
    twilio_sid = os.environ.get('TWILIO_ACCOUNT_SID', '').strip()

    if fast2sms_key and fast2sms_key != 'your_fast2sms_api_key_here':
        return 'Fast2SMS'
    if twilio_sid and 'your_' not in twilio_sid:
        return 'Twilio'
    return 'None'


def send_via_fast2sms(clean_mobile: str, otp_code: str) -> tuple[bool, str]:
    """Send SMS OTP via Fast2SMS API to Indian numbers."""
    api_key = os.environ.get('FAST2SMS_API_KEY', '').strip()
    if not api_key:
        return False, "FAST2SMS_API_KEY not configured"

    try:
        url = "https://www.fast2sms.com/dev/bulkV2"
        headers = {
            "authorization": api_key,
            "Content-Type": "application/json"
        }
        # Fast2SMS OTP route
        payload = json.dumps({
            "route": "otp",
            "variables_values": otp_code,
            "numbers": clean_mobile
        }).encode('utf-8')

        req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode('utf-8')
            data = json.loads(resp_body)
            if data.get('return') is True or resp.status == 200:
                print(f"[FAST2SMS SUCCESS] Real SMS delivered to +91 {clean_mobile}")
                return True, "SMS delivered successfully via Fast2SMS"
            else:
                msg = data.get('message', ['Failed to send SMS'])
                err = msg[0] if isinstance(msg, list) else str(msg)
                print(f"[FAST2SMS WARNING] Gateway returned: {err}")
                return False, f"Fast2SMS error: {err}"
    except Exception as e:
        print(f"[FAST2SMS EXCEPTION] Failed to dispatch SMS: {e}")
        return False, f"SMS Gateway error: {str(e)}"


def send_via_twilio(clean_mobile: str, otp_code: str) -> tuple[bool, str]:
    """Send SMS OTP via Twilio REST API."""
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID', '').strip()
    auth_token = os.environ.get('TWILIO_AUTH_TOKEN', '').strip()
    from_number = os.environ.get('TWILIO_PHONE_NUMBER', '').strip()

    if not account_sid or not auth_token or not from_number:
        return False, "Twilio credentials incomplete"

    try:
        to_number = f"+91{clean_mobile}" if not clean_mobile.startswith('+') else clean_mobile
        message_body = f"Your Student Complaint Box verification code is: {otp_code}. Valid for 5 minutes."

        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        data = urllib.parse.urlencode({
            'To': to_number,
            'From': from_number,
            'Body': message_body
        }).encode('utf-8')

        auth_str = f"{account_sid}:{auth_token}"
        auth_b64 = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
        headers = {
            'Authorization': f'Basic {auth_b64}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status in (200, 201):
                print(f"[TWILIO SUCCESS] Real SMS delivered to {to_number}")
                return True, "SMS delivered successfully via Twilio"
            return False, f"Twilio returned status {resp.status}"
    except Exception as e:
        print(f"[TWILIO EXCEPTION] Failed to dispatch SMS: {e}")
        return False, f"Twilio SMS error: {str(e)}"


def dispatch_otp_sms(clean_mobile: str, otp_code: str, role: str = 'user', is_test_environment: bool = False) -> tuple[bool, str]:
    """
    Main entry point for dispatching OTP SMS.
    Attempts configured real providers (Fast2SMS -> Twilio).
    If no provider configured:
      - If in test mode or ALLOW_CONSOLE_OTP_FOR_TESTS=true, logs to terminal console for local debugging.
      - Otherwise, fails with informative configuration error.
    """
    fast2sms_key = os.environ.get('FAST2SMS_API_KEY', '').strip()
    twilio_sid = os.environ.get('TWILIO_ACCOUNT_SID', '').strip()

    # 1. Try Fast2SMS
    if fast2sms_key and fast2sms_key != 'your_fast2sms_api_key_here':
        success, msg = send_via_fast2sms(clean_mobile, otp_code)
        if success:
            return True, msg
        # If fast2sms failed, log and check if twilio is also configured
        logger.warning(f"Fast2SMS delivery failed: {msg}")

    # 2. Try Twilio
    if twilio_sid and 'your_' not in twilio_sid:
        success, msg = send_via_twilio(clean_mobile, otp_code)
        if success:
            return True, msg
        logger.warning(f"Twilio delivery failed: {msg}")

    # 3. Check for test / console development fallback
    allow_console = os.environ.get('ALLOW_CONSOLE_OTP_FOR_TESTS', 'false').lower() == 'true'
    if is_test_environment or allow_console:
        print(f"\n=======================================================")
        print(f"[SMS GATEWAY - TEST CONSOLE LOG]")
        print(f"Recipient : +91 {clean_mobile} ({role.upper()})")
        print(f"Code      : {otp_code}")
        print(f"Validity  : 5 Minutes (Strict)")
        print(f"Notice    : This is logged to terminal ONLY. Never sent to client/browser.")
        print(f"=======================================================\n")
        return True, "Real-time verification code generated and logged to secure server console."

    return False, "SMS provider is not configured. Please add FAST2SMS_API_KEY or TWILIO credentials in server/.env to send real SMS OTPs."
