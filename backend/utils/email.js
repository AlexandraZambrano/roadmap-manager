import nodemailer from 'nodemailer';

// Create transporter
let transporter;
try {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  console.log(process.env.EMAIL_USER);
  console.log(process.env.EMAIL_PASSWORD);

} catch (error) {
  console.error('Failed to initialize email transporter:', error);
  transporter = null;
}

/**
 * Send password to teacher email
 * @param {string} email - Teacher's email
 * @param {string} name - Teacher's name
 * @param {string} password - Temporary password
 */
export async function sendPasswordEmail(email, name, password) {
  if (!transporter) {
    console.warn(`Email not sent to ${email} - email service not configured`);
    return false;
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'Bootcamp Manager <noreply@factoriaf5.com>',
      to: email,
      subject: 'Your Bootcamp Manager Account Credentials',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #ff4700; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Bootcamp Manager</h1>
          </div>
          <div style="background-color: #f5f5f5; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #333;">Hello <strong>${name}</strong>,</p>
            
            <p style="font-size: 14px; color: #666; margin: 20px 0;">
              Your account has been created in the Bootcamp Manager system. Use the credentials below to log in:
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ff4700;">
              <p style="margin: 10px 0; font-size: 14px;">
                <strong>Email:</strong> <code style="background-color: #f0f0f0; padding: 5px 10px; border-radius: 3px;">${email}</code>
              </p>
              <p style="margin: 10px 0; font-size: 14px;">
                <strong>Password:</strong> <code style="background-color: #f0f0f0; padding: 5px 10px; border-radius: 3px;">${password}</code>
              </p>
            </div>

            <p style="font-size: 14px; color: #666; margin: 20px 0;">
              <strong>Important:</strong> We recommend changing your password after your first login for security purposes.
            </p>

            <p style="font-size: 14px; color: #666; margin: 20px 0;">
              If you did not request this account or have any questions, please contact your administrator.
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              This is an automated email from Bootcamp Manager. Please do not reply to this email.
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Password email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

export default { sendPasswordEmail };
