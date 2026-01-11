const express = require('express');
const router = express.Router();
const upload = require('../config/s3'); // The Multer-S3 config

router.post('/', upload.single('file'), (req, res) => {
    if (req.file) {
        res.json({
            message: 'File uploaded successfully',
            fileUrl: req.file.location, // S3 URL
        });
    } else {
        res.status(400).json({ message: 'File upload failed' });
    }
});

module.exports = router;
