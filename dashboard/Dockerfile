FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# The nginx entrypoint envsubsts /etc/nginx/templates/*.template using
# container env vars (API_URL, API_KEY) at startup.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV API_URL=http://localhost:8000 API_KEY=dev-secret-key
EXPOSE 80
