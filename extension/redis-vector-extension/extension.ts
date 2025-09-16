import * as vscode from 'vscode';
import { createClient, RedisClientType } from 'redis';
import * as fs from 'fs';
import * as tls from 'tls';
import * as child_process from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as tf from '@tensorflow/tfjs-node';
import * as use from '@tensorflow-models/universal-sentence-encoder';

export function activate(context: vscode.ExtensionContext) {
    let redisClient: RedisClientType | null = null;
    let sshProcess: child_process.ChildProcess | null = null;
    let sentenceEncoder: use.UniversalSentenceEncoder | null = null;
    const outputChannel = vscode.window.createOutputChannel('Redis Vector DB');
    let cancelExport = false;

    // Ensure we're not ignoring certificate validation
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
        outputChannel.appendLine('WARNING: TLS certificate validation is disabled (NODE_TLS_REJECT_UNAUTHORIZED=0)');
        outputChannel.appendLine('This is a security risk. Certificate validation will be enforced.');
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    }

    // Initialize TensorFlow.js and sentence encoder
    const initializeEncoder = async () => {
        try {
            outputChannel.appendLine('Initializing TensorFlow.js and sentence encoder...');
            await tf.ready();
            sentenceEncoder = await use.load();
            outputChannel.appendLine('Sentence encoder loaded successfully.');
        } catch (error) {
            outputChannel.appendLine(`Failed to initialize encoder: ${error}`);
            vscode.window.showWarningMessage('Sentence encoder initialization failed. Some features may not work.');
        }
    };

    // Call initialization
    initializeEncoder();

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
        // Store reference to redisClient to avoid null issues
        const currentRedisClient = redisClient;
        
        if (!currentRedisClient) {
            vscode.window.showErrorMessage('Not connected to Redis. Please connect first.');
            return;
        }

        // Check if user wants to cancel before starting
        const cancelButton = 'Cancel';
        const response = await vscode.window.showWarningMessage(
            'Exporting large datasets may take time. Do you want to continue?',
            'Continue',
            cancelButton
        );

        if (response === cancelButton) {
            return;
        }

        outputChannel.show();
        outputChannel.appendLine('Starting data export from Redis...');
        
        // Add cancel command
        const cancelToken = vscode.commands.registerCommand('redisVector.cancelExport', () => {
            cancelExport = true;
            outputChannel.appendLine('Export cancelled by user.');
        });
        
        context.subscriptions.push(cancelToken);

        try {
            // Get workspace folder
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder open. Please open a workspace first.');
                return;
            }

            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            const exportPath = path.join(workspaceRoot, 'redis_data_export.json');
            
            // Get total key count for progress reporting
            outputChannel.appendLine('Counting keys...');
            const totalKeys = await currentRedisClient.dbSize();
            outputChannel.appendLine(`Found approximately ${totalKeys} keys to export`);
            
            if (totalKeys > 100000) {
                vscode.window.showWarningMessage(`Large dataset detected (${totalKeys} keys). Export may take several minutes.`);
            }

            // Create a write stream for efficient file writing
            const writeStream = fs.createWriteStream(exportPath);
            writeStream.write('{\n');
            writeStream.write('"timestamp": "' + new Date().toISOString() + '",\n');
            writeStream.write('"totalKeys": ' + totalKeys + ',\n');
            writeStream.write('"keys": [\n');

            // Use SCAN to iterate through keys in batches (more efficient than KEYS)
            let cursor = 0; // SCAN cursor starts at 0
            let exportedCount = 0;
            const batchSize = 1000; // Process keys in batches

            // Create progress indicator
            const progressOptions = {
                location: vscode.ProgressLocation.Notification,
                title: "Exporting Redis Data",
                cancellable: true
            };

            await vscode.window.withProgress(progressOptions, async (progress, token) => {
                token.onCancellationRequested(() => {
                    cancelExport = true;
                    outputChannel.appendLine('Export cancelled by user.');
                });

                do {
                    if (cancelExport) {
                        break;
                    }

                    // Get a batch of keys using SCAN
                    // The SCAN command returns an object with cursor and keys properties
                    const result = await currentRedisClient.scan(cursor, {
                        COUNT: batchSize
                    });
                    
                    // Update cursor and get keys from the result
                    cursor = result.cursor;
                    const keys = result.keys;
                    
                    if (keys.length === 0) {
                        continue;
                    }

                    // Use pipeline to get types for all keys in batch
                    const pipeline = currentRedisClient.multi();
                    for (const key of keys) {
                        pipeline.type(key);
                    }
                    
                    // Execute the pipeline and get types
                    const typeResults = await pipeline.exec();
                    
                    // Use another pipeline to get values based on types
                    const valuePipeline = currentRedisClient.multi();
                    for (let i = 0; i < keys.length; i++) {
                        const key = keys[i];
                        const type = typeResults[i] as string;
                        
                        switch (type) {
                            case 'string':
                                valuePipeline.get(key);
                                break;
                            case 'hash':
                                valuePipeline.hGetAll(key);
                                break;
                            case 'list':
                                valuePipeline.lRange(key, 0, 100); // Limit to first 100 items for large lists
                                break;
                            case 'set':
                                valuePipeline.sMembers(key);
                                break;
                            case 'zset':
                                valuePipeline.zRangeWithScores(key, 0, 100); // Limit to first 100 items
                                break;
                            default:
                                valuePipeline.get(key); // Fallback
                        }
                    }
                    
                    // Execute the value pipeline
                    const valueResults = await valuePipeline.exec();

                    // Write the batch to file
                    for (let i = 0; i < keys.length; i++) {
                        if (cancelExport) {
                            break;
                        }

                        const key = keys[i];
                        const type = typeResults[i] as string;
                        let value = valueResults[i];

                        // Handle embedding data for better readability
                        if (type === 'hash' && value && typeof value === 'object') {
                            // Convert binary embedding data to a readable format
                            if (value.embedding && Buffer.isBuffer(value.embedding)) {
                                // Convert buffer to array of floats for readability
                                const buffer = value.embedding;
                                const floatArray = [];
                                for (let j = 0; j < buffer.length; j += 4) {
                                    floatArray.push(buffer.readFloatLE(j));
                                }
                                value.embedding = {
                                    type: 'float32_array',
                                    dimensions: floatArray.length,
                                    data: floatArray
                                };
                            }
                            
                            // Convert other binary fields to base64 for readability
                            for (const [field, fieldValue] of Object.entries(value)) {
                                if (Buffer.isBuffer(fieldValue)) {
                                    value[field] = {
                                        type: 'binary_data',
                                        encoding: 'base64',
                                        data: fieldValue.toString('base64')
                                    };
                                }
                            }
                        }

                        const entry = {
                            key,
                            type,
                            value
                        };

                        const jsonStr = JSON.stringify(entry);
                        writeStream.write(jsonStr);

                        exportedCount++;
                        
                        // Add comma unless it's the last entry or we're at the end
                        if (exportedCount < totalKeys && cursor !== 0) {
                            writeStream.write(',\n');
                        } else {
                            writeStream.write('\n');
                        }

                        // Update progress every 1000 keys
                        if (exportedCount % 1000 === 0) {
                            const percentage = Math.round((exportedCount / totalKeys) * 100);
                            progress.report({
                                message: `${exportedCount}/${totalKeys} keys (${percentage}%)`,
                                increment: (1000 / totalKeys) * 100
                            });
                            
                            outputChannel.appendLine(`Exported ${exportedCount}/${totalKeys} keys (${percentage}%)`);
                        }
                    }

                } while (cursor !== 0 && !cancelExport);

                // Final progress update
                progress.report({ message: `Finishing export...`, increment: 100 });
            });

            // Complete the JSON structure
            writeStream.write(']\n');
            writeStream.write('}\n');
            writeStream.end();

            if (cancelExport) {
                fs.unlinkSync(exportPath); // Remove incomplete file
                vscode.window.showInformationMessage('Export cancelled.');
            } else {
                outputChannel.appendLine(`Data export completed. Exported ${exportedCount} keys to: ${exportPath}`);
                
                vscode.window.showInformationMessage(
                    `Exported ${exportedCount} keys from Redis.`,
                    'Open File'
                ).then(selection => {
                    if (selection === 'Open File') {
                        vscode.workspace.openTextDocument(exportPath).then(doc => {
                            vscode.window.showTextDocument(doc);
                        });
                    }
                });
            }

        } catch (error) {
            outputChannel.appendLine(`Error during export: ${error}`);
            vscode.window.showErrorMessage(`Error during export: ${error}`);
        } finally {
            cancelExport = false;
        }
    });

    // Generate embeddings using TensorFlow.js
    const generateEmbedding = async (text: string): Promise<number[]> => {
        if (!sentenceEncoder) {
            throw new Error('Sentence encoder not initialized');
        }

        try {
            const embeddings = await sentenceEncoder.embed([text]);
            const embeddingArray = await embeddings.array();
            return embeddingArray[0];
        } catch (error) {
            outputChannel.appendLine(`Error generating embedding: ${error}`);
            throw new Error(`Failed to generate embedding: ${error}`);
        }
    };

    // Convert embedding array to bytes for Redis storage
    const embeddingToBytes = (embedding: number[]): Buffer => {
        const floatArray = new Float32Array(embedding);
        return Buffer.from(floatArray.buffer);
    };

    // Convert bytes from Redis to embedding array
    const bytesToEmbedding = (bytes: Buffer): number[] => {
        const floatArray = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
        return Array.from(floatArray);
    };

    // Store description with embedding
    const storeDescriptionWithEmbedding = async (key: string, description: string) => {
        const currentRedisClient = redisClient;
        
        if (!currentRedisClient) {
            throw new Error('Not connected to Redis');
        }

        if (!sentenceEncoder) {
            throw new Error('Sentence encoder not initialized');
        }

        try {
            const embedding = await generateEmbedding(description);
            const embBytes = embeddingToBytes(embedding);
            
            await currentRedisClient.hSet(key, {
                'desc': description,
                'embedding': embBytes
            });
            
            outputChannel.appendLine(`Stored description with embedding for key: ${key}`);
            return true;
        } catch (error) {
            outputChannel.appendLine(`Error storing description with embedding: ${error}`);
            throw error;
        }
    };

    // Vector search implementation
    const vectorSearch = async (query: string, k: number = 5) => {
        const currentRedisClient = redisClient;
        
        if (!currentRedisClient) {
            throw new Error('Not connected to Redis');
        }

        if (!sentenceEncoder) {
            throw new Error('Sentence encoder not initialized');
        }

        try {
            // Generate embedding for the query
            const queryEmbedding = await generateEmbedding(query);
            
            // For simplicity, we'll do a brute-force search
            // In a real implementation, you'd use RediSearch with vector index
            outputChannel.appendLine(`Performing vector search for: "${query}"`);
            
            // Get all keys
            const keys = await currentRedisClient.keys('*');
            const results = [];
            
            // Check each key for embeddings and calculate similarity
            for (const key of keys) {
                const type = await currentRedisClient.type(key);
                
                if (type === 'hash') {
                    const hashData = await currentRedisClient.hGetAll(key);
                    
                    if (hashData.embedding) {
                        // Convert stored embedding back to array
                        const storedEmbedding = bytesToEmbedding(Buffer.from(hashData.embedding as string, 'binary'));
                        const storedDesc = hashData.desc as string;
                        
                        // Calculate cosine similarity
                        const similarity = calculateCosineSimilarity(queryEmbedding, storedEmbedding);
                        
                        results.push({
                            key,
                            desc: storedDesc,
                            similarity
                        });
                    }
                }
            }
            
            // Sort by similarity (descending)
            results.sort((a, b) => b.similarity - a.similarity);
            
            // Return top k results
            return results.slice(0, k);
        } catch (error) {
            outputChannel.appendLine(`Error during vector search: ${error}`);
            throw error;
        }
    };

    // Calculate cosine similarity between two vectors
    const calculateCosineSimilarity = (vecA: number[], vecB: number[]): number => {
        if (vecA.length !== vecB.length) {
            throw new Error('Vectors must have the same length');
        }
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        
        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);
        
        if (normA === 0 || normB === 0) {
            return 0;
        }
        
        return dotProduct / (normA * normB);
    };

    // Command to store description with embedding
    const storeWithEmbeddingCommand = vscode.commands.registerCommand('redisVector.storeWithEmbedding', async () => {
        const currentRedisClient = redisClient;
        
        if (!currentRedisClient) {
            vscode.window.showErrorMessage('Not connected to Redis. Please connect first.');
            return;
        }

        if (!sentenceEncoder) {
            vscode.window.showErrorMessage('Sentence encoder not initialized. Please try again.');
            return;
        }

        // Get key from user
        const key = await vscode.window.showInputBox({
            prompt: 'Enter the key for this item',
            placeHolder: 'e.g., table:column'
        });

        if (!key) {
            return;
        }

        // Get description from user
        const description = await vscode.window.showInputBox({
            prompt: 'Enter the description for this item',
            placeHolder: 'e.g., This column stores employee names'
        });

        if (!description) {
            return;
        }

        outputChannel.show();
        
        try {
            await storeDescriptionWithEmbedding(key, description);
            outputChannel.appendLine(`Successfully stored description with embedding for key: ${key}`);
            vscode.window.showInformationMessage(`Stored description with embedding for key: ${key}`);
        } catch (error) {
            outputChannel.appendLine(`Error: ${error}`);
            vscode.window.showErrorMessage(`Failed to store description: ${error}`);
        }
    });

    // Command to perform vector search
    const vectorSearchCommand = vscode.commands.registerCommand('redisVector.vectorSearch', async () => {
        const currentRedisClient = redisClient;
        
        if (!currentRedisClient) {
            vscode.window.showErrorMessage('Not connected to Redis. Please connect first.');
            return;
        }

        if (!sentenceEncoder) {
            vscode.window.showErrorMessage('Sentence encoder not initialized. Please try again.');
            return;
        }

        // Get search query from user
        const query = await vscode.window.showInputBox({
            prompt: 'Enter your search query',
            placeHolder: 'Search for similar items...'
        });

        if (!query) {
            return;
        }

        outputChannel.show();
        outputChannel.appendLine(`Performing vector search for: "${query}"`);

        try {
            const results = await vectorSearch(query, 5);
            
            if (results.length === 0) {
                outputChannel.appendLine('No results found.');
                vscode.window.showInformationMessage('No results found for your query.');
                return;
            }
            
            outputChannel.appendLine(`Found ${results.length} results:`);
            
            for (const result of results) {
                outputChannel.appendLine(`Key: ${result.key}, Similarity: ${result.similarity.toFixed(4)}`);
                outputChannel.appendLine(`Description: ${result.desc}`);
                outputChannel.appendLine('---');
            }
            
            vscode.window.showInformationMessage(`Found ${results.length} results for your query.`);
            
        } catch (error) {
            outputChannel.appendLine(`Error during vector search: ${error}`);
            vscode.window.showErrorMessage(`Error during vector search: ${error}`);
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
    context.subscriptions.push(storeWithEmbeddingCommand);
    context.subscriptions.push(vectorSearchCommand);
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
