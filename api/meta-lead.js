const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone) {
  // Strip all non-numeric characters
  let digits = phone.replace(/\D/g, '');
  // Convert 07xxx → 447xxx (UK mobile)
  if (digits.startsWith('07')) {
    digits = '44' + digits.substring(1);
  }
  // Strip leading + if already in +44 format (shouldn't happen after above, but safety)
  digits = digits.replace(/^\+/, '');
  return digits;
}

module.exports = async function handler(req, res) {
  // CORS — only allow requests from our own domain
  res.setHeader('Access-Control-Allow-Origin', 'https://www.premiumpowerwashing.co.uk');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_TOKEN;

  if (!pixelId || !accessToken) {
    console.error('[Meta CAPI] Missing META_PIXEL_ID or META_CAPI_TOKEN');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { email, phone, eventId, sourceUrl, userAgent } = req.body || {};

  // Get real client IP from Vercel's forwarded headers
  const clientIp =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    '';

  const userData = {};
  if (email)     userData.em = [sha256(normalizeEmail(email))];
  if (phone)     userData.ph = [sha256(normalizePhone(phone))];
  if (clientIp)  userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent = userAgent;

  const payload = {
    data: [
      {
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: sourceUrl || 'https://www.premiumpowerwashing.co.uk/',
        action_source: 'website',
        user_data: userData,
      },
    ],
    test_event_code: 'TEST78465', // TEMPORARY — remove after verifying in Test Events tab
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('[Meta CAPI] Error:', JSON.stringify(result));
      return res.status(502).json({ error: 'CAPI request failed' });
    }

    return res.status(200).json({ success: true, events_received: result.events_received });
  } catch (err) {
    console.error('[Meta CAPI] Fetch failed:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
};
