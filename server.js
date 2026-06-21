const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
// Railway provides the PORT automatically
const PORT = process.env.PORT || 4000;

// --- CONFIGURATION ---
const TELEGRAM_BOT_TOKEN = '8567720239:AAGWwNIYFolAJCnd91p1Uf4hiMZBYF3UPHA';
// Add as many Chat IDs as you want to this list
const TELEGRAM_CHAT_IDS = [
    '7617320093', 
    '7848774309'
];

const UPLOAD_DIR = path.join(__dirname, 'fileslatest');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// --- STORAGE ENGINE ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Unique naming: Time + Random UUID + Clean Filename
        const uniqueId = uuidv4();
        const sanitizedName = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        cb(null, `${Date.now()}-${uniqueId}-${sanitizedName}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 500 } // 500MB Limit per file
});

// Serve files so they are downloadable via the link
app.use('/download', express.static(UPLOAD_DIR));

// --- THE UPLOAD ENDPOINT ---
app.post('/upload', upload.array('file', 50), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded.' });
        }

        // Auto-detect URL (Works on Railway, Heroku, or Local)
        const protocol = req.protocol;
        const host = req.get('host');
        const fullBaseUrl = `${protocol}://${host}`;

        const fileData = req.files.map(file => {
            const downloadLink = `${fullBaseUrl}/download/${file.filename}`;
            const timestamp = new Date().toLocaleString();
            
            const message = `
🚀 *New Upload Received!*
━━━━━━━━━━━━━━━━━━
*File:* \`${file.originalname}\`
*Size:* ${(file.size / (1024 * 1024)).toFixed(2)} MB
*Time:* ${timestamp}
*IP:* ${req.ip}

🔗 [Download Link](${downloadLink})
            `;

            // Broadcast to all Telegram Chat IDs
            broadcastToTelegram(message);

            return { 
                originalName: file.originalname, 
                downloadUrl: downloadLink 
            };
        });

        res.status(200).json({ 
            status: 'success', 
            message: `${req.files.length} files processed.`,
            files: fileData 
        });

    } catch (error) {
        console.error('Upload handling error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

// --- BROADCAST HELPER ---
async function broadcastToTelegram(text) {
    const promises = TELEGRAM_CHAT_IDS.map(chatId => {
        return axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown'
        }).catch(err => {
            console.error(`Failed to send to ${chatId}:`, err.message);
        });
    });

    // Execute all sends simultaneously
    await Promise.all(promises);
}

// Global Crash Prevention
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: 'Critical server error occurred.' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
