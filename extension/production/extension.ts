// Same as testing version but with these changes:

// 1. Remove testMode from ExtensionConfig interface
interface ExtensionConfig {
    sshCommand: string;
    scriptMetadataFileName: string;
    readCsvInstructionsFileName: string;
    cleansingInstructionsFileName: string;
    rawDdlScriptsDirectory: string;
    scriptedFilesDirectory: string;
    generatedScriptFileName: string;
    batchSize: number;
    // testMode removed
}

// 2. Remove testMode from loadConfiguration method
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
        batchSize: config.get('batchSize', 5)
        // testMode removed
    };
}

// 3. Remove all test mode checks from getCopilotResponse and executeShellScript methods
// (Remove the if (this.config.testMode) blocks and keep only the real implementation)
