import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { setTimeout } from 'timers/promises';

interface ExtensionConfig {
    xmlFolderPath: string;
    instructionsPath: string;
    outputFolder: string;
    maxConcurrent: number;
}

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('xml-to-csv-lineage.generateLineage', async () => {
        // Get configuration
        const config = vscode.workspace.getConfiguration('xmlToCsvLineage');
        const extensionConfig: ExtensionConfig = {
            xmlFolderPath: config.get('xmlFolderPath', 'informatica'),
            instructionsPath: config.get('instructionsPath', 'instructions.md'),
            outputFolder: config.get('outputFolder', 'output'),
            maxConcurrent: config.get('maxConcurrent', 5)
        };

        // Check if workspace is open
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri;
        const instructionsUri = vscode.Uri.joinPath(workspaceFolder, extensionConfig.instructionsPath);
        const xmlFolderUri = vscode.Uri.joinPath(workspaceFolder, extensionConfig.xmlFolderPath);
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

            // Get all XML files
            const xmlFiles = await vscode.workspace.fs.readDirectory(xmlFolderUri);
            const xmlFileUris = xmlFiles
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.xml'))
                .map(([name]) => vscode.Uri.joinPath(xmlFolderUri, name));

            if (xmlFileUris.length === 0) {
                vscode.window.showInformationMessage('No XML files found in the specified folder.');
                return;
            }

            // Process files with progress indicator
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating Lineage CSV Files",
                cancellable: true
            }, async (progress, token) => {
                let processed = 0;
                const total = xmlFileUris.length;

                // Process files in batches to avoid rate limiting
                const batchSize = extensionConfig.maxConcurrent;
                for (let i = 0; i < xmlFileUris.length; i += batchSize) {
                    if (token.isCancellationRequested) {
                        vscode.window.showInformationMessage('CSV generation cancelled.');
                        return;
                    }

                    const batch = xmlFileUris.slice(i, i + batchSize);
                    await Promise.all(batch.map(async (xmlUri) => {
                        if (token.isCancellationRequested) {
                            return;
                        }

                        try {
                            await processXmlFile(xmlUri, outputFolderUri, instructionsText);
                            processed++;
                            progress.report({ increment: (100 / total), message: `Processed ${processed}/${total} files` });
                        } catch (error) {
                            vscode.window.showErrorMessage(`Error processing ${path.basename(xmlUri.fsPath)}: ${error}`);
                        }
                    }));

                    // Add a small delay between batches to avoid rate limiting
                    if (i + batchSize < xmlFileUris.length) {
                        await setTimeout(1000);
                    }
                }

                vscode.window.showInformationMessage(`Successfully processed ${processed} XML files.`);
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
}

async function processXmlFile(xmlUri: vscode.Uri, outputFolderUri: vscode.Uri, instructionsText: string): Promise<void> {
    // Read XML file
    const xmlContent = await vscode.workspace.fs.readFile(xmlUri);
    const xmlText = Buffer.from(xmlContent).toString('utf8');

    // Extract basic info from XML for better prompting
    const parser = new XMLParser();
    let xmlObj;
    try {
        xmlObj = parser.parse(xmlText);
    } catch (error) {
        // If XML parsing fails, we'll still proceed with the raw text
        console.warn(`Could not parse XML file ${xmlUri.fsPath}: ${error}`);
    }

    // Create a prompt for Copilot
    const fileName = path.basename(xmlUri.fsPath, '.xml');
    const prompt = createPrompt(instructionsText, xmlText, xmlObj, fileName);

    // Get response from Copilot using agent mode
    const csvContent = await getCopilotResponse(prompt);

    // Save CSV file
    const csvFileName = `${fileName}.csv`;
    const csvUri = vscode.Uri.joinPath(outputFolderUri, csvFileName);
    await vscode.workspace.fs.writeFile(csvUri, Buffer.from(csvContent, 'utf8'));
}

function createPrompt(instructions: string, xmlText: string, xmlObj: any, fileName: string): string {
    return `
@workspace /generateLineage
I need to convert an XML file to a CSV lineage format.

## Instructions:
${instructions}

## XML File Name: ${fileName}

## XML Content:
${xmlText}

## XML Structure (parsed):
${JSON.stringify(xmlObj, null, 2)}

Please generate the CSV lineage content based on the instructions and XML provided.
The CSV should have the appropriate headers and data extracted from the XML.
Return only the CSV content without any additional explanation or markdown formatting.
`;
}

async function getCopilotResponse(prompt: string): Promise<string> {
    // This is a placeholder for the Copilot API interaction
    // In a real implementation, you would use the VS Code Language Model API
    
    // For now, we'll simulate the response with a delay
    await setTimeout(2000);
    
    // In a real implementation, you would use:
    // const response = await vscode.lm.sendChatRequest('copilot', [{ role: 'user', content: prompt }]);
    // let csvContent = '';
    // for await (const fragment of response.text) {
    //     csvContent += fragment;
    // }
    // return csvContent;
    
    // Simulated response for demonstration
    return `source,target,transformation,type
${prompt.split('\n')[0]},${prompt.split('\n')[1]},XML to CSV,automatic`;
}

export function deactivate() {}
