import * as vscode from 'vscode';
import { createClient, RedisClientType } from 'redis';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    let redisClient: RedisClientType | null = null;
    const outputChannel = vscode.window.createOutputChannel('Redis Vector DB');

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

            outputChannel.appendLine(`Configuration loaded:`);
            outputChannel.appendLine(`- Host: ${host}`);
            outputChannel.appendLine(`- Port: ${port}`);
            outputChannel.appendLine(`- CA Cert: ${caCertPath}`);
            outputChannel.appendLine(`- Client Cert: ${clientCertPath}`);
            outputChannel.appendLine(`- Client Key: ${clientKeyPath}`);
            outputChannel.appendLine(`- DB Name: ${dbName}`);

            // Read certificate files
            outputChannel.appendLine('Reading certificate files...');
            const caCert = fs.readFileSync(caCertPath, 'utf8');
            const clientCert = fs.readFileSync(clientCertPath, 'utf8');
            const clientKey = fs.readFileSync(clientKeyPath, 'utf8');

            outputChannel.appendLine('Creating Redis client with SSL configuration...');
            
            redisClient = createClient({
                socket: {
                    host: host,
                    port: port,
                    tls: true,
                    ca: caCert,
                    cert: clientCert,
                    key: clientKey,
                    rejectUnauthorized: true
                },
                database: 0 // Adjust if needed, or make configurable
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
            // Example: Fetch all keys (adjust based on your data structure)
            const keys = await redisClient.keys('*');
            outputChannel.appendLine(`Found ${keys.length} keys:`);
            
            for (const key of keys.slice(0, 10)) { // Show first 10 keys
                const type = await redisClient.type(key);
                outputChannel.appendLine(`Key: ${key}, Type: ${type}`);
                
                // Example of fetching different data types
                if (type === 'string') {
                    const value = await redisClient.get(key);
                    outputChannel.appendLine(`  Value: ${value}`);
                } else if (type === 'hash') {
                    const value = await redisClient.hGetAll(key);
                    outputChannel.appendLine(`  Value: ${JSON.stringify(value)}`);
                }
                // Add more type handling as needed
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

    context.subscriptions.push(connectCommand);
    context.subscriptions.push(fetchDataCommand);
    context.subscriptions.push(outputChannel);
}

export function deactivate() {
    // Clean up if needed
}
