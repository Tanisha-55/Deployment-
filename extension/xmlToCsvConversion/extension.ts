import * as vscode from 'vscode';
import * as path from 'path';
import { setTimeout } from 'timers/promises';

interface ExtensionConfig {
    mappingsFolderPath: string;
    outputFolder: string;
    delayBetweenRequests: number;
    batchSize: number;
    enableBatchProcessing: boolean;
    fileTypeInstructions: Record<string, string>;
}

interface ProcessingResult {
    success: boolean;
    fileCount: number;
    errorCount: number;
    outputPath: string;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Copilot Lineage Deriver extension is now active!');

    // Register the main command for generating lineage
    let generateLineageCommand = vscode.commands.registerCommand('copilot-lineage-deriver.generateLineage', async () => {
        const result = await processAllMappings();
        if (result.success) {
            vscode.window.showInformationMessage(
                `Successfully processed ${result.fileCount} files. ${result.errorCount} errors occurred. CSV files saved to ${result.outputPath}`
            );
        } else {
            vscode.window.showErrorMessage(`Failed to process mappings. ${result.errorCount} errors occurred.`);
        }
    });

    // Register the chat participant for @extract-lineage
    try {
        const chatParticipant = vscode.chat.createChatParticipant(
            'extract-lineage',
            async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
                console.log('Chat participant invoked with command:', request.command, 'and prompt:', request.prompt);
                
                let result: ProcessingResult;
                
                if (request.command === 'extract-folder') {
                    // Extract lineage from a specific folder
                    const folder = await vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        openLabel: 'Select folder with files'
                    });
                    
                    if (!folder || folder.length === 0) {
                        stream.markdown('No folder selected.');
                        return;
                    }
                    
                    result = await processFolder(folder[0]);
                } else {
                    // Default: extract all
                    result = await processAllMappings();
                }
                
                // Return a response for the chat interface
                if (result.success) {
                    stream.markdown(`✅ Lineage extraction completed. Processed ${result.fileCount} files with ${result.errorCount} errors. Output saved to ${result.outputPath}`);
                    
                    // Add follow-up options
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        stream.button({
                            command: 'revealFileInOS',
                            arguments: [vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, result.outputPath)],
                            title: 'Show Output Folder'
                        });
                    }
                    
                    stream.button({
                        command: 'copilot-lineage-deriver.generateLineage',
                        title: 'Run Again'
                    });
                } else {
                    stream.markdown(`❌ Lineage extraction failed. ${result.errorCount} errors occurred.`);
                }
            }
        );

        // Configure the chat participant
        chatParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
        context.subscriptions.push(chatParticipant);
        console.log('Chat participant registered successfully');
    } catch (error) {
        console.error('Failed to register chat participant:', error);
        vscode.window.showErrorMessage('Failed to register chat participant. Check the console for details.');
    }
    
    context.subscriptions.push(generateLineageCommand);
}

async function processAllMappings(): Promise<ProcessingResult> {
    // Get configuration
    const config = vscode.workspace.getConfiguration('copilotLineageDeriver');
    const extensionConfig: ExtensionConfig = {
        mappingsFolderPath: config.get('mappingsFolderPath', 'individual_mappings'),
        outputFolder: config.get('outputFolder', 'lineage_csv'),
        delayBetweenRequests: config.get('delayBetweenRequests', 2000),
        batchSize: config.get('batchSize', 5),
        enableBatchProcessing: config.get('enableBatchProcessing', true),
        fileTypeInstructions: config.get('fileTypeInstructions', { xml: 'instructions.md', sql: 'sql.md' })
    };

    // Check if workspace is open
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return { success: false, fileCount: 0, errorCount: 1, outputPath: '' };
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri;
    const mappingsFolderUri = vscode.Uri.joinPath(workspaceFolder, extensionConfig.mappingsFolderPath);
    const outputFolderUri = vscode.Uri.joinPath(workspaceFolder, extensionConfig.outputFolder);

    try {
        // Create output directory if it doesn't exist
        try {
            await vscode.workspace.fs.createDirectory(outputFolderUri);
        } catch (err) {
            // Directory might already exist
        }

        // Get all subfolders in the mappings folder
        const subfolders = await vscode.workspace.fs.readDirectory(mappingsFolderUri);
        const subfolderUris = subfolders
            .filter(([name, type]) => type === vscode.FileType.Directory)
            .map(([name]) => vscode.Uri.joinPath(mappingsFolderUri, name))
            .sort(); // Sort alphabetically

        if (subfolderUris.length === 0) {
            vscode.window.showInformationMessage('No subfolders found in the mappings folder.');
            return { success: false, fileCount: 0, errorCount: 0, outputPath: '' };
        }

        let totalProcessed = 0;
        let errorCount = 0;

        // Process files with progress indicator
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Generating Lineage CSV Files with Copilot",
            cancellable: true
        }, async (progress, token) => {
            let totalFiles = 0;

            // First, count total files for progress reporting
            for (const subfolderUri of subfolderUris) {
                if (token.isCancellationRequested) break;
                
                const files = await vscode.workspace.fs.readDirectory(subfolderUri);
                totalFiles += files.filter(([name, type]) => 
                    type === vscode.FileType.File && 
                    Object.keys(extensionConfig.fileTypeInstructions).some(ext => name.endsWith(`.${ext}`))
                ).length;
            }

            // Process each subfolder
            for (const subfolderUri of subfolderUris) {
                if (token.isCancellationRequested) break;

                const subfolderName = path.basename(subfolderUri.fsPath);
                
                // Get files in this subfolder
                const files = await vscode.workspace.fs.readDirectory(subfolderUri);
                const fileUris = files
                    .filter(([name, type]) => 
                        type === vscode.FileType.File && 
                        Object.keys(extensionConfig.fileTypeInstructions).some(ext => name.endsWith(`.${ext}`))
                    )
                    .map(([name]) => vscode.Uri.joinPath(subfolderUri, name))
                    .sort(); // Sort alphabetically

                if (fileUris.length === 0) {
                    continue;
                }

                // Create output subfolder
                const outputSubfolderUri = vscode.Uri.joinPath(outputFolderUri, subfolderName);
                try {
                    await vscode.workspace.fs.createDirectory(outputSubfolderUri);
                } catch (err) {
                    // Directory might already exist
                }

                // Process files in batches if enabled
                if (extensionConfig.enableBatchProcessing && extensionConfig.batchSize > 1) {
                    // Process in batches
                    for (let i = 0; i < fileUris.length; i += extensionConfig.batchSize) {
                        if (token.isCancellationRequested) break;

                        const batch = fileUris.slice(i, i + extensionConfig.batchSize);
                        const batchResults = await Promise.allSettled(
                            batch.map(fileUri => processFileWithRetry(
                                fileUri, outputSubfolderUri, extensionConfig.fileTypeInstructions, extensionConfig.delayBetweenRequests
                            ))
                        );

                        for (const result of batchResults) {
                            if (result.status === 'fulfilled') {
                                totalProcessed++;
                            } else {
                                errorCount++;
                                console.error('Error processing file:', result.reason);
                            }
                        }

                        progress.report({ 
                            increment: (batch.length * 100 / totalFiles), 
                            message: `Processed ${totalProcessed}/${totalFiles} files (${errorCount} errors)` 
                        });

                        // Add delay between batches
                        if (i + extensionConfig.batchSize < fileUris.length) {
                            await setTimeout(extensionConfig.delayBetweenRequests);
                        }
                    }
                } else {
                    // Process each file sequentially (one by one)
                    for (const fileUri of fileUris) {
                        if (token.isCancellationRequested) break;

                        try {
                            progress.report({ 
                                message: `Processing ${path.basename(fileUri.fsPath)} in ${subfolderName}...` 
                            });
                            
                            await processFile(fileUri, outputSubfolderUri, extensionConfig.fileTypeInstructions);
                            totalProcessed++;
                            
                            progress.report({ 
                                increment: (100 / totalFiles), 
                                message: `Processed ${totalProcessed}/${totalFiles} files (${errorCount} errors)` 
                            });
                            
                            // Add delay between requests
                            await setTimeout(extensionConfig.delayBetweenRequests);
                        } catch (error) {
                            errorCount++;
                            vscode.window.showErrorMessage(`Error processing ${path.basename(fileUri.fsPath)}: ${error}`);
                        }
                    }
                }
            }

            if (token.isCancellationRequested) {
                vscode.window.showInformationMessage('CSV generation cancelled.');
            }
        });

        return { 
            success: errorCount === 0, 
            fileCount: totalProcessed, 
            errorCount, 
            outputPath: extensionConfig.outputFolder 
        };

    } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error}`);
        return { success: false, fileCount: 0, errorCount: 1, outputPath: '' };
    }
}

async function processFolder(folderUri: vscode.Uri): Promise<ProcessingResult> {
    // Get configuration
    const config = vscode.workspace.getConfiguration('copilotLineageDeriver');
    const extensionConfig: ExtensionConfig = {
        mappingsFolderPath: config.get('mappingsFolderPath', 'individual_mappings'),
        outputFolder: config.get('outputFolder', 'lineage_csv'),
        delayBetweenRequests: config.get('delayBetweenRequests', 2000),
        batchSize: config.get('batchSize', 5),
        enableBatchProcessing: config.get('enableBatchProcessing', true),
        fileTypeInstructions: config.get('fileTypeInstructions', { xml: 'instructions.md', sql: 'sql.md' })
    };

    // Check if workspace is open
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return { success: false, fileCount: 0, errorCount: 1, outputPath: '' };
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri;
    const outputFolderUri = vscode.Uri.joinPath(workspaceFolder, extensionConfig.outputFolder);

    try {
        // Create output directory if it doesn't exist
        try {
            await vscode.workspace.fs.createDirectory(outputFolderUri);
        } catch (err) {
            // Directory might already exist
        }

        // Get files in the selected folder
        const files = await vscode.workspace.fs.readDirectory(folderUri);
        const fileUris = files
            .filter(([name, type]) => 
                type === vscode.FileType.File && 
                Object.keys(extensionConfig.fileTypeInstructions).some(ext => name.endsWith(`.${ext}`))
            )
            .map(([name]) => vscode.Uri.joinPath(folderUri, name))
            .sort(); // Sort alphabetically

        if (fileUris.length === 0) {
            vscode.window.showInformationMessage('No supported files found in the selected folder.');
            return { success: false, fileCount: 0, errorCount: 0, outputPath: '' };
        }

        // Create output subfolder using the folder name
        const folderName = path.basename(folderUri.fsPath);
        const outputSubfolderUri = vscode.Uri.joinPath(outputFolderUri, folderName);
        try {
            await vscode.workspace.fs.createDirectory(outputSubfolderUri);
        } catch (err) {
            // Directory might already exist
        }

        let totalProcessed = 0;
        let errorCount = 0;

        // Process files with progress indicator
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Generating Lineage CSV Files with Copilot",
            cancellable: true
        }, async (progress, token) => {
            // Process each file sequentially (one by one)
            for (const fileUri of fileUris) {
                if (token.isCancellationRequested) break;

                try {
                    progress.report({ 
                        message: `Processing ${path.basename(fileUri.fsPath)}...` 
                    });
                    
                    await processFile(fileUri, outputSubfolderUri, extensionConfig.fileTypeInstructions);
                    totalProcessed++;
                    
                    progress.report({ 
                        increment: (100 / fileUris.length), 
                        message: `Processed ${totalProcessed}/${fileUris.length} files (${errorCount} errors)` 
                    });
                    
                    // Add delay between requests
                    await setTimeout(extensionConfig.delayBetweenRequests);
                } catch (error) {
                    errorCount++;
                    vscode.window.showErrorMessage(`Error processing ${path.basename(fileUri.fsPath)}: ${error}`);
                }
            }

            if (token.isCancellationRequested) {
                vscode.window.showInformationMessage('CSV generation cancelled.');
            }
        });

        return { 
            success: errorCount === 0, 
            fileCount: totalProcessed, 
            errorCount, 
            outputPath: path.join(extensionConfig.outputFolder, folderName) 
        };

    } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error}`);
        return { success: false, fileCount: 0, errorCount: 1, outputPath: '' };
    }
}

async function processFileWithRetry(
    fileUri: vscode.Uri, 
    outputSubfolderUri: vscode.Uri, 
    fileTypeInstructions: Record<string, string>,
    delay: number,
    maxRetries = 3
): Promise<void> {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await processFile(fileUri, outputSubfolderUri, fileTypeInstructions);
            return;
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                await setTimeout(delay * attempt); // Exponential backoff
            }
        }
    }
    throw lastError;
}

async function processFile(
    fileUri: vscode.Uri, 
    outputSubfolderUri: vscode.Uri, 
    fileTypeInstructions: Record<string, string>
): Promise<void> {
    // Check if workspace is open
    if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace folder open.');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri;
    
    // Get file extension and determine the instruction file
    const fileName = path.basename(fileUri.fsPath);
    const fileExtension = path.extname(fileName).toLowerCase().substring(1); // Remove the dot
    
    // Find the instruction file for this file type
    let instructionFile = fileTypeInstructions[fileExtension];
    if (!instructionFile) {
        // Try to find a matching instruction file by checking all extensions
        for (const [ext, instruction] of Object.entries(fileTypeInstructions)) {
            if (fileName.endsWith(`.${ext}`)) {
                instructionFile = instruction;
                break;
            }
        }
        
        // If still not found, use the default instructions.md
        if (!instructionFile) {
            instructionFile = 'instructions.md';
        }
    }
    
    // Read instruction file
    const instructionsUri = vscode.Uri.joinPath(workspaceFolder, instructionFile);
    let instructionsText;
    try {
        const instructions = await vscode.workspace.fs.readFile(instructionsUri);
        instructionsText = Buffer.from(instructions).toString('utf8');
    } catch (error) {
        throw new Error(`Instruction file ${instructionFile} not found.`);
    }

    // Read file content
    const fileContent = await vscode.workspace.fs.readFile(fileUri);
    const fileText = Buffer.from(fileContent).toString('utf8');

    // Create a prompt for Copilot using the appropriate instructions
    const baseFileName = path.basename(fileUri.fsPath, path.extname(fileUri.fsPath)); // Remove the original extension
    
    // Create the prompt using the Language Model API format
    const messages: vscode.LanguageModelChatMessage[] = [
        vscode.LanguageModelChatMessage.User(`
@extract-lineage
${instructionsText}

File Name: ${baseFileName}
File Content:
${fileText}

Please generate the CSV lineage content based on the instructions and file content provided.
The CSV should have the appropriate headers and data extracted from the file.
Return only the CSV content without any additional explanation or markdown formatting.
`)
    ];

    // Get response from Copilot using Language Model API
    const csvContent = await getCopilotResponse(messages);

    // Save CSV file - use the base filename without the original extension
    const csvFileName = `${baseFileName}.csv`;
    const csvUri = vscode.Uri.joinPath(outputSubfolderUri, csvFileName);
    await vscode.workspace.fs.writeFile(csvUri, Buffer.from(csvContent, 'utf8'));
}

async function getCopilotResponse(messages: vscode.LanguageModelChatMessage[]): Promise<string> {
    // Check if language model is available
    const availableModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    if (availableModels.length === 0) {
        throw new Error('No Copilot language model available. Please ensure GitHub Copilot is enabled.');
    }

    // Use the first available Copilot model
    const model = availableModels[0];
    
    // Create a cancellation token
    const tokenSource = new vscode.CancellationTokenSource();
    
    try {
        // Send the request to the language model
        const response = await model.sendRequest(messages, {}, tokenSource.token);
        
        // Collect the response
        let csvContent = '';
        for await (const fragment of response.text) {
            csvContent += fragment;
        }
        
        return csvContent;
    } catch (error) {
        throw new Error(`Failed to get response from Copilot: ${error}`);
    } finally {
        tokenSource.dispose();
    }
}

export function deactivate() {
    console.log('Copilot Lineage Deriver extension is now deactivated!');
}
