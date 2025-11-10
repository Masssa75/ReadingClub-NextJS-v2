const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
    const filePath = path.join(__dirname, 'index-1.4.html');

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500);
            res.end('Error loading file');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`\n🌐 Server running at: http://localhost:${PORT}`);
    console.log(`\n📚 Open this URL in your browser to avoid CORS issues`);
    console.log(`\nPress Ctrl+C to stop the server\n`);
});
