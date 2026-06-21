const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/db');
const auth = require('../middleware/auth');

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'video_' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});

// File filter to restrict uploads to videos
const fileFilter = (req, file, cb) => {
  const allowedExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExts.includes(ext) || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only .mp4, .mov, .avi, .mkv, and .webm are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 1024 * 1024 * 1024 } // 1GB limit
});

// @route   POST api/videos/upload
// @desc    Upload performance video
// @access  Private
router.post('/upload', auth, (req, res) => {
  upload.single('video')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File is too large. Maximum size is 1GB.' });
      }
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file selected. Please upload a video file.' });
    }

    try {
      const userId = req.user.id;
      
      const filepath = `/uploads/${req.file.filename}`;
      const filename = req.file.filename;
      const original_name = req.file.originalname;
      const filesize = req.file.size;

      const result = await query.run(
        'INSERT INTO videos (user_id, filename, original_name, filepath, filesize) VALUES (?, ?, ?, ?, ?)',
        [userId, filename, original_name, filepath, filesize]
      );

      res.json({
        message: 'Video uploaded successfully',
        video: {
          id: result.lastID,
          user_id: userId,
          filename: filename,
          original_name: original_name,
          filepath: filepath,
          filesize: filesize
        }
      });
    } catch (dbErr) {
      console.error('Video Upload Error:', dbErr.message);
      res.status(500).json({ message: 'Server Error saving to database' });
    }
  });
});

// @route   GET api/videos
// @desc    Get all videos uploaded by current user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const videos = await query.all('SELECT * FROM videos WHERE user_id = ? ORDER BY uploaded_at DESC', [req.user.id]);
    res.json(videos || []);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   DELETE api/videos/:id
// @desc    Delete a video file and database record
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const video = await query.get('SELECT * FROM videos WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!video) return res.status(404).json({ message: 'Video not found' });

    // Delete file from local filesystem
    const localFilePath = path.join(__dirname, '..', video.filepath);
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    // Delete record from DB
    await query.run('DELETE FROM videos WHERE id = ?', [video.id]);

    res.json({ message: 'Video deleted successfully' });
  } catch (err) {
    console.error('Video Delete Error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
