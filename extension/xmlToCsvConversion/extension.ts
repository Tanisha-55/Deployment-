import * as vscode from 'vscode';
import * as path from 'path';
import { setTimeout } from 'timers/promises';

interface ExtensionConfig {
    inputFolder: string;
    outputFolder: string;
    delayBetweenRequests: number;
    batchSize: number;
    enableBatchProcessing: boolean;
    fileTypeInstructions: Record<string, string>;
    defaultInstructionFile: string;
}

interface ProcessingResult {
    success: boolean;
    totalFiles: number;
    processedFiles: number;
    errorCount: number;
    outputPath: string;
    folderStats: Record<string, { input: number; output: number; errors: number }>;
    processingTime: number;
}

// Global variable to track if the extension is activated
let isExtensionActive = false;

export function activate(context: vscode.ExtensionContext) {
    console.log('Copilot Lineage Deriver extension is now active!');
    isExtensionActive = true;

    // Register the main command for generating lineage
    let generateLineageCommand = vscode.commands.registerCommand('copilot-lineage-deriver.generateLineage', async () => {
        const startTime = Date.now();
        const result = await processAllMappings();
        const processingTime = (Date.now() - startTime) / 1000; // Convert to seconds
        
        showProcessingSummary(result, processingTime);
    });

    // Register command to show configuration
    let showConfigurationCommand = vscode.commands.registerCommand('copilot-lineage-deriver.showConfiguration', async () => {
        showCurrentConfiguration();
    });

    // Register the chat participant for @extract-lineage
    try {
        const chatParticipant = vscode.chat.createChatParticipant(
            'extract-lineage',
            async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
                console.log('Chat participant invoked with command:', request.command, 'and prompt:', request.prompt);
                
                // Show help if no command is specified or if help is requested
                if (!request.command || request.command === 'show-help') {
                    showHelpInformation(stream);
                    return;
                }
                
                if (request.command === 'show-config') {
                    showConfigurationInChat(stream);
                    return;
                }
                
                const startTime = Date.now();
                let result: ProcessingResult;
                
                if (request.command === 'extract-folder') {
                    // Extract lineage from a specific folder
                    const folder = await vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        openLabel: 'Select folder with source files'
                    });
                    
                    if (!folder || folder.length === 0) {
                        stream.markdown('No folder selected. Operation cancelled.');
                        return;
                    }
                    
                    result = await processFolder(folder[0]);
                } else if (request.command === 'extract-all') {
                    // Extract lineage from all configured folders
                    result = await processAllMappings();
                } else {
                    stream.markdown(`❌ Unknown command: ${request.command}\n\nUse \`@extract-lineage show-help\` to see available commands.`);
                    return;
                }
                
                const processingTime = (Date.now() - startTime) / 1000; // Convert to seconds
                showProcessingSummaryInChat(stream, result, processingTime);
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
    
    context.subscriptions.push(generateLineageCommand, showConfigurationCommand);
}

function showHelpInformation(stream: vscode.ChatResponseStream) {
    const config = getConfiguration();
    
    stream.markdown(`# 🚀 Copilot Lineage Deriver - Professional Data Lineage Extraction

## 📋 Workflow Overview

The Copilot Lineage Deriver system provides enterprise-grade data lineage extraction from various file types (.xml, .sql, etc.). 

**Processing Flow:**
1. Source files are organized in subfolders under the parent input folder (${config.inputFolder})
2. Files are processed ${config.enableBatchProcessing ? `in batches of ${config.batchSize} files` : 'sequentially'}
3. Each batch is processed with a ${config.delayBetweenRequests}ms delay between requests
4. Lineage CSV files are generated in the output folder (${config.outputFolder}) with the same structure as input

## 🗂️ Workspace Requirements

To use this extension effectively, structure your workspace as follows:

\`\`\`
your-workspace/
├── .vscode/
│   └── settings.json          # Workspace configuration
├── ${config.inputFolder}/     # Parent input folder (configurable)
│   ├── folder1/               # Subfolder with source files
│   │   ├── file1.xml
│   │   └── file2.sql
│   └── folder2/
│       └── file3.xml
├── ${config.outputFolder}/    # Generated output folder (configurable)
│   ├── folder1/
│   │   ├── file1.csv
│   │   └── file2.csv
│   └── folder2/
│       └── file3.csv
├── instructions.md            # Default instructions for XML files
└── sql_instructions.md       # Instructions for SQL files
\`\`\`

## ⚙️ Configuration Options

Configure the extension through:
1. **User Settings**: Ctrl+Shift+P → "Preferences: Open Settings (JSON)"
2. **Workspace Settings**: .vscode/settings.json in your workspace

**Available Settings:**
\`\`\`json
{
  "copilotLineageDeriver.inputFolder": "source_data",
  "copilotLineageDeriver.outputFolder": "lineage_output",
  "copilotLineageDeriver.batchSize": 5,
  "copilotLineageDeriver.delayBetweenRequests": 2000,
  "copilotLineageDeriver.enableBatchProcessing": true,
  "copilotLineageDeriver.fileTypeInstructions": {
    "xml": "instructions.md",
    "sql": "sql_instructions.md"
  },
  "copilotLineageDeriver.defaultInstructionFile": "instructions.md"
}
\`\`\`

## 💻 Available Commands

**Chat Commands:**
- \`@extract-lineage extract-all\` - Process all files in the input folder
- \`@extract-lineage extract-folder\` - Select and process a specific folder
- \`@extract-lineage show-config\` - Display current configuration
- \`@extract-lineage show-help\` - Show this help information

**Command Palette:**
- "Generate Lineage CSV from Files" - Process all files
- "Show Lineage Deriver Configuration" - Display current settings

## 🚦 Getting Started

1. Set up your workspace structure as shown above
2. Configure settings in .vscode/settings.json
3. Add appropriate instruction files for each file type
4. Run \`@extract-lineage extract-all\` to generate lineage CSVs

*Note: Ensure GitHub Copilot is enabled for AI-powered lineage extraction.*
`);
}

function showConfigurationInChat(stream: vscode.ChatResponseStream) {
    const config = getConfiguration();
    
    stream.markdown(`# ⚙️ Current Configuration

**Input Folder:** \`${config.inputFolder}\`
**Output Folder:** \`${config.outputFolder}\`
**Batch Size:** ${config.batchSize} files
**Request Delay:** ${config.delayBetweenRequests}ms
**Batch Processing:** ${config.enableBatchProcessing ? 'Enabled' : 'Disabled'}
**Default Instructions:** \`${config.defaultInstructionFile}\`

**File Type Mappings:**
${Object.entries(config.fileTypeInstructions)
    .map(([ext, file]) => `- \`.${ext}\` → \`${file}\``)
    .join('\n')}

*To modify these settings, edit your .vscode/settings.json file or user settings.*`);
}

function showCurrentConfiguration() {
    const config = getConfiguration();
    
    let configMessage = `📋 Current Lineage Deriver Configuration:\n\n`;
    configMessage += `• Input Folder: ${config.inputFolder}\n`;
    configMessage += `• Output Folder: ${config.outputFolder}\n`;
    configMessage += `• Batch Size: ${config.batchSize} files\n`;
    configMessage += `• Request Delay: ${config.delayBetweenRequests}ms\n`;
    configMessage += `• Batch Processing: ${config.enableBatchProcessing ? 'Enabled' : 'Disabled'}\n`;
    configMessage += `• Default Instructions: ${config.defaultInstructionFile}\n\n`;
    
    configMessage += `File Type Mappings:\n`;
    for (const [ext, file] of Object.entries(config.fileTypeInstructions)) {
        configMessage += `• .${ext} → ${file}\n`;
    }
    
    configMessage += `\nEdit these settings in .vscode/settings.json or your user settings.`;
    
    vscode.window.showInformationMessage(configMessage);
}

function showProcessingSummary(result: ProcessingResult, processingTime: number) {
    if (result.success) {
        // Create detailed summary message
        let summaryMessage = `✅ Lineage extraction completed in ${processingTime.toFixed(2)} seconds.\n\n`;
        summaryMessage += `📊 Summary:\n`;
        summaryMessage += `• Total input files: ${result.totalFiles}\n`;
        summaryMessage += `• Successfully processed: ${result.processedFiles}\n`;
        summaryMessage += `• Errors: ${result.errorCount}\n`;
        summaryMessage += `• Accuracy: ${((result.processedFiles / result.totalFiles) * 100).toFixed(2)}%\n\n`;
        
        summaryMessage += `📁 Folder-wise breakdown:\n`;
        for (const [folder, stats] of Object.entries(result.folderStats)) {
            summaryMessage += `• ${folder}: ${stats.input} input → ${stats.output} output (${stats.errors} errors)\n`;
        }
        
        summaryMessage += `\n📂 Output saved to: ${result.outputPath}`;
        
        vscode.window.showInformationMessage(summaryMessage);
    } else {
        vscode.window.showErrorMessage(`Failed to process mappings. ${result.errorCount} errors occurred.`);
    }
}

function showProcessingSummaryInChat(stream: vscode.ChatResponseStream, result: ProcessingResult, processingTime: number) {
    if (result.success) {
        let summaryMessage = `✅ Lineage extraction completed in ${processingTime.toFixed(2)} seconds.\n\n`;
        summaryMessage += `📊 Summary:\n`;
        summaryMessage += `• Total input files: ${result.totalFiles}\n`;
        summaryMessage += `• Successfully processed: ${result.processedFiles}\n`;
        summaryMessage += `• Errors: ${result.errorCount}\n`;
        summaryMessage += `• Accuracy: ${((result.processedFiles / result.totalFiles) * 100).toFixed(2)}%\n\n`;
        
        summaryMessage += `📁 Folder-wise breakdown:\n`;
        for (const [folder, stats] of Object.entries(result.folderStats)) {
            summaryMessage += `• ${folder}: ${stats.input} input → ${stats.output} output (${stats.errors} errors)\n`;
        }
        
        summaryMessage += `\n📂 Output saved to: ${result.outputPath}`;
        
        stream.markdown(summaryMessage);
        
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
        
        stream.button({
            command: 'copilot-lineage-deriver.showConfiguration',
            title: 'Show Configuration'
        });
    } else {
        stream.markdown(`❌ Lineage extraction failed. ${result.errorCount} errors occurred.`);
    }
}

function getConfiguration(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('copilotLineageDeriver');
    return {
        inputFolder: config.get('inputFolder', 'individual_mappings'),
        outputFolder: config.get('outputFolder', 'lineage_csv'),
        delayBetweenRequests: config.get('delayBetweenRequests', 2000),
        batchSize: config.get('batchSize', 5),
        enableBatchProcessing: config.get('enableBatchProcessing', true),
        fileTypeInstructions: config.get('fileTypeInstructions', { xml: 'instructions.md', sql: 'sql.md' }),
        defaultInstructionFile: config.get('defaultInstructionFile', 'instructions.md')
    };
}

async function processAllMappings(): Promise<ProcessingResult> {
    // Get configuration
    const config = vscode.workspace.getConfiguration('copilotLineageDeriver');
    const extensionConfig: ExtensionConfig = {
        inputFolder: config.get('inputFolder', 'individual_mappings'),
        outputFolder: config.get('outputFolder', 'lineage_csv'),
        delayBetweenRequests: config.get('delayBetweenRequests', 2000),
        batchSize: config.get('batchSize', 5),
        enableBatchProcessing: config.get('enableBatchProcessing', true),
        fileTypeInstructions: config.get('fileTypeInstructions', { xml: 'instructions.md', sql: 'sql.md' })
    };

    // Check if workspace is open
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return { 
            success: false, 
            totalFiles: 0, 
            processedFiles: 0, 
            errorCount: 1, 
            outputPath: '', 
            folderStats: {}, 
            processingTime: 0 
        };
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri;
    const mappingsFolderUri = vscode.Uri.joinPath(workspaceFolder, extensionConfig.inputFolder);
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
            return { 
                success: false, 
                totalFiles: 0, 
                processedFiles: 0, 
                errorCount: 0, 
                outputPath: '', 
                folderStats: {}, 
                processingTime: 0 
            };
        }

        let totalFiles = 0;
        let processedFiles = 0;
        let errorCount = 0;
        const folderStats: Record<string, { input: number; output: number; errors: number }> = {};

        // First, count total files for progress reporting
        for (const subfolderUri of subfolderUris) {
            const subfolderName = path.basename(subfolderUri.fsPath);
            const files = await vscode.workspace.fs.readDirectory(subfolderUri);
            const fileCount = files.filter(([name, type]) => 
                type === vscode.FileType.File && 
                Object.keys(extensionConfig.fileTypeInstructions).some(ext => name.endsWith(`.${ext}`))
            ).length;
            
            totalFiles += fileCount;
            folderStats[subfolderName] = { input: fileCount, output: 0, errors: 0 };
        }

        // Process files with progress indicator
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Generating Lineage CSV Files with Copilot",
            cancellable: true
        }, async (progress, token) => {
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
                                processedFiles++;
                                folderStats[subfolderName].output++;
                            } else {
                                errorCount++;
                                folderStats[subfolderName].errors++;
                                console.error('Error processing file:', result.reason);
                            }
                        }

                        progress.report({ 
                            increment: (batch.length * 100 / totalFiles), 
                            message: `Processed ${processedFiles}/${totalFiles} files (${errorCount} errors)` 
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
                            processedFiles++;
                            folderStats[subfolderName].output++;
                            
                            progress.report({ 
                                increment: (100 / totalFiles), 
                                message: `Processed ${processedFiles}/${totalFiles} files (${errorCount} errors)` 
                            });
                            
                            // Add delay between requests
                            await setTimeout(extensionConfig.delayBetweenRequests);
                        } catch (error) {
                            errorCount++;
                            folderStats[subfolderName].errors++;
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
            totalFiles,
            processedFiles,
            errorCount, 
            outputPath: extensionConfig.outputFolder,
            folderStats,
            processingTime: 0 // This will be calculated by the caller
        };

    } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error}`);
        return { 
            success: false, 
            totalFiles: 0, 
            processedFiles: 0, 
            errorCount: 1, 
            outputPath: '', 
            folderStats: {}, 
            processingTime: 0 
        };
    }
}

async function processFolder(folderUri: vscode.Uri): Promise<ProcessingResult> {
    // Get configuration
    const config = vscode.workspace.getConfiguration('copilotLineageDeriver');
    const extensionConfig: ExtensionConfig = {
        inputFolder: config.get('inputFolder', 'individual_mappings'),
        outputFolder: config.get('outputFolder', 'lineage_csv'),
        delayBetweenRequests: config.get('delayBetweenRequests', 2000),
        batchSize: config.get('batchSize', 5),
        enableBatchProcessing: config.get('enableBatchProcessing', true),
        fileTypeInstructions: config.get('fileTypeInstructions', { xml: 'instructions.md', sql: 'sql.md' })
    };

    // Check if workspace is open
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return { 
            success: false, 
            totalFiles: 0, 
            processedFiles: 0, 
            errorCount: 1, 
            outputPath: '', 
            folderStats: {}, 
            processingTime: 0 
        };
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
            return { 
                success: false, 
                totalFiles: 0, 
                processedFiles: 0, 
                errorCount: 0, 
                outputPath: '', 
                folderStats: {}, 
                processingTime: 0 
            };
        }

        // Create output subfolder using the folder name
        const folderName = path.basename(folderUri.fsPath);
        const outputSubfolderUri = vscode.Uri.joinPath(outputFolderUri, folderName);
        try {
            await vscode.workspace.fs.createDirectory(outputSubfolderUri);
        } catch (err) {
            // Directory might already exist
        }

        let processedFiles = 0;
        let errorCount = 0;
        const folderStats: Record<string, { input: number; output: number; errors: number }> = {
            [folderName]: { input: fileUris.length, output: 0, errors: 0 }
        };

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
                    processedFiles++;
                    folderStats[folderName].output++;
                    
                    progress.report({ 
                        increment: (100 / fileUris.length), 
                        message: `Processed ${processedFiles}/${fileUris.length} files (${errorCount} errors)` 
                    });
                    
                    // Add delay between requests
                    await setTimeout(extensionConfig.delayBetweenRequests);
                } catch (error) {
                    errorCount++;
                    folderStats[folderName].errors++;
                    vscode.window.showErrorMessage(`Error processing ${path.basename(fileUri.fsPath)}: ${error}`);
                }
            }

            if (token.isCancellationRequested) {
                vscode.window.showInformationMessage('CSV generation cancelled.');
            }
        });

        return { 
            success: errorCount === 0, 
            totalFiles: fileUris.length,
            processedFiles,
            errorCount, 
            outputPath: path.join(extensionConfig.outputFolder, folderName),
            folderStats,
            processingTime: 0 // This will be calculated by the caller
        };

    } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error}`);
        return { 
            success: false, 
            totalFiles: 0, 
            processedFiles: 0, 
            errorCount: 1, 
            outputPath: '', 
            folderStats: {}, 
            processingTime: 0 
        };
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
    isExtensionActive = false;
}
