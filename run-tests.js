import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Run tests using ts-mocha which provides the mocha environment
const testProcess = spawn('npx', ['ts-mocha', '--timeout', '10000', 'src/price-calculation.test.ts'], {
    cwd: __dirname,
    stdio: 'inherit'
});

testProcess.on('close', (code) => {
    process.exit(code);
});

