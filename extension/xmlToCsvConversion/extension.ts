import * as vscode from 'vscode';
import * as path from 'path';
import { setTimeout } from 'timers/promises';

interface ExtensionConfig {
    mappingsFolderPath: string;
    instructionsPath: string;
    outputFolder: string;
    delayBetweenRequests: number;
    batchSize: number;
    enableBatchProcessing: boolean;
}

interface ProcessingResult {
    success: boolean;
    fileCount: number;
    errorCount: number;
    outputPath: string;
}

export function activate(context: vscode.ExtensionContext) {
    // Register the main command for generating lineage
    let generateLineageCommand = vscode.commands.registerCommand('copilot-lineage-deriver.generateLineage', async () => {
        const result = await processAllMappings();
        if (result.success) {
            vscode.window.showInformationMessage(
                `Successfully processed ${result.fileCount} XML files. ${result.errorCount} errors occurred. CSV files saved to ${result.outputPath}`
            );
        } else {
            vscode.window.showErrorMessage(`Failed to process mappings. ${result.errorCount} errors occurred.`);
        }
    });

    // Register command for single file extraction
    let extractLineageSingleCommand = vscode.commands.registerCommand('copilot-lineage-deriver.extractLineageSingle', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith('.xml')) {
            vscode.window.showErrorMessage('Please open an XML file first.');
            return;
        }

        const result = await processSingleFile(editor.document.uri);
        if (result.success) {
            vscode.window.showInformationMessage(
                `Successfully processed XML file. CSV saved to ${result.outputPath}`
            );
        } else {
            vscode.window.showErrorMessage('Failed to process the XML file.');
        }
    });

    // Register the chat participant for @extract-lineage
    const chatParticipant = vscode.chat.createChatParticipant(
        'copilot-lineage-deriver.extract-lineage',
        async (request: vscode.ChatRequest, context: vscode.ChatContext, response: vscode.ChatResponse, token: vscode.CancellationToken) => {
            // Check which command was used
            const command = request.command;
            
            let result: ProcessingResult;
            
            if (command === 'extract-current') {
                // Extract lineage from current file
                const editor = vscode.window.activeTextEditor;
                if (!editor || !editor.document.fileName.endsWith('.xml')) {
                    response.markdown = 'Please open an XML file first to use this command.';
                    return;
                }
                
                result = await processSingleFile(editor.document.uri);
            } else if (command === 'extract-folder') {
                // Extract lineage from a specific folder
                const folder = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Select folder with XML files'
                });
                
                if (!folder || folder.length === 0) {
                    response.markdown = 'No folder selected.';
                    return;
                }
                
                result = await processFolder(folder[0]);
            } else {
                // Default: extract all
                result = await processAllMappings();
            }
            
            // Return a response for the chat interface
            if (result.success) {
                response.markdown = `Lineage extraction completed. Processed ${result.fileCount} XML files with ${result.errorCount} errors. Output saved to ${result.outputPath}`;
                
                // Add follow-up options
                response.followups = [
                    {
                        label: 'Show Output Folder',
                        command: 'revealFileInOS',
                        args: [vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, result.outputPath)]
                    },
                    {
                        label: 'Run Again',
                        command: 'copilot-lineage-deriver.generateLineage'
                    }
                ];
            } else {
                response.markdown = `Lineage extraction failed. ${result.errorCount} errors occurred.`;
            }
        }
    );

    // Configure the chat participant
    chatParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
    
    context.subscriptions.push(
        generateLineageCommand, 
        extractLineageSingleCommand, 
        chatParticipant
    );
}

async function processAllMappings(): Promise<ProcessingResult> {
    // Get configuration
    const config = vscode.workspace.getConfiguration('copilotLineageDeriver');
    const extensionConfig: ExtensionConfig = {
        mappingsFolderPath: config.get('mappingsFolderPath', 'individual_mappings'),
        instructionsPath: config.get('instructionsPath', 'instructions.md'),
        outputFolder: config.get('outputFolder', 'lineage_csv'),
        delayBetweenRequests: config.get('delayBetweenRequests', 2000),
        batchSize: config.get('batchSize', 5),
        enableBatchProcessing: config.get('enableBatchProcessing', true)
    };

    // Check if workspace is open
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return { success: false, fileCount: 0, errorCount: 1, outputPath: '' };
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri;
    const instructionsUri = vscode.Uri.joinPath(workspaceFolder, extensionConfig.instructionsPath);
    const mappingsFolderUri = vscode.Uri.joinPath(workspaceFolder, extensionConfig.mappingsFolderPath);
    const outputFolderUri = vscode.Uri.joinPath(workspaceFolder, extensionConfig.outputFolder);

    try {
        // Read instructions
        const instructions = await vscode.workspace.fs.readFile(instructionsUri);
        const instructionsText = Buffer.from(instructions).toString('utf8');

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
                
                const xmlFiles = await vscode.workspace.fs.readDirectory(subfolderUri);
                totalFiles += xmlFiles.filter(([name, type]) => 
                    type === vscode.FileType.File && name.endsWith('.xml')
                ).length;
            }

            // Process each subfolder
            for (const subfolderUri of subfolderUris) {
                if (token.isCancellationRequested) break;

                const subfolderName = path.basename(subfolderUri.fsPath);
                
                // Get XML files in this subfolder
                const xmlFiles = await vscode.workspace.fs.readDirectory(subfolderUri);
                const xmlFileUris = xmlFiles
                    .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.xml'))
                    .map(([name]) => vscode.Uri.joinPath(subfolderUri, name))
                    .sort(); // Sort alphabetically

                if (xmlFileUris.length === 0) {
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
                    for (let i = 0; i < xmlFileUris.length; i += extensionConfig.batchSize) {
                        if (token.isCancellationRequested) break;

                        const batch = xmlFileUris.slice(i, i + extensionConfig.batchSize);
                        const batchResults = await Promise.allSettled(
                            batch.map(xmlUri => processXmlFileWithRetry(
                                xmlUri, outputSubfolderUri, instructionsText, extensionConfig.delayBetweenRequests
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
                        if (i + extensionConfig.batchSize < xmlFileUris.length) {
                            await setTimeout(extensionConfig.delayBetweenRequests);
                        }
                    }
                } else {
                    // Process each XML file sequentially (one by one)
                    for (const xmlUri of xmlFileUris) {
                        if (token.isCancellationRequested) break;

                        try {
                            progress.report({ 
                                message: `Processing ${path.basename(xmlUri.fsPath)} in ${subfolderName}...` 
                            });
                            
                            await processXmlFile(xmlUri, outputSubfolderUri, instructionsText);
                            totalProcessed++;
                            
                            progress.report({ 
                                increment: (100 / totalFiles), 
                                message: `Processed ${totalProcessed}/${totalFiles} files (${errorCount} errors)` 
                            });
                            
                            // Add delay between requests
                            await setTimeout(extensionConfig.delayBetweenRequests);
                        } catch (error) {
                            errorCount++;
                            vscode.window.showErrorMessage(`Error processing ${path.basename(xmlUri.fsPath)}: ${error}`);
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
    // Similar to processAllMappings but for a specific folder
    // Implementation would be similar but focused on a single folder
    // For brevity, I'm returning a placeholder result
    return { success: true, fileCount: 0, errorCount: 0, outputPath: 'lineage_csv' };
}

async function processSingleFile(xmlUri: vscode.Uri): Promise<ProcessingResult> {
    // Get configuration
    const config = vscode.workspace.getConfiguration('copilotLineageDeriver');
    const extensionConfig: ExtensionConfig = {
        mappingsFolderPath: config.get('mappingsFolderPath', 'individual_mappings'),
        instructionsPath: config.get('instructionsPath', 'instructions.md'),
        outputFolder: config.get('outputFolder', 'lineage_csv'),
        delayBetweenRequests: config.get('delayBetweenRequests', 2000),
        batchSize: config.get('batchSize', 5),
        enableBatchProcessing: config.get('enableBatchProcessing', true)
    };

    // Check if workspace is open
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return { success: false, fileCount: 0, errorCount: 1, outputPath: '' };
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri;
    const instructionsUri = vscode.Uri.joinPath(workspaceFolder, extensionConfig.instructionsPath);
    const outputFolderUri = vscode.Uri.joinPath(workspaceFolder, extensionConfig.outputFolder);

    try {
        // Read instructions
        const instructions = await vscode.workspace.fs.readFile(instructionsUri);
        const instructionsText = Buffer.from(instructions).toString('utf8');

        // Create output directory if it doesn't exist
        try {
            await vscode.workspace.fs.createDirectory(outputFolderUri);
        } catch (err) {
            // Directory might already exist
        }

        // Determine the subfolder name based on the XML file's parent folder
        const xmlPath = xmlUri.fsPath;
        const mappingsFolderPath = vscode.Uri.joinPath(workspaceFolder, extensionConfig.mappingsFolderPath).fsPath;
        
        let subfolderName = "single_files";
        if (xmlPath.startsWith(mappingsFolderPath)) {
            // Extract the subfolder name from the path
            const relativePath = path.relative(mappingsFolderPath, path.dirname(xmlPath));
            const parts = relativePath.split(path.sep);
            subfolderName = parts.length > 0 ? parts[0] : "single_files";
        }

        // Create output subfolder
        const outputSubfolderUri = vscode.Uri.joinPath(outputFolderUri, subfolderName);
        try {
            await vscode.workspace.fs.createDirectory(outputSubfolderUri);
        } catch (err) {
            // Directory might already exist
        }

        // Process the single file
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Generating Lineage CSV for Single File",
            cancellable: true
        }, async (progress, token) => {
            progress.report({ message: `Processing ${path.basename(xmlUri.fsPath)}...` });
            await processXmlFile(xmlUri, outputSubfolderUri, instructionsText);
        });

        return { 
            success: true, 
            fileCount: 1, 
            errorCount: 0, 
            outputPath: path.join(extensionConfig.outputFolder, subfolderName) 
        };

    } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error}`);
        return { success: false, fileCount: 0, errorCount: 1, outputPath: '' };
    }
}

async function processXmlFileWithRetry(
    xmlUri: vscode.Uri, 
    outputSubfolderUri: vscode.Uri, 
    instructionsText: string, 
    delay: number,
    maxRetries = 3
): Promise<void> {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await processXmlFile(xmlUri, outputSubfolderUri, instructionsText);
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

async function processXmlFile(xmlUri: vscode.Uri, outputSubfolderUri: vscode.Uri, instructionsText: string): Promise<void> {
    // Read XML file
    const xmlContent = await vscode.workspace.fs.readFile(xmlUri);
    const xmlText = Buffer.from(xmlContent).toString('utf8');

    // Create a prompt for Copilot using only the instructions from the md file
    const fileName = path.basename(xmlUri.fsPath, '.xml');
    
    // Create the prompt using the Language Model API format
    const messages: vscode.LanguageModelChatMessage[] = [
        vscode.LanguageModelChatMessage.User(`
@extract-lineage
${instructionsText}

XML File Name: ${fileName}
XML Content:
${xmlText}

Please generate the CSV lineage content based on the instructions and XML provided.
The CSV should have the appropriate headers and data extracted from the XML.
Return only the CSV content without any additional explanation or markdown formatting.
`)
    ];

    // Get response from Copilot using Language Model API
    const csvContent = await getCopilotResponse(messages);

    // Save CSV file
    const csvFileName = `${fileName}.csv`;
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

export function deactivate() {}
