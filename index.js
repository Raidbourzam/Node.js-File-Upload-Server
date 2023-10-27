const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    if (req.headers['content-type'].startsWith('multipart/form-data')) {
      let data = Buffer.from([]);
      let files = [];
      let totalSize = 0;
      let uploadedSize = 0;
      req.on('data', (chunk) => {
        data = Buffer.concat([data, chunk]);
      });
      req.on('end', () => {
        const boundary = req.headers['content-type'].match(/boundary=([^;]+)/)[1];
        const parts = data.toString().split(`--${boundary}`);
        for (let part of parts) {
          if (!part) continue;
          const lines = part.split('\r\n');
          const headers = lines[1].split(': ')[1].split('; ');
          const content = lines.slice(4, lines.length - 1).join('\r\n');
          const filenameHeader = headers.find((header) => header.startsWith('filename='));
          if (filenameHeader) {
            const fileName = filenameHeader.split('=')[1].replace(/"/g, '');
            const maxSize = 1024 * 1024; 
            const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif']; 
            if (content.length > maxSize) {
              res.statusCode = 400;
              res.end('File size exceeds the allowed limit.');
              return;
            }
            const fileExtension = path.extname(fileName).toLowerCase();
            if (!allowedTypes.includes(fileExtension)) {
              res.statusCode = 400;
              res.end('File type is not allowed.');
              return;
            }
            files.push({ name: fileName, content });
            totalSize += content.length;
          }
        }
        res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=updates');
        res.write(`--updates\r\n`);
        res.write(`Content-Type: application/json\r\n\r\n`);
        res.write(JSON.stringify({ progress: 0 }));
        res.write(`\r\n`);
        for (let file of files) {
          const filePath = path.join(__dirname, 'uploads', file.name);
          fs.writeFile(filePath, file.content, (err) => {
            if (err) {
              res.statusCode = 500;
              res.end('Error saving the file.');
              return;
            }
            uploadedSize += file.content.length;
            const progress = (uploadedSize / totalSize) * 100;
            res.write(`--updates\r\n`);
            res.write(`Content-Type: application/json\r\n\r\n`);
            res.write(JSON.stringify({ progress }));
            res.write(`\r\n`);
          });
        }
        res.write(`--updates--\r\n`);
        res.statusCode = 200;
        res.end('Files uploaded and saved!');
      });
    } else {
      res.statusCode = 400;
      res.end('Invalid content type. Use multipart/form-data.');
    }
  } else {
    res.statusCode = 405;
    res.end('Method not allowed.');
  }
});

server.listen(8000, () => {
  console.log('Server is running on port 8000');
});
