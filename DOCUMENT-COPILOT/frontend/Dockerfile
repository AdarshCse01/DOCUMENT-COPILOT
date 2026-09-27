# Stage 1: Build the React app
FROM node:20-alpine AS builder
WORKDIR /app

# Enable pnpm via corepack to support repository lockfile
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy dependency specifications
COPY package.json pnpm-lock.yaml* package*.json* .npmrc* ./

# Install dependencies using the appropriate lockfile
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install; \
    fi

COPY . .

# Pass Vite build-time environment variables
ARG VITE_API_BASE_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Build production bundle
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm run build; \
    else \
      npm run build; \
    fi

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port 80 and Railway target port 8080
EXPOSE 80
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
