import * as vscode from 'vscode';
import { createClient, RedisClientType } from 'redis';
import * as fs from 'fs';
import * as tls from 'tls';
import * as child_process from 'child_process';
import * as path from 'path';
import * as os from 'os';

export function activate(context: vscode.ExtensionContext) {
    let redisClient: RedisClientType | null = null;
    let sshProcess: child_process.ChildProcess | null = null;
    const outputChannel = vscode.window.createOutputChannel('Redis Vector DB');

    // Ensure we're not ignoring certificate validation
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
        outputChannel.appendLine('WARNING: TLS certificate validation is disabled (NODE_TLS_REJECT_UNAUTHORIZED=0)');
        outputChannel.appendLine('This is a security risk. Certificate validation will be enforced.');
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    }

    const connectCommand = vscode.commands.registerCommand('redisVector.connect', async () => {
        outputChannel.show();
        outputChannel.appendLine('Starting Redis Vector DB connection...');
        
        try {
            const config = vscode.workspace.getConfiguration('redisVector');
            const host = config.get('host') as string;
            const port = config.get('port') as number;
            const caCertPath = config.get('caCertPath') as string;
            const clientCertPath = config.get('clientCertPath') as string;
            const clientKeyPath = config.get('clientKeyPath') as string;
            const dbName = config.get('dbName') as string;
            const sshHost = config.get('sshHost') as string;
            const sshUser = config.get('sshUser') as string;

            outputChannel.appendLine(`Configuration loaded:`);
            outputChannel.appendLine(`- Host: ${host}`);
            outputChannel.appendLine(`- Port: ${port}`);
            outputChannel.appendLine(`- CA Cert: ${caCertPath}`);
            outputChannel.appendLine(`- Client Cert: ${clientCertPath}`);
            outputChannel.appendLine(`- Client Key: ${clientKeyPath}`);
            outputChannel.appendLine(`- DB Name: ${dbName}`);
            outputChannel.appendLine(`- SSH Host: ${sshHost}`);
            outputChannel.appendLine(`- SSH User: ${sshUser}`);

            // Normalize paths for Windows
            const normalizedCaCertPath = caCertPath.replace(/\//g, '\\');
            
            // Check if CA certificate file exists
            if (!fs.existsSync(normalizedCaCertPath)) {
                throw new Error(`CA certificate not found at: ${normalizedCaCertPath}`);
            }

            // Create temporary directory for certificate files
            const tempDir = path.join(os.tmpdir(), 'redis-certs');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const tempCertPath = path.join(tempDir, 'client.cert');
            const tempKeyPath = path.join(tempDir, 'client.key');

            // Establish SSH tunnel for client certificates - run commands separately
            outputChannel.appendLine('Establishing SSH tunnel for client certificates...');
            
            // Execute SSH commands one by one with proper error handling
            await new Promise<void>((resolve, reject) => {
                outputChannel.appendLine(`Downloading client certificate from ${sshHost}...`);
                
                const certCommand = `ssh -K ${sshUser}@${sshHost} "cat ${clientCertPath}" > "${tempCertPath}"`;
                outputChannel.appendLine(`Executing: ${certCommand}`);
                
                child_process.exec(certCommand, (error, stdout, stderr) => {
                    if (error) {
                        outputChannel.appendLine(`SSH Error (cert): ${error.message}`);
                        reject(new Error(`SSH certificate download failed: ${error.message}`));
                        return;
                    }
                    
                    outputChannel.appendLine('Client certificate downloaded successfully.');
                    
                    // Now download the key
                    outputChannel.appendLine(`Downloading client key from ${sshHost}...`);
                    const keyCommand = `ssh -K ${sshUser}@${sshHost} "cat ${clientKeyPath}" > "${tempKeyPath}"`;
                    outputChannel.appendLine(`Executing: ${keyCommand}`);
                    
                    child_process.exec(keyCommand, (keyError, keyStdout, keyStderr) => {
                        if (keyError) {
                            outputChannel.appendLine(`SSH Error (key): ${keyError.message}`);
                            reject(new Error(`SSH key download failed: ${keyError.message}`));
                            return;
                        }
                        
                        outputChannel.appendLine('Client key downloaded successfully.');
                        resolve();
                    });
                });
            });

            // Read certificate files
            outputChannel.appendLine('Reading certificate files...');
            const caCert = fs.readFileSync(normalizedCaCertPath, 'utf8');
            const clientCert = fs.readFileSync(tempCertPath, 'utf8');
            const clientKey = fs.readFileSync(tempKeyPath, 'utf8');

            outputChannel.appendLine('Creating Redis client with SSL configuration...');
            
            // Create a custom secure context
            const secureContext = tls.createSecureContext({
                ca: caCert,
                cert: clientCert,
                key: clientKey
            });

            redisClient = createClient({
                socket: {
                    host: host,
                    port: port,
                    tls: true,
                    secureContext: secureContext,
                    rejectUnauthorized: true
                },
                database: 0
            });

            redisClient.on('error', (err) => {
                outputChannel.appendLine(`Redis Client Error: ${err}`);
                vscode.window.showErrorMessage(`Redis Error: ${err}`);
            });

            redisClient.on('connect', () => {
                outputChannel.appendLine('Redis client connecting...');
            });

            redisClient.on('ready', () => {
                outputChannel.appendLine('Redis client is ready');
                vscode.window.showInformationMessage('Successfully connected to Redis Vector DB!');
            });

            outputChannel.appendLine('Connecting to Redis...');
            await redisClient.connect();
            
            outputChannel.appendLine('Connection successful!');
            
            // Test the connection with a ping
            const pingResult = await redisClient.ping();
            outputChannel.appendLine(`Ping response: ${pingResult}`);

        } catch (error) {
            outputChannel.appendLine(`Connection failed: ${error}`);
            vscode.window.showErrorMessage(`Failed to connect to Redis: ${error}`);
            redisClient = null;
        }
    });

    const fetchDataCommand = vscode.commands.registerCommand('redisVector.fetchData', async () => {
        if (!redisClient) {
            vscode.window.showErrorMessage('Not connected to Redis. Please connect first.');
            return;
        }

        outputChannel.show();
        outputChannel.appendLine('Fetching data from Redis...');

        try {
            // Get all keys
            const keys = await redisClient.keys('*');
            outputChannel.appendLine(`Found ${keys.length} keys`);
            
            // Display first 10 keys as a sample
            for (let i = 0; i < Math.min(keys.length, 10); i++) {
                const key = keys[i];
                const type = await redisClient.type(key);
                
                let value = '';
                switch (type) {
                    case 'string':
                        value = await redisClient.get(key) || '';
                        break;
                    case 'hash':
                        value = JSON.stringify(await redisClient.hGetAll(key));
                        break;
                    case 'list':
                        value = JSON.stringify(await redisClient.lRange(key, 0, -1));
                        break;
                    case 'set':
                        value = JSON.stringify(await redisClient.sMembers(key));
                        break;
                    case 'zset':
                        value = JSON.stringify(await redisClient.zRange(key, 0, -1));
                        break;
                    default:
                        value = `[Type: ${type}]`;
                }
                
                outputChannel.appendLine(`${i+1}. ${key} (${type}): ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`);
            }
            
            if (keys.length > 10) {
                outputChannel.appendLine(`... and ${keys.length - 10} more keys`);
            }
            
            vscode.window.showInformationMessage(`Fetched ${keys.length} keys from Redis`);
        } catch (error) {
            outputChannel.appendLine(`Error fetching data: ${error}`);
            vscode.window.showErrorMessage(`Error fetching data: ${error}`);
        }
    });

    const disconnectCommand = vscode.commands.registerCommand('redisVector.disconnect', async () => {
        if (redisClient) {
            await redisClient.quit();
            outputChannel.appendLine('Disconnected from Redis');
            vscode.window.showInformationMessage('Disconnected from Redis');
            redisClient = null;
        }
        
        if (sshProcess) {
            sshProcess.kill();
            outputChannel.appendLine('SSH tunnel closed');
            sshProcess = null;
        }
        
        // Clean up temporary files
        const tempDir = path.join(os.tmpdir(), 'redis-certs');
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    context.subscriptions.push(connectCommand);
    context.subscriptions.push(fetchDataCommand);
    context.subscriptions.push(disconnectCommand);
    context.subscriptions.push(outputChannel);
}

export function deactivate() {
    // Clean up temporary files
    const tempDir = path.join(os.tmpdir(), 'redis-certs');
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}
