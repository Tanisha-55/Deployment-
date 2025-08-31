import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

// Define interfaces for the proposed API
interface ChatParticipant {
    (request: any, context: any, response: any, token: vscode.CancellationToken): Promise<void>;
}

interface LanguageModelChat {
    selectChatModels(options: any): Promise<any[]>;
}

interface ChatAPI {
    createChatParticipant(id: string, handler: ChatParticipant): any;
}

// Extend the vscode namespace to include the proposed APIs
declare module 'vscode' {
    export namespace chat {
        export function createChatParticipant(id: string, handler: ChatParticipant): any;
    }
    
    export namespace lm {
        export function selectChatModels(options: any): Promise<any[]>;
    }
}

// Task configuration interface
interface DeploymentTask {
    id: string;
    name: string;
    enabled: boolean;
    description: string;
    handler: () => Promise<void>;
}

// Configuration interface
interface ExtensionConfig {
    sshCommand: string;
    scriptMetadataFileName: string;
    readCsvInstructionsFileName: string;
    cleansingInstructionsFileName: string;
    rawDdlScriptsDirectory: string;
    scriptedFilesDirectory: string;
    generatedScriptFileName: string;
    batchSize: number;
    taskExecutionOrder: string[];
    customTasks: DeploymentTask[];
}

export function activate(context: vscode.ExtensionContext) {
    const provider = new DeploymentAssistantProvider(context);
    
    // Register the command
    context.subscriptions.push(
        vscode.commands.registerCommand('deployment-assistant.start', () => {
            provider.startDeployment();
        })
    );

    // Try to register chat participant if API is available
    try {
        if ((vscode as any).chat && typeof (vscode as any).chat.createChatParticipant === 'function') {
            const chatAPI = (vscode as any).chat as ChatAPI;
            const chatParticipant = chatAPI.createChatParticipant(
                'deployment-assistant.chat',
                async (request: any, context: any, response: any, token: vscode.CancellationToken) => {
                    return provider.handleChatRequest(request, context, response, token);
                }
            );
            
            context.subscriptions.push(chatParticipant);
            console.log('Chat participant registered successfully');
        }
    } catch (error) {
        console.error('Failed to register chat participant:', error);
    }
}

class DeploymentAssistantProvider {
    private outputChannel: vscode.OutputChannel;
    private config: ExtensionConfig;
    private taskRegistry: Map<string, DeploymentTask> = new Map();
    
    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Deployment Assistant');
        this.config = this.loadConfiguration();
        this.registerDefaultTasks();
    }

    // Load configuration from VS Code settings
    private loadConfiguration(): ExtensionConfig {
        const config = vscode.workspace.getConfiguration('deploymentAssistant');
        
        return {
            sshCommand: config.get('sshCommand', 'ssh -K kumarita@ivapp1231650.devin3.ms.com'),
            scriptMetadataFileName: config.get('scriptMetadataFileName', 'Script_Metadata.csv'),
            readCsvInstructionsFileName: config.get('readCsvInstructionsFileName', 'readcsvscript.md'),
            cleansingInstructionsFileName: config.get('cleansingInstructionsFileName', 'cleansingscripts.md'),
            rawDdlScriptsDirectory: config.get('rawDdlScriptsDirectory', 'rawddlscripts'),
            scriptedFilesDirectory: config.get('scriptedFilesDirectory', 'scriptedfiles'),
            generatedScriptFileName: config.get('generatedScriptFileName', 'gendb2ddl.sh'),
            batchSize: config.get('batchSize', 5),
            taskExecutionOrder: config.get('taskExecutionOrder', ['csv-analysis', 'sql-cleansing']),
            customTasks: config.get('customTasks', [])
        };
    }

    // Register default tasks
    private registerDefaultTasks() {
        // Register core tasks
        this.registerTask({
            id: 'csv-analysis',
            name: 'CSV Analysis',
            enabled: true,
            description: 'Process CSV metadata to generate deployment scripts',
            handler: () => this.processCSVAnalysis()
        });

        this.registerTask({
            id: 'sql-cleansing',
            name: 'SQL Cleansing',
            enabled: true,
            description: 'Cleanse and augment SQL DDL files',
            handler: () => this.processSQLCleansing()
        });

        // Register custom tasks from configuration
        this.config.customTasks.forEach(task => {
            this.registerTask(task);
        });
    }

    // Register a task
    private registerTask(task: DeploymentTask) {
        this.taskRegistry.set(task.id, task);
        this.log(`Registered task: ${task.name} (${task.id})`);
    }

    // Reload configuration when settings change
    private reloadConfiguration() {
        this.config = this.loadConfiguration();
        // Re-register tasks to pick up any changes
        this.taskRegistry.clear();
        this.registerDefaultTasks();
    }

    // Validate configuration and provide helpful messages
    private validateConfiguration(config: ExtensionConfig): string[] {
        const warnings: string[] = [];
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        if (!workspaceFolder) {
            warnings.push('No workspace folder is open. Please open a workspace folder first.');
            return warnings;
        }
        
        const workspacePath = workspaceFolder.uri.fsPath;
        
        // Check if essential files exist
        const essentialFiles = [
            path.join(workspacePath, config.scriptMetadataFileName),
            path.join(workspacePath, config.readCsvInstructionsFileName),
            path.join(workspacePath, config.cleansingInstructionsFileName)
        ];
        
        essentialFiles.forEach(filePath => {
            if (!fs.existsSync(filePath)) {
                warnings.push(`File not found: ${filePath}. Please create this file or update the configuration.`);
            }
        });
        
        // Check if directories exist or need to be created
        const rawDir = path.join(workspacePath, config.rawDdlScriptsDirectory);
        if (!fs.existsSync(rawDir)) {
            warnings.push(`Raw DDL scripts directory not found: ${rawDir}. Please create this directory or update the configuration.`);
        }
        
        // Validate task execution order
        config.taskExecutionOrder.forEach(taskId => {
            if (!this.taskRegistry.has(taskId)) {
                warnings.push(`Task not found in execution order: ${taskId}. Please check your configuration.`);
            }
        });
        
        return warnings;
    }

    async startDeployment() {
        this.log('Starting deployment automation...');
        this.reloadConfiguration(); // Ensure we have the latest config
        
        // Validate configuration
        const warnings = this.validateConfiguration(this.config);
        if (warnings.length > 0) {
            const message = `Configuration issues found:\n${warnings.join('\n')}\n\nContinue anyway?`;
            const continueAnyway = await vscode.window.showWarningMessage(
                message,
                'Continue',
                'Cancel'
            );
            
            if (continueAnyway !== 'Continue') {
                this.log('Deployment cancelled due to configuration issues.');
                return;
            }
        }
        
        try {
            // Execute tasks in configured order
            for (const taskId of this.config.taskExecutionOrder) {
                const task = this.taskRegistry.get(taskId);
                if (task && task.enabled) {
                    this.log(`Executing task: ${task.name}`);
                    await task.handler();
                }
            }
            
            vscode.window.showInformationMessage('Deployment automation completed successfully!');
            this.log('Deployment automation completed!');
        } catch (error) {
            vscode.window.showErrorMessage(`Deployment automation failed: ${error}`);
            this.log(`Deployment automation failed: ${error}`);
        }
    }

    async handleChatRequest(
        request: any,
        context: any,
        response: any,
        token: vscode.CancellationToken
    ): Promise<void> {
        const prompt = request.prompt.toLowerCase();
        this.log(`Received chat request: ${request.prompt}`);
        
        // Handle @deploy command
        if (prompt.includes('@deploy') || prompt.includes('@deployment')) {
            await this.handleDeployCommand(request, response, token);
            return;
        }
        
        // Handle @deploy status command
        if (prompt.includes('@deploy status') || prompt.includes('@deployment status')) {
            await this.handleStatusCommand(response);
            return;
        }
        
        // Handle @deploy help command
        if (prompt.includes('@deploy help') || prompt.includes('@deployment help')) {
            await this.handleHelpCommand(response);
            return;
        }
        
        // Default response
        response.markdown('Deployment Assistant is ready. Use @deploy to start automation or @deploy help for more options.');
    }

    private async handleDeployCommand(request: any, response: any, token: vscode.CancellationToken) {
        // Parse options from the command
        const prompt = request.prompt.toLowerCase();
        
        // Show progress in the chat
        response.markdown('🚀 Starting deployment automation...\n\n');
        
        try {
            // Execute the deployment with progress updates
            await this.executeDeploymentWithProgress(response);
            response.markdown('✅ Deployment automation completed successfully!');
        } catch (error) {
            response.markdown(`❌ Deployment automation failed: ${error}`);
        }
    }

    private async executeDeploymentWithProgress(response: any) {
        this.reloadConfiguration();
        
        // Validate configuration
        const warnings = this.validateConfiguration(this.config);
        if (warnings.length > 0) {
            response.markdown('⚠️ Configuration issues found. Continuing anyway...\n\n');
        }
        
        // Execute tasks in configured order with progress updates
        for (const taskId of this.config.taskExecutionOrder) {
            const task = this.taskRegistry.get(taskId);
            if (task && task.enabled) {
                response.markdown(`⏳ Executing: ${task.name}...\n`);
                try {
                    await task.handler();
                    response.markdown(`✅ Completed: ${task.name}\n\n`);
                } catch (error) {
                    response.markdown(`❌ Failed: ${task.name} - ${error}\n\n`);
                    throw error;
                }
            }
        }
    }

    private async handleStatusCommand(response: any) {
        // Get task status
        const taskStatus = Array.from(this.taskRegistry.values()).map(task => {
            return `- ${task.enabled ? '✅' : '❌'} ${task.name} (${task.id})`;
        }).join('\n');
        
        // Provide status information
        response.markdown(`## Deployment Assistant Status\n\n${taskStatus}\n\nUse \`@deploy\` to start automation.`);
    }

    private async handleHelpCommand(response: any) {
        // Show help information
        response.markdown('## Deployment Assistant Help\n\n' +
            '- `@deploy`: Start deployment automation\n' +
            '- `@deploy status`: Check deployment status\n' +
            '- `@deploy help`: Show this help message\n\n' +
            '## Available Tasks\n\n' +
            Array.from(this.taskRegistry.values()).map(task => {
                return `- **${task.name}**: ${task.description} ${task.enabled ? '(enabled)' : '(disabled)'}`;
            }).join('\n'));
    }

    private async processCSVAnalysis() {
        this.log('Processing CSV Analysis with Copilot...');
        
        // Get the workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        
        const workspacePath = workspaceFolder.uri.fsPath;
        
        // Read the CSV file from workspace using configurable name
        const csvPath = path.join(workspacePath, this.config.scriptMetadataFileName);
        this.log(`Reading CSV from: ${csvPath}`);
        
        if (!fs.existsSync(csvPath)) {
            throw new Error(`CSV file not found: ${csvPath}. Please ensure the file exists or configure the correct filename in settings.`);
        }
        
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        
        // Read the instructions from markdown in workspace using configurable name
        const instructionsPath = path.join(workspacePath, this.config.readCsvInstructionsFileName);
        this.log(`Reading instructions from: ${instructionsPath}`);
        
        if (!fs.existsSync(instructionsPath)) {
            throw new Error(`Instructions file not found: ${instructionsPath}. Please ensure the file exists or configure the correct filename in settings.`);
        }
        
        const instructions = fs.readFileSync(instructionsPath, 'utf-8');

        // Get the shell script from Copilot
        this.log('Requesting shell script from Copilot...');
        const shellScriptResponse = await this.getCopilotResponse(
            `${instructions}\n\nCSV Content:\n${csvContent}\n\nIMPORTANT: Only output the shell script commands, no explanatory text.`
        );
        
        // Extract only the shell commands from the response
        const shellScript = this.extractShellCommands(shellScriptResponse);
        
        // Save the generated shell script to workspace using configurable name
        const scriptPath = path.join(workspacePath, this.config.generatedScriptFileName);
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

    private extractShellCommands(response: string): string {
        this.log('Extracting shell commands from response...');
        
        // Remove any markdown code block markers
        let cleanedResponse = response.replace(/```(?:shell|bash)?/g, '');
        
        // Remove any explanatory text before or after the commands
        const lines = cleanedResponse.split('\n');
        const commandLines = lines.filter(line => {
            const trimmed = line.trim();
            // Keep lines that are either:
            // 1. Empty lines
            // 2. Comment lines (starting with #)
            // 3. Shell commands (not starting with words like "Here", "Note", etc.)
            return trimmed === '' || 
                   trimmed.startsWith('#') || 
                   !/^(Here is|Note:|Make sure|This script|If you)/i.test(trimmed);
        });
        
        // Join the lines back together
        const result = commandLines.join('\n').trim();
        
        this.log(`Extracted commands: \n${result}`);
        return result;
    }

    private async processSQLCleansing() {
        this.log('Processing SQL Cleansing with Copilot...');
        
        // Get the workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        
        const workspacePath = workspaceFolder.uri.fsPath;
        
        // Read the cleansing instructions from workspace using configurable name
        const instructionsPath = path.join(workspacePath, this.config.cleansingInstructionsFileName);
        this.log(`Reading cleansing instructions from: ${instructionsPath}`);
        
        if (!fs.existsSync(instructionsPath)) {
            throw new Error(`Cleansing instructions file not found: ${instructionsPath}. Please ensure the file exists or configure the correct filename in settings.`);
        }
        
        const instructions = fs.readFileSync(instructionsPath, 'utf-8');
        
        // Use configurable directory names
        const rawDir = path.join(workspacePath, this.config.rawDdlScriptsDirectory);
        const outputDir = path.join(workspacePath, this.config.scriptedFilesDirectory);
        
        if (!fs.existsSync(rawDir)) {
            throw new Error(`Raw DDL scripts directory not found: ${rawDir}. Please ensure the directory exists or configure the correct directory name in settings.`);
        }
        
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const files = fs.readdirSync(rawDir);
        this.log(`Found ${files.length} files in ${this.config.rawDdlScriptsDirectory} directory`);
        
        // Process files in batches using configurable batch size
        for (let i = 0; i < files.length; i += this.config.batchSize) {
            const batch = files.slice(i, i + this.config.batchSize);
            this.log(`Processing batch ${Math.floor(i/this.config.batchSize) + 1} of ${Math.ceil(files.length/this.config.batchSize)}`);
            
            // Process each file in the batch in parallel
            await Promise.all(batch.map(async (file) => {
                if (file.endsWith('.sql')) {
                    try {
                        this.log(`Cleansing file: ${file}`);
                        const content = fs.readFileSync(path.join(rawDir, file), 'utf-8');
                        
                        // Get cleansed SQL from Copilot with enhanced prompt
                        this.log(`Requesting cleansing for file: ${file}`);
                        const cleansedContent = await this.getCopilotResponse(
                            `${instructions}\n\nIMPORTANT: Only output the SQL code without any additional explanations, notes, or markdown formatting.\n\nSQL to cleanse:\n${content}`
                        );
                        
                        // Extract only the SQL code from the response
                        const finalContent = this.extractSQLCode(cleansedContent);
                        
                        fs.writeFileSync(path.join(outputDir, file), finalContent);
                        this.log(`Cleansed file saved: ${file}`);
                    } catch (error) {
                        this.log(`Error processing file ${file}: ${error}`);
                        // Continue with other files even if one fails
                    }
                }
            }));
            
            // Add a small delay between batches to avoid rate limiting
            if (i + this.config.batchSize < files.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Show completion message
        vscode.window.showInformationMessage(`Processed ${files.length} files. Please review the output in ${this.config.scriptedFilesDirectory}/ directory.`);
    }

    private extractSQLCode(response: string): string {
        this.log('Extracting SQL code from response...');
        
        // Remove any markdown code block markers
        let cleanedResponse = response.replace(/```(?:sql)?/g, '');
        
        // Remove any explanatory text before or after the code
        const lines = cleanedResponse.split('\n');
        const codeLines = lines.filter(line => {
            const trimmed = line.trim();
            // Keep lines that are either:
            // 1. Empty lines
            // 2. SQL comment lines (starting with -- or /*)
            // 3. SQL commands (not starting with words like "Here", "Note", etc.)
            return trimmed === '' || 
                   trimmed.startsWith('--') || 
                   trimmed.startsWith('/*') ||
                   !/^(Here is|Note:|Output:|\*\*|This is)/i.test(trimmed);
        });
        
        // Join the lines back together
        const result = codeLines.join('\n').trim();
        
        this.log(`Extracted SQL code: \n${result}`);
        return result;
    }

    private async getCopilotResponse(prompt: string): Promise<string> {
        try {
            this.log('Checking if Language Model API is available...');
            
            // Check if Language Model API is available
            if (!(vscode as any).lm) {
                this.log('Language Model API is not available');
                throw new Error('Language Model API is not available. Please ensure you have the latest VS Code version with Copilot support.');
            }
            
            const lm = (vscode as any).lm as LanguageModelChat;
            this.log('Language Model API is available');
            
            this.log('Selecting chat models...');
            
            // Try different model selection strategies based on VS Code documentation
            let models: any[] = [];
            let selectionStrategies = [
                { vendor: 'GitHub', name: 'copilot' },
                { vendor: 'GitHub', family: 'gpt-4o' },
                { vendor: 'GitHub', family: 'gpt-4o-mini' },
                { vendor: 'GitHub' },
                { vendor: 'copilot' },
                { family: 'gpt-4o' },
                { family: 'gpt-4o-mini' },
                {} // Try without any filters
            ];
            
            for (const strategy of selectionStrategies) {
                try {
                    this.log(`Trying model selection with: ${JSON.stringify(strategy)}`);
                    models = await lm.selectChatModels(strategy);
                    this.log(`Found ${models.length} models with strategy: ${JSON.stringify(strategy)}`);
                    
                    if (models.length > 0) {
                        this.log(`Models found: ${models.map(m => `${m.name} (${m.vendor})`).join(', ')}`);
                        break;
                    }
                } catch (err) {
                    this.log(`Error with strategy ${JSON.stringify(strategy)}: ${err}`);
                }
            }
            
            if (models.length === 0) {
                this.log('No language models available after trying all strategies');
                
                // Try to get all available models to debug what's available
                try {
                    const allModels = await lm.selectChatModels({});
                    this.log(`All available models: ${JSON.stringify(allModels.map(m => ({
                        name: m.name,
                        vendor: m.vendor,
                        family: m.family
                    })))}`);
                } catch (err) {
                    this.log(`Error getting all models: ${err}`);
                }
                
                throw new Error('No language models available. Please ensure you have GitHub Copilot enabled and configured.');
            }
            
            // Use the first available model
            const model = models[0];
            this.log(`Using model: ${model.name} from vendor: ${model.vendor}`);
            
            // Create messages for the language model using object format
            const messages = [
                { role: 'user', content: prompt }
            ];
            
            // Send request to the language model
            this.log('Sending request to language model...');
            const chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
            
            let responseText = '';
            for await (const fragment of chatResponse.text) {
                responseText += fragment;
            }
            
            this.log('Received response from language model');
            return responseText;
        } catch (error) {
            this.log(`Error getting Copilot response: ${error}`);
            
            // Type-safe error handling
            if (error && typeof error === 'object' && 'code' in error) {
                const errorCode = (error as { code: string }).code;
                switch (errorCode) {
                    case 'NoPermissions':
                        throw new Error('No permissions to use language models. Please grant consent for this extension to use GitHub Copilot.');
                    case 'NoModels':
                        throw new Error('No language models available. Please install and configure GitHub Copilot.');
                    case 'ResponseTooSlow':
                        throw new Error('The response from the language model was too slow. Please try again.');
                    default:
                        const errorMessage = (error as { message?: string }).message || 'Unknown error';
                        throw new Error(`Language model error: ${errorMessage}`);
                }
            }
            
            // Handle non-LanguageModelError cases
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to get response from Copilot: ${errorMessage}`);
        }
    }

    private async executeShellScript(workspacePath: string) {
        this.log('Executing shell script...');
        
        const scriptPath = path.join(workspacePath, this.config.generatedScriptFileName);
        
        // Use configurable SSH command
        const fullCommand = `${this.config.sshCommand} "cd ${workspacePath.replace(/\\/g, '/')} && ./${this.config.generatedScriptFileName}"`;
        
        this.log(`Executing: ${fullCommand}`);
        
        try {
            const startTime = new Date();
            this.log(`SSH session started at: ${startTime.toISOString()}`);
            
            await new Promise((resolve, reject) => {
                const process = child_process.exec(fullCommand, { cwd: workspacePath }, (error, stdout, stderr) => {
                    const endTime = new Date();
                    const duration = endTime.getTime() - startTime.getTime();
                    
                    this.log(`SSH session completed in ${duration}ms`);
                    
                    if (error) {
                        this.log(`Error executing SSH command: ${error}`);
                        this.log(`Error code: ${error.code}`);
                        this.log(`Error signal: ${error.signal}`);
                        reject(error);
                    } else {
                        if (stdout) {
                            this.log(`SSH command output: ${stdout}`);
                        } else {
                            this.log('SSH command produced no output');
                        }
                        if (stderr) {
                            this.log(`SSH command error output: ${stderr}`);
                        }
                        resolve(stdout);
                    }
                });
                
                // Add a timeout to prevent hanging indefinitely
                const timeout = setTimeout(() => {
                    this.log(`SSH command timeout after 10 minutes`);
                    process.kill();
                    reject(new Error(`SSH command timed out after 10 minutes`));
                }, 10 * 60 * 1000); // 10 minutes timeout
                
                process.on('close', () => {
                    clearTimeout(timeout);
                });
            });
            
            this.log('SSH command execution completed successfully');
        } catch (error) {
            this.log(`Failed to execute SSH command: ${error}`);
            throw error;
        }
    }

    private log(message: string) {
        this.outputChannel.appendLine(`${new Date().toISOString()}: ${message}`);
    }
}

export function deactivate() {}
