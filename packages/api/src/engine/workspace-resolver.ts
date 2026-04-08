/**
 * Workspace path resolution for agent containers.
 *
 * When the API server runs inside a Docker container (docker-compose.dev.yml),
 * it shares the host Docker socket. Volume mount paths in `docker run -v` are
 * resolved by the host daemon, so we need two paths:
 *
 *   - localPath:  where the API process can read/write (e.g. /data/users/u1/workspace)
 *   - hostPath:   the same directory as seen by the Docker daemon on the host
 *                  (e.g. /home/jason/Projects/clawix/data/users/u1/workspace)
 *
 * Env vars:
 *   WORKSPACE_BASE_PATH      — base dir as seen by the API process (default: ./data)
 *   WORKSPACE_HOST_BASE_PATH — same dir as seen on the host (default: WORKSPACE_BASE_PATH)
 *
 * When running directly on the host (no container), both resolve to the same path.
 */
import * as path from 'path';

export interface WorkspacePaths {
  /** Path the API process uses to create/read the workspace directory. */
  readonly localPath: string;
  /** Path passed to `docker run -v` so the host Docker daemon can find it. */
  readonly hostPath: string;
}

/**
 * Resolve a relative workspace path (e.g. "users/{userId}/workspace") to
 * both a local and a host-visible absolute path.
 *
 * @param relativeWorkspacePath — relative path from the data root (stored in UserAgent.workspacePath)
 * @returns Local and host paths for the workspace directory.
 */
export function resolveWorkspacePaths(relativeWorkspacePath: string): WorkspacePaths {
  const localBase = process.env['WORKSPACE_BASE_PATH'] ?? './data';
  const hostBase = process.env['WORKSPACE_HOST_BASE_PATH'] ?? localBase;

  return {
    localPath: path.resolve(localBase, relativeWorkspacePath),
    hostPath: path.resolve(hostBase, relativeWorkspacePath),
  };
}
