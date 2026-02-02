# Project Omen Exit Codes

Project Omen is a desktop application built with Electron. It uses standard exit codes as defined by the operating system and Electron framework.

## Standard Exit Codes

| Exit Code | Meaning | Description |
|-----------|---------|-------------|
| 0 | Success | Application closed normally |
| 1 | General Error | Unspecified error occurred |
| 2 | Misuse | Invalid command line arguments |
| 3 | Internal Error | Application encountered an internal error |
| 130 | Terminated by User | User terminated the process (Ctrl+C) |

## Framework-Specific Codes

As an Electron application, Project Omen may also return exit codes specific to the Electron/Chromium runtime:

- Exit codes 1-127: Standard POSIX exit codes
- Exit codes 128+: Signal-related termination codes

For complete Electron exit code documentation, see:
https://www.electronjs.org/docs/latest/api/app#appexitexitcode

## Normal Operation

Under normal circumstances, Project Omen exits with code 0 when the user closes the application through the UI (File > Exit, window close button, or Alt+F4).

## Error Handling

If Project Omen encounters a critical error that prevents it from continuing, it will:
1. Display an error dialog to the user (when possible)
2. Log the error details to the console
3. Exit with a non-zero exit code

Users are not expected to monitor exit codes during normal use. Exit codes are primarily useful for:
- Automated testing
- Scripting and batch operations
- Debugging installation or launch issues

## Contact

For application errors or issues, please report them through the GitHub Issues page rather than relying on exit codes alone.
