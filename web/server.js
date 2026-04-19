import { createSession, createChannel } from 'better-sse';
import { Eta } from 'eta';
import express from 'express';
import { existsSync, readFileSync } from 'fs';
import https, { request } from 'https';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createLogStreamer } from './logStreamer.js';
import { LOG_PATH, isBooted, isConfigSaved, isLocalhostSetup, getConfig, saveConfigText, clearLog, sanitizeConfig } from './serverHelpers.js';
const fileName = fileURLToPath(import.meta.url);
const dirName = dirname(fileName);
// Constants
const SSL_CERT_KEY_PATH = '/app/certs/key.pem';
const SSL_CERT_PATH = '/app/certs/cert.pem';
// 10 minutes
const AUTO_FINALIZE_TIMEOUT_MS = 10 * 60 * 1000;
// Express setup
const app = express();
app.use(express.static(join(dirName, 'public')));
app.use('/codex-assets', express.static(join(dirName, 'node_modules', '@wikimedia', 'codex', 'dist')));
app.use(express.json());
// Eta setup
const eta = new Eta({
    views: join(dirName, 'views'),
    cache: false,
    useWith: true
});
const logChannel = createChannel();
// ---------- Routes ----------
app.get('/', async (req, res) => {
    try {
        const html = eta.render('index.eta', {
            isConfigSaved: isConfigSaved(),
            isBooted: isBooted(),
            isLocalhostSetup: isLocalhostSetup(),
            SERVER_IP: process.env.SERVER_IP
        });
        if (!html) {
            throw new Error('Eta render returned null');
        }
        res.type('html').send(html);
    }
    catch (err) {
        console.error('Failed to render template:', err);
        res.status(500).send('Template render error');
    }
});
// create and start the log streamer
const streamer = createLogStreamer(LOG_PATH);
streamer.start();
app.get('/log/stream', async (req, res) => {
    const session = await createSession(req, res);
    const lastId = typeof req.headers['last-event-id'] === 'string' ?
        req.headers['last-event-id'] : undefined;
    const unsubscribe = await streamer.register(session, lastId);
    req.on('close', unsubscribe);
});
app.post('/config', async (req, res) => {
    try {
        const { config, configText } = getConfig(req.body);
        saveConfigText(configText);
        console.log('.env file written successfully');
        res.status(200).json({ status: 'ok', config, configText });
    }
    catch (err) {
        console.error('Failed to write .env:', err);
        res.status(500).send('Failed to write .env');
    }
});
app.get('/config', async (req, res) => {
    try {
        const { config, configText } = getConfig();
        res.status(200).json({ config, configText });
    }
    catch (err) {
        console.error('Failed to read .env:', err);
        res.status(500).send('Failed to read .env');
    }
});
app.post('/finalize-setup', async (req, res) => {
    try {
        sanitizeConfig();
        clearLog();
        res.status(200).json({ status: 'finalized' });
        console.log('💤 Setup finalized. Exiting...');
        // eslint-disable-next-line n/no-process-exit
        setTimeout(() => process.exit(0), 300); // allow response to finish
    }
    catch (err) {
        console.error('❌ Finalize error:', err);
        res.status(500).send('Failed to finalize setup');
    }
});
if (!existsSync(SSL_CERT_PATH) || !existsSync(SSL_CERT_KEY_PATH)) {
    throw new Error('Not able to access SSL certificate or key in /app/certs');
}
const credentials = {
    cert: readFileSync(SSL_CERT_PATH),
    key: readFileSync(SSL_CERT_KEY_PATH)
};
https.createServer(credentials, app).listen(443, () => {
    console.log('✅ HTTPS server running at https://localhost:443');
});
// Kick off finalize if booted and inactive
setTimeout(() => {
    if (isBooted()) {
        console.log('⏱️ Auto-finalizing setup after timeout...');
        const req = request({
            method: 'POST',
            host: 'localhost',
            port: 443,
            path: '/finalize-setup',
            rejectUnauthorized: false, // allow self-signed certs
            headers: {
                'Content-Type': 'application/json'
            }
        }, (res) => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                console.log('✅ Auto-finalize complete');
            }
            else {
                console.error(`❌ Auto-finalize failed: ${res.statusCode}`);
            }
        });
        req.on('error', (err) => {
            console.error('❌ Auto-finalize request error:', err);
        });
        req.end(); // no body needed
    }
    else {
        console.log('⏱️ Auto-finalize skipped: not yet booted');
    }
}, AUTO_FINALIZE_TIMEOUT_MS);
