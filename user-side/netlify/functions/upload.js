// netlify/functions/upload.js
const { Client } = require('basic-ftp');
const multer = require('multer');
const upload = multer({ dest: '/tmp/' }); // Temp storage for uploaded files
const process = require('process');
const fs = require('fs');
const sharp = require('sharp');

exports.handler = async (event, context) => {
  return new Promise((resolve, reject) => {
    // Configure multer and process the file upload
    const multerHandler = upload.single('image');
    
    multerHandler(event, context, async (error) => {
      if (error) {
        return resolve({
          statusCode: 500,
          body: JSON.stringify({ message: 'File upload failed', error: error.message }),
        });
      }

      // Process the uploaded file
      const file = event.file;
      if (!file) {
        return resolve({
          statusCode: 400,
          body: 'Please upload a file.',
        });
      }

      try {
        const client = new Client();
        client.ftp.verbose = true;
        
        await client.access({
            host: "gvcw.ftp.infomaniak.com", // Replace with your FTP server's address
            user: "gvcw_maind2024", // Replace with your FTP username
            password: "Fj_xDNoteI2", // Replace with your FTP password
            secure: true, // Use FTPS if supported
        });

        // Compress and process the image
        const imagePath = `/tmp/${file.originalname}`;
        const compressedImageBuffer = await sharp(file.path)
          .resize(800)
          .toFile(imagePath);

        // Upload the compressed image
        await client.ensureDir("/echoes-of-exclusion");
        await client.uploadFrom(imagePath, `${file.originalname}`);
        await client.close();
        
        // Cleanup temp file
        fs.unlinkSync(imagePath);

        resolve({
          statusCode: 200,
          body: 'File uploaded successfully',
        });
      } catch (error) {
        console.error(error);
        resolve({
          statusCode: 500,
          body: JSON.stringify({ message: 'Failed to upload the file', error: error.message }),
        });
      }
    });
  });
};