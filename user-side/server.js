const express = require('express');
const multer = require('multer');
const ftp = require('basic-ftp');
const sharp = require('sharp');

const app = express();
const upload = multer({ dest: 'uploads/' }); // This folder temporarily stores uploaded files

// Serve a simple form on the root path
app.get('/', (req, res) => {
  res.send(`
    <h2>Upload Image</h2>
    <form action="/upload" method="post" enctype="multipart/form-data">
      <input type="file" name="image" required>
      <button type="submit">Upload Image</button>
    </form>
  `);
});

// Handle file upload and FTP transfer
app.post('/upload', upload.single('image'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send('Please upload a file.');
  }

  try {
    const client = new ftp.Client();
    client.ftp.verbose = true; // Enable logging of FTP details

    await client.access({
      host: "gvcw.ftp.infomaniak.com", // Replace with your FTP server's address
      user: "gvcw_maind2024", // Replace with your FTP username
      password: "Fj_xDNoteI2", // Replace with your FTP password
      secure: true, // Use FTPS if supported
    });

    // Compress the image
    const compressedImageBuffer = await sharp(file.path)
      .resize(800); // Set the desired width (optional)

    // Upload the compressed image
    await client.ensureDir("/echoes-of-exclusion");
    await client.uploadFrom(compressedImageBuffer, `${file.originalname}`);
    await client.close();
    res.send('File uploaded successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to upload the file');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
