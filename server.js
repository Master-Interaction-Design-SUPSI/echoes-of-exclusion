const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const sharp = require('sharp');
const Replicate = require("replicate");
const { readFile } = require("fs/promises");
const WebSocket = require('ws');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

const app = express();
const port = 8080;
const wss = new WebSocket.Server({ port: "8081" });

app.use(cors());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: './temp-uploads/',
    filename: (req, file, cb) => cb(null, `imageUpload_${Date.now()}${path.extname(file.originalname)}`)
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const isValid = allowedTypes.test(path.extname(file.originalname).toLowerCase()) && 
                        (allowedTypes.test(file.mimetype) || file.mimetype === 'image/heic');
        cb(isValid ? null : new Error('Invalid file type'), isValid);
    }
});

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

function sendStatus(progress, message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ progress, message }));
        }
    });
}

const logToFile = (directory, message) => {
    const logPath = path.join(directory, 'log.txt');
    fs.appendFile(logPath, `${new Date().toISOString()} - ${message}\n`, err => {
        if (err) console.error('Log error:', err);
    });
};

app.post('/upload', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const timestamp = Date.now().toString();
    const inputPath = path.join(__dirname, 'temp-uploads', req.file.filename);
    const outputFolder = path.join(__dirname, 'public', 'generated', timestamp);
    fs.mkdirSync(outputFolder, { recursive: true });

    const outputPath = path.join(outputFolder, `originalImage.webp`);

    try {
        await sharp(inputPath).rotate().toFile(outputPath);
        fs.unlink(inputPath, (err) => {
            if (err) {
                logToFile(outputFolder, 'Error removing file:', err);
            } else {
                logToFile(outputFolder, 'File removed successfully from temporary folder.');
            }
        });
        sendStatus(10, 'Image uploaded and converted');
        logToFile(outputFolder, 'File uploaded and converted.');
        res.json({ message: 'File uploaded and converted successfully', filename: req.file.filename });
        generateDescription(outputPath, outputFolder);
    } catch (error) {
        res.status(500).json({ message: 'Error processing image' });
    }
});

async function generateDescription(imagePath, folderPath) {
    logToFile(folderPath, 'Description generation started.');
    if (!process.env.REPLICATE_API_TOKEN) return console.error('Missing API token');

    try {
        const input = { image: await readFile(imagePath), prompt: "Describe this image", max_tokens: 1024 };
        const prediction = await replicate.predictions.create({
            version: "19be067b589d0c46689ffa7cc3ff321447a441986a7694c01225973c2eafc874",
            input
        });

        let completed;
        let oldStatus;
        while (true) {
            completed = await replicate.predictions.get(prediction.id);
            if (["failed", "succeeded", "canceled"].includes(completed.status)) break;
            if (completed.status !== oldStatus) logToFile(folderPath, 'Description Generation progress: ' + completed.status);
            await new Promise(res => setTimeout(res, 500));
            oldStatus = completed.status;
        }

        if (completed.status === 'succeeded' && completed.output) {
            fs.writeFile(path.join(folderPath, 'description.txt'), completed.output.join('').replace(/\n/g, ' '), err => {
                if (err) logToFile(folderPath, `Error writing description: ${err}`);
                else logToFile(folderPath, 'Description generated successfully.');
                sendStatus(40, 'Image description generated');
                generateImage(folderPath);
            });
        } else {
            logToFile(folderPath, `Description Generation failed: ${completed.status}`);
        }
    } catch (error) {
        logToFile(folderPath, `Error generating description: ${error}`);
        sendStatus(0, 'ERROR: There was a problem while generating the description, please try again.');
        fs.rmdir(folderPath, { recursive: true }, (err) => {
            if (err) {
                console.error(`Error removing folder: ${err}`);
            } else {
                console.log('Folder removed successfully.' + folderPath);
            }
        });
    }
}

async function generateImage(folderPath) {
    logToFile(folderPath, 'Image generation started.');
    if (!process.env.REPLICATE_API_TOKEN) return console.error('Missing API token');

    try {
        const input = {
            prompt: String(fs.readFileSync(path.join(folderPath, 'description.txt'), 'utf8')),
            go_fast: true,
            guidance: 3.5,
            num_outputs: 1,
            aspect_ratio: "1:1",
            output_format: "webp",
            output_quality: 80,
            prompt_strength: 0.8,
            num_inference_steps: 28
        };

        const prediction = await replicate.predictions.create({
            model: "black-forest-labs/flux-dev",
            input
        });

        let completed;
        let oldStatus;
        while (true) {
            completed = await replicate.predictions.get(prediction.id);
            if (["failed", "succeeded", "canceled"].includes(completed.status)) break;
            if (completed.status !== oldStatus) logToFile(folderPath, 'Image Generation progress: ' + completed.status);
            await new Promise(res => setTimeout(res, 500));
            oldStatus = completed.status;
        }

        if (completed.status === 'succeeded' && completed.output) {
            const outputPath = path.join(folderPath, 'generatedImage.webp');
            const imageUrl = completed.output[0];

            const response = await fetch(imageUrl);
            const buffer = Buffer.from(await response.arrayBuffer());

            fs.writeFile(outputPath, buffer, err => {
                if (err) {
                    logToFile(folderPath, `Error saving generated image: ${err}`);
                } else {
                    logToFile(folderPath, 'Generated image saved successfully.');
                    sendStatus(70, 'AI image has been generated');
                    generateAudio(folderPath);
                }
            });
        } else {
            logToFile(folderPath, `Generation failed: ${completed.status}`);
        }
    } catch (error) {
        logToFile(folderPath, `Error generating image: ${error}`);
        sendStatus(0, 'ERROR: There was a problem while generating the image, please try again.');
        fs.rmdir(folderPath, { recursive: true }, (err) => {
            if (err) {
                console.error(`Error removing folder: ${err}`);
            } else {
                console.log('Folder removed successfully.' + folderPath);
            }
        });
    }
}

async function generateAudio(folderPath) {
    logToFile(folderPath, 'Audio generation started.');
    if (!process.env.REPLICATE_API_TOKEN) return console.error('Missing API token');

    try {
        const availableSpeakers = ["matteoAudio.wav", "cathrineAudio.wav", "hannaAudio.wav", "aminaAudio.wav"];

        const randomIndex = Math.floor(Math.random() * availableSpeakers.length);
        const data = (await readFile(path.join(__dirname, "audioBase", availableSpeakers[randomIndex]))).toString("base64");
        const speaker = `data:application/octet-stream;base64,${data}`;

        const input = {
            text: String(fs.readFileSync(path.join(folderPath, 'description.txt'), 'utf8')),
            language: "en",
            speaker: speaker
        };

        const prediction = await replicate.predictions.create({
            version: "684bc3855b37866c0c65add2ff39c78f3dea3f4ff103a436465326e0f438d55e",
            input
        });

        let completed;
        let oldStatus;
        while (true) {
            completed = await replicate.predictions.get(prediction.id);
            if (["failed", "succeeded", "canceled"].includes(completed.status)) break;
            if (completed.status !== oldStatus) logToFile(folderPath, 'Audio Generation progress: ' + completed.status);
            await new Promise(res => setTimeout(res, 500));
            oldStatus = completed.status;
        }

        if (completed.status === 'succeeded' && completed.output) {
            const audioOutputPath = path.join(folderPath, 'audioGenerated.wav');
            const audioUrl = completed.output;

            const audioResponse = await fetch(audioUrl);
            const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

            fs.writeFile(audioOutputPath, audioBuffer, 'binary', err => {
                if (err) {
                    logToFile(folderPath, `Error saving generated audio: ${err}`);
                } else {
                    sendStatus(100, 'Audio description has been generated');
                    logToFile(folderPath, 'Generated audio saved successfully.');
                }
            });
        } else {
            logToFile(folderPath, `Generation failed: ${completed.status}`);
        }
    } catch (error) {
        logToFile(folderPath, `Error generating audio: ${error}`);
        sendStatus(0, 'ERROR: There was a problem while generating the audio, please try again.');
        fs.rmdir(folderPath, { recursive: true }, (err) => {
            if (err) {
                console.error(`Error removing folder: ${err}`);
            } else {
                console.log('Folder removed successfully.' + folderPath);
            }
        });
    }
}

// Endpoint to get the latest generated folders
app.get('/get-latest-folders', (req, res) => {
    const generatedPath = path.join(__dirname, 'public', 'generated');
    
    fs.readdir(generatedPath, async (err, folders) => {
        if (err) {
            return res.status(500).json({ error: 'Unable to read generated folder' });
        }
        
        // Filter folders that contain "audioGenerated.wav"
        const latestFolders = [];
        for (const folder of folders) {
            const folderPath = path.join(generatedPath, folder);
            if (fs.statSync(folderPath).isDirectory()) {
                const audioFilePath = path.join(folderPath, 'audioGenerated.wav');
                if (fs.existsSync(audioFilePath)) {
                    latestFolders.push(folder);
                }
            }
        }

        // Sort folders by timestamp (descending order) and get the latest images
        const correctFolders = latestFolders
            .filter(folder => fs.statSync(path.join(generatedPath, folder)).isDirectory())
            .sort((a, b) => b.localeCompare(a))
            .slice(0, 3) //Here change to retrieve as many images as you want
            .sort((a, b) => a.localeCompare(b));

        res.json(correctFolders);
    });
});

app.listen(port, "0.0.0.0", () => console.log(`Server running at http://localhost:${port}`));