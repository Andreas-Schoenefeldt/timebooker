const http = require('http');

const ALLOWED_ORIGINS = ['https://time2.emphasize.de'];

// Create an instance of the http server to handle HTTP requests
const app = http.createServer((req, res) => {
    // Set a response type of plain text for the response

    const headers = {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
    }

    if (ALLOWED_ORIGINS.indexOf(req.headers.origin) > -1) {
        headers['Access-Control-Allow-Origin'] = req.headers.origin;
    }

    res.writeHead(200, headers);

    if (req.method === 'POST') {

        let body = [];

        req.on('data', (chunk) => {
            body.push(chunk);
        }).on('end', async () => {
            const { DateTime } = require('luxon');
            const fs = require('fs');
            const processReport = require("./src/processReport");

            /**
             * @type {{entries: {key: number, start: number, name: string, time: number, sum?: number, info: string}[]}}
             */
            const result = JSON.parse(Buffer.concat(body).toString().trim());
            const clean = [];

            console.log('Received invoice data, processing it.');

            // body = JSON.parse(body);
            // Now you can work with the request body
            result.entries.forEach((entry) => {

                if (entry.time && entry.name && entry.name !== 'Pause') {
                    const minutes = Math.round(entry.time / 60000);

                    if (minutes > 1) {
                        const day = DateTime.fromMillis(entry.start);

                        clean.push({
                            date: day.toFormat('yyyy-MM-dd'),
                            activity: entry.name,
                            minutes: minutes,
                            info: entry.info ? entry.info.split('|').map((e) => {
                                // fixing some common spelling issues of myself
                                return e.trim().replace('teh', 'the')
                            }) : []
                        })
                    }
                }
            });

            const reportsPath =  './data/report.json';

            await fs.promises.writeFile(reportsPath, JSON.stringify(clean, null, 2));

            await processReport(reportsPath);

            console.log('Report processed and written.');

            // Send back a response and end the connection
            res.end('Body received');
        });
    }

    res.end(req.method + ' - Thank you, the rest then locally. <h1><a href="https://time2.emphasize.de">Back to the reporting!</a></h1>');
});

// Start the server on port 10801
app.listen(10801, '127.0.0.1');
console.log('Node server running on port 10801. Waiting for invoice export from https://time2.emphasize.de/');