require('dotenv').config({ path: '.env.local' });
const sgMail = require('@sendgrid/mail');

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Usage: node scripts/send-test-email.js <recipient-email>');
    process.exit(1);
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail =
    process.env.SENDGRID_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    'noreply@northshoresignco.com';

  if (!apiKey) {
    console.error('SENDGRID_API_KEY is missing');
    process.exit(1);
  }

  sgMail.setApiKey(apiKey);

  await sgMail.send({
    to,
    from: fromEmail,
    subject: 'RightSignUp Email Test',
    html: '<p>This is a live SendGrid test from your local RightSignUp environment.</p>',
  });

  console.log('Test email sent successfully');
}

main().catch((error) => {
  console.error('Email test failed:', error?.message || error);
  process.exit(1);
});