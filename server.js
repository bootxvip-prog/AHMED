require('dotenv').config();
const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const verify = client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID);

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const E164 = /^\+[1-9]\d{7,14}$/;
const limiter = (limit) => rateLimit({ windowMs: 10 * 60 * 1000, limit, message: { error: 'محاولات كثيرة، حاول بعد قليل' } });

// إرسال رمز التحقق برسالة SMS عادية
app.post('/api/send-code', limiter(5), async (req, res) => {
  const { phone } = req.body || {};
  if (!E164.test(phone || '')) return res.status(400).json({ error: 'رقم الهاتف غير صحيح' });
  try {
    await verify.verifications.create({ to: phone, channel: 'sms' });
    res.json({ ok: true });
  } catch (e) {
    console.error('send-code:', e.message);
    res.status(502).json({ error: 'تعذر إرسال الرسالة، تأكد من الرقم وحاول مرة أخرى' });
  }
});

// التحقق من الرمز
app.post('/api/verify-code', limiter(10), async (req, res) => {
  const { phone, code } = req.body || {};
  if (!E164.test(phone || '') || !/^\d{4,8}$/.test(code || '')) return res.status(400).json({ error: 'بيانات غير صحيحة' });
  try {
    const r = await verify.verificationChecks.create({ to: phone, code });
    if (r.status === 'approved') return res.json({ ok: true });
    res.status(400).json({ error: 'الرمز غير صحيح أو منتهي' });
  } catch (e) {
    console.error('verify-code:', e.message);
    res.status(400).json({ error: 'الرمز غير صحيح أو منتهي' });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('A server running'));
