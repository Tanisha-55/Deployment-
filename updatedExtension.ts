import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    const provider = new DeploymentAssistantProvider(context);
    
    context.subscriptions.push(
        vscode.commands.registerCommand('deployment-assistant.start', () => {
            provider.startDeployment();
        })
    );

    // Register chat participant if the API is available
    if (vscode.chat && 'createChatParticipant' in vscode.chat) {
        try {
            const chatParticipant = vscode.chat.createChatParticipant(
                'deployment-assistant.chat',
                (request, context, response, token) => {
                    return provider.handleChatRequest(request, context, response, token);
                }
            );
            
            chatParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
            context.subscriptions.push(chatParticipant);
        } catch (error) {
            console.error('Failed to register chat participant:', error);
        }
    }
}

class DeploymentAssistantProvider {
    private outputChannel: vscode.OutputChannel;
    
    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Deployment Assistant');
    }

    async startDeployment() {
        this.log('Starting deployment automation...');
        try {
            await this.processCSVAnalysis();
            await this.processSQLCleansing();
            vscode.window.showInformationMessage('Deployment automation completed successfully!');
            this.log('Deployment automation completed!');
        } catch (error) {
            vscode.window.showErrorMessage(`Deployment automation failed: ${error}`);
            this.log(`Deployment automation failed: ${error}`);
        }
    }

    async handleChatRequest(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        response: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        this.log(`Received chat request: ${request.prompt}`);
        
        response.markdown('Deployment Assistant is ready. Use the command palette to start automation.');
        
        if (request.prompt.toLowerCase().includes('start deployment')) {
            response.markdown('Starting deployment automation...');
            this.startDeployment();
        }
    }

    private async processCSVAnalysis() {
        this.log('Processing CSV Analysis with Copilot...');
        
        // Get the workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        
        const workspacePath = workspaceFolder.uri.fsPath;
        
        // Read the CSV file from workspace
        const csvPath = path.join(workspacePath, 'Script_Metadata.csv');
        this.log(`Reading CSV from: ${csvPath}`);
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        
        // Read the instructions from markdown in workspace
        const instructionsPath = path.join(workspacePath, 'readcsvscript.md');
        this.log(`Reading instructions from: ${instructionsPath}`);
        const instructions = fs.readFileSync(instructionsPath, 'utf-8');
        
        // Get the shell script from Copilot
        this.log('Requesting shell script from Copilot...');
        const shellScript = await this.getCopilotResponse(
            `${instructions}\n\nCSV Content:\n${csvContent}`
        );
        
        // Save the generated shell script to workspace
        const scriptPath = path.join(workspacePath, 'gendb2ddl.sh');
        this.log(`Saving shell script to: ${scriptPath}`);
        fs.writeFileSync(scriptPath, shellScript);
        
        // Make it executable (Unix/Linux/Mac)
        if (process.platform !== 'win32') {
            fs.chmodSync(scriptPath, 0o755);
        }
        
        // Execute the shell script
        this.log('Executing shell script...');
        await this.executeShellScript(workspacePath);
    }

    private async processSQLCleansing() {
        this.log('Processing SQL Cleansing with Copilot...');
        
        // Get the workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        
        const workspacePath = workspaceFolder.uri.fsPath;
        
        // Read the cleansing instructions from workspace
        const instructionsPath = path.join(workspacePath, 'cleansingscripts.md');
        this.log(`Reading cleansing instructions from: ${instructionsPath}`);
        const instructions = fs.readFileSync(instructionsPath, 'utf-8');
        
        const rawDir = path.join(workspacePath, 'rawddlscripts/');
        const outputDir = path.join(workspacePath, 'scriptedfiles/');
        
        if (!fs.existsSync(rawDir)) {
            throw new Error('Raw DDL scripts directory not found!');
        }
        
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const files = fs.readdirSync(rawDir);
        this.log(`Found ${files.length} files in rawddlscripts directory`);
        
        for (const file of files) {
            if (file.endsWith('.sql')) {
                this.log(`Cleansing file: ${file}`);
                const content = fs.readFileSync(path.join(rawDir, file), 'utf-8');
                
                // Get cleansed SQL from Copilot
                this.log(`Requesting cleansing for file: ${file}`);
                const cleansedContent = await this.getCopilotResponse(
                    `${instructions}\n\nSQL to cleanse:\n${content}`
                );
                
                fs.writeFileSync(path.join(outputDir, file), cleansedContent);
                this.log(`Cleansed file saved: ${file}`);
            }
        }
    }

    private async getCopilotResponse(prompt: string): Promise<string> {
        try {
            this.log('Checking if Language Model API is available...');
            
            // Check if Language Model API is available
            if (!vscode.lm) {
                this.log('Language Model API is not available');
                throw new Error('Language Model API is not available. Please ensure you have the latest VS Code version with Copilot support.');
            }
            
            this.log('Language Model API is available');
            
            this.log('Selecting chat models...');
            // Try to get a model from the Copilot vendor with a supported family
            const models = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-4o' // or try 'gpt-4o-mini' if this fails
            });
            
            this.log(`Found ${models.length} available models`);
            
            if (models.length === 0) {
                // If no models are found, try without specifying the family
                const allModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
                this.log(`Found ${allModels.length} models without family filter`);
                if (allModels.length === 0) {
                    throw new Error('No Copilot models available. Please ensure you have GitHub Copilot enabled and have given consent for this extension to use it.');
                }
                // Use the first model from the unfiltered list
                const model = allModels[0];
                this.log(`Using model: ${model.name}`);
                return await this.sendModelRequest(model, prompt);
            }
            
            // Use the first model from the filtered list
            const model = models[0];
            this.log(`Using model: ${model.name}`);
            return await this.sendModelRequest(model, prompt);
        } catch (error) {
            if (error instanceof vscode.LanguageModelError) {
                this.log(`Language Model Error: ${error.message}, code: ${error.code}`);
                if (error.code === 'NoPermissions') {
                    vscode.window.showErrorMessage('Please grant consent for this extension to use GitHub Copilot. You can do this by enabling Copilot and allowing it in the settings.');
                    throw new Error('Consent not given for using language models.');
                }
                throw new Error(`Language model error: ${error.message}`);
            } else {
                this.log(`Error getting Copilot response: ${error}`);
                throw new Error(`Failed to get response from Copilot: ${error}`);
            }
        }
    }

    private async sendModelRequest(model: vscode.LanguageModelChat, prompt: string): Promise<string> {
        this.log('Sending request to language model...');
        const tokenSource = new vscode.CancellationTokenSource();
        
        try {
            const chatResponse = await model.sendRequest(
                [vscode.LanguageModelChatMessage.User(prompt)],
                {},
                tokenSource.token
            );
            
            let responseText = '';
            for await (const fragment of chatResponse.text) {
                responseText += fragment;
            }
            
            this.log('Received response from language model');
            return responseText;
        } catch (error) {
            if (error instanceof vscode.LanguageModelError) {
                this.log(`Language Model Error during request: ${error.message}, code: ${error.code}`);
                if (error.code === 'NoPermissions') {
                    vscode.window.showErrorMessage('Please grant consent for this extension to use GitHub Copilot.');
                    throw new Error('Consent not given for using language models.');
                } else if (error.code === 'NoModels') {
                    throw new Error('No language models are available. Please install GitHub Copilot.');
                } else if (error.code === 'ResponseTooSlow') {
                    throw new Error('The response from the language model was too slow. Please try again.');
                } else {
                    throw new Error(`Language model error: ${error.message}`);
                }
            } else {
                this.log(`Error during model request: ${error}`);
                throw new Error(`Failed to get response from language model: ${error}`);
            }
        } finally {
            tokenSource.dispose();
        }
    }

    private async executeShellScript(workspacePath: string) {
        this.log('Executing shell script...');
        
        const scriptPath = path.join(workspacePath, 'gendb2ddl.sh');
        const commands = fs.readFileSync(scriptPath, 'utf-8').split('\n');
        
        this.log(`Found ${commands.length} commands in shell script`);
        
        for (const cmd of commands) {
            const trimmedCmd = cmd.trim();
            if (trimmedCmd && !trimmedCmd.startsWith('#')) {
                this.log(`Executing: ${trimmedCmd}`);
                
                // Execute command in the workspace directory
                await new Promise((resolve, reject) => {
                    child_process.exec(trimmedCmd, { cwd: workspacePath }, (error, stdout, stderr) => {
                        if (error) {
                            this.log(`Error executing command: ${error}`);
                            reject(error);
                        } else {
                            if (stdout) this.log(`Output: ${stdout}`);
                            if (stderr) this.log(`Error output: ${stderr}`);
                            resolve(stdout);
                        }
                    });
                });
            }
        }
    }

    private log(message: string) {
        this.outputChannel.appendLine(`${new Date().toISOString()}: ${message}`);
    }
}

export function deactivate() {}
