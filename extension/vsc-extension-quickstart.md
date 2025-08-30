# Deployment Assistant Extension Quickstart

This guide will help you get started with developing the Deployment Assistant extension.

## Prerequisites

- Node.js (version 16 or higher)
- Visual Studio Code
- GitHub Copilot subscription

## Setup

1. Clone or create the extension repository
2. Run `npm install` to install dependencies
3. Open the project in VS Code

## Development

1. Make changes to the extension code in `src/extension.ts`
2. Run `npm run compile` to compile TypeScript to JavaScript
3. Press `F5` to launch a new VS Code window with the extension loaded
4. Test the extension by running the "Start Deployment Automation" command

## Testing

1. Create a test workspace with the required files:
   - `Script_Metadata.csv`
   - `readcsvscript.md`
   - `cleansingscripts.md`
   - `rawddlscripts/` directory with sample SQL files

2. Run the extension and verify:
   - CSV analysis generates a shell script
   - SQL files are processed and saved to the output directory
   - SSH command executes successfully (if configured)

## Publishing

1. Update the version in `package.json`
2. Run `npm run compile` to ensure latest changes are compiled
3. Follow VS Code extension publishing guidelines to package and publish

## Configuration

The extension supports these configurable settings:

- `deploymentAssistant.sshCommand`: SSH command for remote execution
- `deploymentAssistant.scriptMetadataFileName`: Script metadata CSV filename
- `deploymentAssistant.readCsvInstructionsFileName`: CSV instructions filename
- `deploymentAssistant.cleansingInstructionsFileName`: SQL cleansing instructions filename
- `deploymentAssistant.rawDdlScriptsDirectory`: Raw DDL scripts directory name
- `deploymentAssistant.scriptedFilesDirectory`: Processed scripts directory name
- `deploymentAssistant.generatedScriptFileName`: Generated shell script filename
- `deploymentAssistant.batchSize`: Batch size for file processing

## Troubleshooting

- Ensure GitHub Copilot is installed and enabled
- Check that the Language Model API is available in your VS Code version
- Verify SSH configuration if experiencing connection issues
- Check the Output panel for detailed logs ("Deployment Assistant" channel)

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [GitHub Copilot Documentation](https://docs.github.com/en/copilot)
- [Node.js Documentation](https://nodejs.org/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
