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

interface ConversationState {
    step: 'idle' | 'awaiting_setup' | 'validating' | 'ready' | 'processing';
    validationResults?: {
        hasInputFolder: boolean;
        hasOutputFolder: boolean;
        hasInstructionFiles: boolean;
        hasSourceFiles: boolean;
        folderStructure: string[];
        issues: string[];
    };
}

// Global variables
let isExtensionActive = false;
let conversationState: ConversationState = { step: 'idle' };

export function activate(context: vscode.ExtensionContext) {
    console.log('Copilot Lineage Deriver extension is now active!');
    isExtensionActive = true;
    conversationState = { step: 'idle' };

    // Register the main command for generating lineage
    let generateLineageCommand = vscode.commands.registerCommand('copilot-lineage-deriver.generateLineage', async () => {
        const startTime = Date.now();
        const result = await processAllMappings();
        const processingTime = (Date.now() - startTime) / 1000;
        
        showProcessingSummary(result, processingTime);
    });

    // Register command to show configuration
    let showConfigurationCommand = vscode.commands.registerCommand('copilot-lineage-deriver.showConfiguration', async () => {
        showCurrentConfiguration();
    });

    // Register command to validate workspace
    let validateWorkspaceCommand = vscode.commands.registerCommand('copilot-lineage-deriver.validateWorkspace', async () => {
        const validationResults = await validateWorkspaceSetup();
        showValidationResults(validationResults);
    });

    // Register the chat participant for @extract-lineage
    try {
        const chatParticipant = vscode.chat.createChatParticipant(
            'extract-lineage',
            async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
                console.log('Chat participant invoked with command:', request.command, 'and prompt:', request.prompt);
                
                // Handle different conversation states
                switch (conversationState.step) {
                    case 'idle':
                        if (!request.command || request.command === 'show-help') {
                            showHelpInformation(stream);
                            conversationState.step = 'awaiting_setup';
                        } else if (request.command === 'validate-workspace') {
                            await handleValidation(stream);
                        } else if (request.command === 'extract-all') {
                            await handleExtraction(stream);
                        } else if (request.command === 'extract-folder') {
                            await handleFolderExtraction(stream);
                        } else {
                            stream.markdown(`I'm not sure what you'd like to do. Use \`@extract-lineage show-help\` to see available options.`);
                        }
                        break;
                        
                    case 'awaiting_setup':
                        if (request.prompt.toLowerCase().includes('yes') || 
                            request.prompt.toLowerCase().includes('ready') ||
                            request.prompt.toLowerCase().includes('done')) {
                            await handleValidation(stream);
                        } else if (request.prompt.toLowerCase().includes('no') || 
                                  request.prompt.toLowerCase().includes('not ready')) {
                            stream.markdown(`Take your time to set up the workspace. When you're ready, just type 'yes' or 'ready' to continue.`);
                        } else {
                            stream.markdown(`I'm not sure I understand. Have you set up the workspace structure as explained? (yes/no)`);
                        }
                        break;
                        
                    case 'ready':
                        if (request.command === 'extract-all') {
                            await handleExtraction(stream);
                        } else if (request.command === 'extract-folder') {
                            await handleFolderExtraction(stream);
                        } else if (request.prompt.toLowerCase().includes('yes')) {
                            await handleExtraction(stream);
                        } else if (request.prompt.toLowerCase().includes('no')) {
                            stream.markdown(`Okay, let me know when you're ready to proceed with the extraction.`);
                            conversationState.step = 'idle';
                        } else {
                            stream.markdown(`Would you like to proceed with extracting lineage from all files? (yes/no)`);
                        }
                        break;
                        
                    default:
                        conversationState.step = 'idle';
                        stream.markdown(`Let's start over. How can I help you with lineage extraction?`);
                        break;
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
    
    context.subscriptions.push(generateLineageCommand, showConfigurationCommand, validateWorkspaceCommand);
}

async function handleValidation(stream: vscode.ChatResponseStream) {
    conversationState.step = 'validating';
    stream.markdown(`🔍 Validating your workspace setup...`);
    
    const validationResults = await validateWorkspaceSetup();
    conversationState.validationResults = validationResults;
    
    // Show validation results
    if (validationResults && validationResults.issues.length === 0) {
        stream.markdown(`✅ Workspace validation successful! Your setup looks perfect.`);
        stream.markdown(`\n**Workspace Structure:**`);
        validationResults.folderStructure.forEach(line => {
            stream.markdown(line);
        });
        
        stream.markdown(`\nWould you like to proceed with extracting lineage from all files? (yes/no)`);
        conversationState.step = 'ready';
    } else if (validationResults) {
        stream.markdown(`❌ Some issues were found with your workspace setup:`);
        validationResults.issues.forEach(issue => {
            stream.markdown(`• ${issue}`);
        });
        
        stream.markdown(`\nPlease fix these issues and let me know when you're ready to validate again.`);
        conversationState.step = 'awaiting_setup';
    } else {
        stream.markdown(`❌ Failed to validate workspace setup. Please check the console for errors.`);
        conversationState.step = 'idle';
    }
}

async function handleExtraction(stream: vscode.ChatResponseStream) {
    conversationState.step = 'processing';
    stream.markdown(`🔄 Starting lineage extraction process...`);
    
    const startTime = Date.now();
    const result = await processAllMappings();
    const processingTime = (Date.now() - startTime) / 1000;
    
    showProcessingSummaryInChat(stream, result, processingTime);
    conversationState.step = 'idle';
}

async function handleFolderExtraction(stream: vscode.ChatResponseStream) {
    conversationState.step = 'processing';
    stream.markdown(`📁 Please select the folder you want to process...`);
    
    const folder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select folder with source files'
    });
    
    if (!folder || folder.length === 0) {
        stream.markdown('No folder selected. Operation cancelled.');
        conversationState.step = 'idle';
        return;
    }
    
    stream.markdown(`🔄 Starting lineage extraction from selected folder...`);
    
    const startTime = Date.now();
    const result = await processFolder(folder[0]);
    const processingTime = (Date.now() - startTime) / 1000;
    
    showProcessingSummaryInChat(stream, result, processingTime);
    conversationState.step = 'idle';
}

async function validateWorkspaceSetup(): Promise<ConversationState['validationResults']> {
    const config = getConfiguration();
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
    
    if (!workspaceFolder) {
        return {
            hasInputFolder: false,
            hasOutputFolder: false,
            hasInstructionFiles: false,
            hasSourceFiles: false,
            folderStructure: [],
            issues: ['No workspace folder is open. Please open a workspace first.']
        };
    }
    
    const issues: string[] = [];
    const folderStructure: string[] = [];
    
    // Check input folder
    const inputFolderUri = vscode.Uri.joinPath(workspaceFolder, config.inputFolder);
    let hasInputFolder = false;
    try {
        const stat = await vscode.workspace.fs.stat(inputFolderUri);
        if (stat.type === vscode.FileType.Directory) {
            hasInputFolder = true;
            folderStructure.push(`📁 ${config.inputFolder}/ (Input folder)`);
        } else {
            issues.push(`'${config.inputFolder}' exists but is not a directory.`);
        }
    } catch {
        issues.push(`Input folder '${config.inputFolder}' does not exist.`);
    }
    
    // Check output folder
    const outputFolderUri = vscode.Uri.joinPath(workspaceFolder, config.outputFolder);
    let hasOutputFolder = false;
    try {
        const stat = await vscode.workspace.fs.stat(outputFolderUri);
        if (stat.type === vscode.FileType.Directory) {
            hasOutputFolder = true;
            folderStructure.push(`📁 ${config.outputFolder}/ (Output folder)`);
        } else {
            issues.push(`'${config.outputFolder}' exists but is not a directory.`);
        }
    } catch {
        // Output folder will be created automatically, so this isn't an error
        folderStructure.push(`📁 ${config.outputFolder}/ (Output folder - will be created)`);
    }
    
    // Check instruction files
    let hasInstructionFiles = true;
    const instructionFiles = new Set(Object.values(config.fileTypeInstructions));
    instructionFiles.add(config.defaultInstructionFile);
    
    for (const file of instructionFiles) {
        const instructionFileUri = vscode.Uri.joinPath(workspaceFolder, file);
        try {
            const stat = await vscode.workspace.fs.stat(instructionFileUri);
            if (stat.type === vscode.FileType.File) {
                folderStructure.push(`📄 ${file} (Instruction file)`);
            } else {
                issues.push(`'${file}' exists but is not a file.`);
                hasInstructionFiles = false;
            }
        } catch {
            issues.push(`Instruction file '${file}' does not exist.`);
            hasInstructionFiles = false;
        }
    }
    
    // Check for source files in input folder
    let hasSourceFiles = false;
    if (hasInputFolder) {
        try {
            const files = await vscode.workspace.fs.readDirectory(inputFolderUri);
            const sourceFiles = files.filter(([name, type]) => 
                type === vscode.FileType.File && 
                Object.keys(config.fileTypeInstructions).some(ext => name.endsWith(`.${ext}`))
            );
            
            if (sourceFiles.length > 0) {
                hasSourceFiles = true;
                folderStructure.push(`   ├── Contains ${sourceFiles.length} source file(s)`);
                
                // Check subfolders
                const subfolders = files.filter(([name, type]) => type === vscode.FileType.Directory);
                for (const [name] of subfolders) {
                    const subfolderUri = vscode.Uri.joinPath(inputFolderUri, name);
                    const subfolderFiles = await vscode.workspace.fs.readDirectory(subfolderUri);
                    const subfolderSourceFiles = subfolderFiles.filter(([name, type]) => 
                        type === vscode.FileType.File && 
                        Object.keys(config.fileTypeInstructions).some(ext => name.endsWith(`.${ext}`))
                    );
                    
                    if (subfolderSourceFiles.length > 0) {
                        folderStructure.push(`   ├── 📁 ${name}/ (${subfolderSourceFiles.length} source file(s))`);
                    }
                }
            } else {
                issues.push(`No source files found in the input folder '${config.inputFolder}'.`);
            }
        } catch (error) {
            issues.push(`Error reading input folder: ${error}`);
        }
    }
    
    return {
        hasInputFolder,
        hasOutputFolder,
        hasInstructionFiles,
        hasSourceFiles,
        folderStructure,
        issues
    };
}

function showValidationResults(validationResults: ConversationState['validationResults']) {
    if (!validationResults) {
        vscode.window.showErrorMessage('Validation failed: No results returned.');
        return;
    }
    
    if (validationResults.issues.length === 0) {
        let message = `✅ Workspace validation successful!\n\n`;
        message += `Workspace Structure:\n`;
        validationResults.folderStructure.forEach(line => {
            message += `${line}\n`;
        });
        
        vscode.window.showInformationMessage(message);
    } else {
        let message = `❌ Some issues were found with your workspace setup:\n\n`;
        validationResults.issues.forEach(issue => {
            message += `• ${issue}\n`;
        });
        
        vscode.window.showErrorMessage(message);
    }
}

function showHelpInformation(stream: vscode.ChatResponseStream) {
    const config = getConfiguration();
    
    stream.markdown(`👋 Hello! I'm your Copilot Lineage Deriver assistant. I can help you extract data lineage from various file types.`);

    stream.markdown(`## 🚀 Getting Started

To begin, I'll guide you through the setup process:

1. **Workspace Structure**: 
   - Create a folder named \`${config.inputFolder}\` in your workspace
   - Place your source files (.xml, .sql, etc.) in this folder or its subfolders
   - I'll create the output folder \`${config.outputFolder}\` automatically

2. **Instruction Files**:
   - Create \`instructions.md\` for general guidance
   - Create \`sql_instructions.md\` for SQL-specific instructions
   - Add any other instruction files as needed

3. **Configuration**:
   - You can customize settings in \`.vscode/settings.json\`

## 💬 How to Proceed

I can help you with:
- Validating your workspace setup
- Extracting lineage from all files
- Extracting lineage from a specific folder
- Showing your current configuration

Have you already set up the workspace structure? (yes/no)`);
    
    stream.button({
        command: 'copilot-lineage-deriver.validateWorkspace',
        title: 'Validate Workspace'
    });
    
    stream.button({
        command: 'copilot-lineage-deriver.showConfiguration',
        title: 'Show Configuration'
    });
}

function getConfiguration(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('copilotLineageDeriver');
    return {
        inputFolder: config.get('inputFolder', 'source_data'),
        outputFolder: config.get('outputFolder', 'lineage_output'),
        delayBetweenRequests: config.get('delayBetweenRequests', 2000),
        batchSize: config.get('batchSize', 5),
        enableBatchProcessing: config.get('enableBatchProcessing', true),
        fileTypeInstructions: config.get('fileTypeInstructions', { xml: 'instructions.md', sql: 'sql_instructions.md' }),
        defaultInstructionFile: config.get('defaultInstructionFile', 'instructions.md')
    };
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
    conversationState = { step: 'idle' };
}
