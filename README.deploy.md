# Deployment Guide: Automatic Container Updates

To ensure your Render server automatically updates whenever a new image is pushed to Docker Hub, we use **Render Deploy Hooks**.

## 1. Prerequisites
- Your application is hosted as a **Web Service** on Render using the **Docker** runtime.
- You have a Docker Hub repository.

## 2. Setting up the Deploy Hook
1. Go to your **Render Dashboard**.
2. Select your Web Service.
3. Go to **Settings**.
4. Scroll down to the **Deploy Hook** section.
5. Copy the URL (it looks like `https://api.render.com/deploy/srv-...`).

## 3. GitHub Secrets
Ensure you have added the following secrets to your GitHub repository (Settings > Secrets and variables > Actions):

| Secret Name | Description |
| ----------- | ----------- |
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Your Docker Hub Personal Access Token |
| `RENDER_DEPLOY_HOOK_URL` | The URL you copied in Step 2 |
| `RENDER_BACKEND_URL` | Your service's public URL (for frontend config) |

## 4. Alternative: Watchtower (Private Servers)
If you are NOT using Render and instead using a private VPS, you can use **Watchtower**:
```bash
docker run -d --name watchtower -v /var/run/docker.sock:/var/run/docker.sock containrrr/watchtower --interval 300 --cleanup
```
