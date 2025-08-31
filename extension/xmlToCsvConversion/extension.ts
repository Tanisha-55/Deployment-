import * as vscode from 'vscode';
import * as path from 'path';
import { setTimeout } from 'timers/promises';

interface ExtensionConfig {
    mappingsFolderPath: string;
    instructionsPath: string;
    outputFolder: string;
    delayBetweenRequests: number;
}

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('copilot-lineage-deriver.generateLineage', async () => {
        // Get configuration
        const config = vscode.workspace.getConfiguration('copilotLineageDeriver');
        const extensionConfig: ExtensionConfig = {
            mappingsFolderPath: config.get('mappingsFolderPath', 'individual_mappings'),
            instructionsPath: config.get('instructionsPath', 'instructions.md'),
            outputFolder: config.get('outputFolder', 'lineage_csv'),
            delayBetweenRequests: config.get('delayBetweenRequests', 2000)
        };

        // Check if workspace is open
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return;
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
                return;
            }

            // Process files with progress indicator
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating Lineage CSV Files with Copilot",
                cancellable: true
            }, async (progress, token) => {
                let totalProcessed = 0;
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
                                message: `Processed ${totalProcessed}/${totalFiles} files` 
                            });
                            
                            // Add delay between requests as specified in instructions
                            await setTimeout(extensionConfig.delayBetweenRequests);
                        } catch (error) {
                            vscode.window.showErrorMessage(`Error processing ${path.basename(xmlUri.fsPath)}: ${error}`);
                        }
                    }
                }

                if (token.isCancellationRequested) {
                    vscode.window.showInformationMessage('CSV generation cancelled.');
                } else {
                    vscode.window.showInformationMessage(`Successfully processed ${totalProcessed} XML files. CSV files saved to ${extensionConfig.outputFolder}`);
                }
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
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
