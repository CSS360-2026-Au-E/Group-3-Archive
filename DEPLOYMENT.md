# Setup and deployment

## Run locally

1. Install Node.js 22 or newer and run `npm install`.
2. Copy `.env-sample` to `.env` and set `TOKEN`, `CLIENT_ID`, and `OLLAMA_MODEL`.
   Set `OLLAMA_URL` to the Ollama server address if it is not running on the
   default local address. `GUILD_ID` is optional and is useful for registering
   commands to one test server.
3. Register the slash commands with `npm run deploy`.
4. Start the bot with `npm start`.

The bot writes its message archive to `logs/`. Keep this directory on persistent
storage when running the bot in a container.

## CI and container delivery

The GitHub Actions workflow in `.github/workflows/build-and-deploy.yml` builds
the application and Docker image for pull requests targeting `main` or `release`.
On pushes to either branch, version tags matching `v*`, and manually started
workflow runs, it publishes the image to GitHub Container Registry (GHCR). The
default branch also receives the `latest` tag; branch and version builds receive
their corresponding tags. The image is not published for pull requests.

The workflow uses the repository's `GITHUB_TOKEN`, so no Docker Hub credentials
are required. Ensure GitHub Actions is allowed to write packages in the
repository or organization settings. After publishing, configure the chosen
hosting service to pull `ghcr.io/OWNER/REPOSITORY:TAG`; the workflow publishes
the deployable image but does not restart an unspecified hosting service.

For example, after replacing `OWNER/REPOSITORY` with the GitHub repository path,
run the image with an environment file and persistent log volume:

```sh
docker run -d --name archivebot --restart unless-stopped \
  --env-file .env \
  -v archivebot-logs:/app/logs \
  ghcr.io/OWNER/REPOSITORY:latest
```
