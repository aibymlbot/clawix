# Clawix Agent Container — runs agent code in isolation
# Build: docker build -t clawix-agent:latest -f infra/docker/agent/Dockerfile .

FROM python:3.12-slim

# Curated system tools (curl excluded — no network access; add when proxy is implemented)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git jq \
    && rm -rf /var/lib/apt/lists/*

# Create workspace directories (including skill mount points so Docker
# does not auto-create them as root-owned dirs on the host volume)
RUN mkdir -p /workspace/skills/builtin /workspace/skills/custom /app \
    && chown -R 1000:1000 /workspace

# Non-root user (uid 1000 — matches --user 1000:1000 from container runner)
USER 1000:1000
WORKDIR /workspace

# Container stays alive for docker exec; tools execute commands inside it
CMD ["sleep", "infinity"]
