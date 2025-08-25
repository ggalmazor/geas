import { join } from '@std/path';
import { ensureDir } from '@std/fs';

export interface CommandLogEntry {
  command: string;
  args: string[];
  workingDir: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  stdout?: string | undefined;
  stderr?: string | undefined;
  exitCode?: number | undefined;
}

export class Logger {
  private static instance: Logger;
  private readonly logDir: string;
  private logFile?: Deno.FsFile;
  private commandLogFile?: Deno.FsFile;

  private constructor(logDir = './logs') {
    this.logDir = logDir;
  }

  static async getInstance(logDir = './logs'): Promise<Logger> {
    if (!Logger.instance) {
      Logger.instance = new Logger(logDir);
      await Logger.instance.initialize();
    }
    return Logger.instance;
  }

  private async initialize(): Promise<void> {
    await ensureDir(this.logDir);

    const logFilePath = join(this.logDir, 'geas.log');
    const commandsFilePath = join(this.logDir, 'commands.log');

    this.logFile = await Deno.open(logFilePath, {
      write: true,
      create: true,
      append: true,
    });

    this.commandLogFile = await Deno.open(commandsFilePath, {
      write: true,
      create: true,
      append: true,
    });
  }

  private async writeToFile(
    file: Deno.FsFile | undefined,
    message: string,
  ): Promise<void> {
    if (file) {
      const timestamp = new Date().toISOString();
      const logLine = `${timestamp} | ${message}\n`;
      await file.write(new TextEncoder().encode(logLine));
    }
  }

  error(
    message: string,
    error?: Error | unknown,
    meta?: Record<string, unknown>,
  ): void {
    const errorInfo = error instanceof Error ? { error: error.message, stack: error.stack } : { error: String(error) };

    const logMessage = `ERROR: ${message} ${JSON.stringify({ ...errorInfo, ...meta })}`;
    this.writeToFile(this.logFile, logMessage).catch(console.error);
  }

  logCommandStart(
    command: string,
    args: string[],
    workingDir: string,
  ): CommandLogEntry {
    const entry: CommandLogEntry = {
      command,
      args,
      workingDir,
      startTime: new Date(),
      success: false,
    };

    this.writeToFile(
      this.commandLogFile,
      `COMMAND_START: ${command} ${args.join(' ')} (cwd: ${workingDir})`,
    ).catch(console.error);

    return entry;
  }

  logCommandEnd(
    entry: CommandLogEntry,
    success: boolean,
    stdout?: string | undefined,
    stderr?: string | undefined,
    exitCode?: number | undefined,
  ): void {
    entry.endTime = new Date();
    entry.duration = entry.endTime.getTime() - entry.startTime.getTime();
    entry.success = success;
    entry.stdout = stdout;
    entry.stderr = stderr;
    entry.exitCode = exitCode;

    const status = success ? 'SUCCESS' : 'FAILED';
    const duration = entry.duration;

    this.writeToFile(
      this.commandLogFile,
      `COMMAND_END: ${entry.command} - ${status} (${duration}ms)`,
    ).catch(console.error);

    if (stdout && stdout.length > 0) {
      this.writeToFile(
        this.commandLogFile,
        `STDOUT: ${stdout.slice(0, 1000)}${stdout.length > 1000 ? '...' : ''}`,
      ).catch(console.error);
    }

    if (stderr && stderr.length > 0) {
      this.writeToFile(
        this.commandLogFile,
        `STDERR: ${stderr.slice(0, 1000)}${stderr.length > 1000 ? '...' : ''}`,
      ).catch(console.error);
    }

    if (exitCode !== undefined) {
      this.writeToFile(this.commandLogFile, `EXIT_CODE: ${exitCode}`).catch(
        console.error,
      );
    }
  }
}
