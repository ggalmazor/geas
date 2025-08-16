import { Logger } from '../logger/mod.ts';

export interface CommandOptions {
  stdin?: string;
  timeout?: number;
  cwd?: string | undefined;
  env?: Record<string, string> | undefined;
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

const logger = await Logger.getInstance();

export async function executeCommand(
  command: string,
  args: string[] = [],
  options: CommandOptions = {},
): Promise<CommandResult> {
  const cwd = options.cwd || Deno.cwd();
  const logEntry = logger.logCommandStart(command, args, cwd);

  try {
    const commandOptions: Deno.CommandOptions = {
      args,
      stdin: options.stdin ? 'piped' : 'inherit',
      stdout: 'piped',
      stderr: 'piped',
    };

    if (options.cwd) {
      commandOptions.cwd = options.cwd;
    }

    if (options.env) {
      commandOptions.env = options.env;
    }

    const process = new Deno.Command(command, commandOptions);

    const child = process.spawn();

    // Handle stdin if provided
    if (options.stdin) {
      const writer = child.stdin.getWriter();
      await writer.write(new TextEncoder().encode(options.stdin));
      await writer.close();
    }

    // Handle timeout
    let timeoutId: number | undefined;
    if (options.timeout) {
      timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
      }, options.timeout);
    }

    const output = await child.output();

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);
    const success = output.success;
    const exitCode = output.code;

    logger.logCommandEnd(logEntry, success, stdout, stderr, exitCode);

    return {
      success,
      stdout,
      stderr,
      exitCode,
      duration: logEntry.duration || 0,
    };
  } catch (error) {
    logger.logCommandEnd(logEntry, false, undefined, String(error));
    logger.error(`Command execution failed: ${command}`, error);

    return {
      success: false,
      stdout: '',
      stderr: String(error),
      exitCode: -1,
      duration: logEntry.duration || 0,
    };
  }
}
