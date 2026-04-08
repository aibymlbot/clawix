export interface SessionCommandContext {
  readonly userId: string;
  readonly sessionId: string;
  readonly channelId: string;
  readonly senderId: string;
  readonly agentDefinitionId: string;
  readonly args?: string;
}

export interface SessionCommandResult {
  readonly text: string;
}

export interface SessionCommand {
  readonly name: string;
  readonly description: string;
  execute(ctx: SessionCommandContext): Promise<SessionCommandResult>;
}
