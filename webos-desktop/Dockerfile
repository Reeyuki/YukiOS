FROM node:22-alpine AS build
RUN apk add --no-cache git
RUN corepack enable && corepack prepare pnpm@11.6.0 --activate
WORKDIR /app
COPY webos-desktop/package.json webos-desktop/pnpm-lock.yaml webos-desktop/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY webos-desktop/ ./
COPY README.md /README.md
ENV CI=true
RUN pnpm build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
