const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

async function sendStatusEmail(to, complaintId, status) {
  try {
    await transporter.sendMail({
      from: `"CivicFix" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Your complaint #${complaintId.slice(0, 8)} status: ${status}`,
      html: `<p>Your complaint status has been updated to <strong>${status}</strong>.</p>
             <p>Log in to CivicFix to view the details.</p>`,
    });
  } catch (err) {
    console.error('Email send error:', err.message);
  }
}

module.exports = { sendStatusEmail };
