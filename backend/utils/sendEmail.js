import nodemailer from 'nodemailer';

/**
 * Gửi email qua Nodemailer
 * @param {Object} options - { to, subject, html }
 */
const sendEmail = async ({ to, subject, html }) => {
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,       // smtp.gmail.com
        port: Number(process.env.EMAIL_PORT) || 587,
        secure: false,                       // true nếu port 465
        auth: {
            user: process.env.EMAIL_USER,   // email gửi
            pass: process.env.EMAIL_PASS,   // app password (Gmail)
        },
    });

    await transporter.sendMail({
        from: `"MangaShop" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
    });
};

export default sendEmail;