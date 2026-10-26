const net = require('net');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DB_PORT = 5432;
const DB_HOST = '127.0.0.1';
const PG_DATA = 'C:\\Users\\DELL\\Downloads\\PostgreSQL\\18\\data';
const PG_BIN = 'D:\\pgsql\\bin\\postgres.exe';
const PID_FILE = path.join(PG_DATA, 'postmaster.pid');

function isPortOpen(host, port, timeoutMs = 800) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(timeoutMs);
        socket.once('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.once('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.once('error', () => {
            socket.destroy();
            resolve(false);
        });
        socket.connect(port, host);
    });
}

function cleanStalePid() {
    if (!fs.existsSync(PID_FILE)) {
        return;
    }

    try {
        const content = fs.readFileSync(PID_FILE, 'utf8');
        const lines = content.split('\n');
        const pid = parseInt(lines[0].trim(), 10);

        if (!pid || isNaN(pid)) {
            fs.unlinkSync(PID_FILE);
            return;
        }

        // Check if PID is still alive on Windows
        try {
            const out = execSync(`tasklist /FI "PID eq ${pid}" /NH`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
            if (!out.toLowerCase().includes('postgres.exe')) {
                console.log(`[PostgreSQL] Removing stale postmaster.pid (PID ${pid} is not running)...`);
                fs.unlinkSync(PID_FILE);
            }
        } catch {
            // If tasklist fails or PID not found, remove lock file
            fs.unlinkSync(PID_FILE);
        }
    } catch (e) {
        // Ignore error
    }
}

function startPostgresServer() {
    console.log('[PostgreSQL] Database is offline. Starting PostgreSQL server...');
    cleanStalePid();

    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${PG_BIN} -D ${PG_DATA}' }"`;
    try {
        execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
        console.error('[PostgreSQL] Error executing start command:', err.message);
    }
}

async function ensureDatabaseOnline() {
    // 1. Check if database is already running
    const alreadyOpen = await isPortOpen(DB_HOST, DB_PORT);
    if (alreadyOpen) {
        console.log('[PostgreSQL] Database is online and reachable on port 5432.');
        return;
    }

    // 2. Not running - start it
    startPostgresServer();

    // 3. Poll port until ready (up to 15 seconds)
    const startTime = Date.now();
    const maxWaitMs = 15000;
    while (Date.now() - startTime < maxWaitMs) {
        await new Promise((r) => setTimeout(r, 600));
        const isOpen = await isPortOpen(DB_HOST, DB_PORT);
        if (isOpen) {
            console.log('[PostgreSQL] Server started successfully on port 5432!');
            return;
        }
    }

    console.error('[PostgreSQL] Timeout waiting for PostgreSQL to start on port 5432.');
    process.exit(1);
}

ensureDatabaseOnline().catch((err) => {
    console.error('[PostgreSQL] Startup check encountered an error:', err);
    process.exit(1);
});
