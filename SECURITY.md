# Security policy

This repository builds and deploys [michal.ai](https://michal.ai) and [halmic.com](https://halmic.com). Only the current `main`
branch, which is what is live, is supported.

## Reporting a vulnerability

Please report it privately through GitHub: on this repository, open **Security**, then **Report a vulnerability**
([direct link](https://github.com/ItsMichal/space/security/advisories/new)). Do not open a public issue.

Include what you found, where (URL or file), and how to reproduce it. Please give a reasonable time for a fix
before you disclose it publicly.

## In scope

- The two sites and their Workers (`/api/*` routes, headers, the content security policy).
- Secrets or credentials committed to this repository.
- The build and deploy workflows in `.github/`.

Out of scope: third-party services the sites embed (YouTube, Twitch, Cloudflare itself), and denial of service.
