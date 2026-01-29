# frontend/Dockerfile

# Base image
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# --- Development Stage ---
FROM base AS dev
# We don't COPY source here because docker-compose volumes handles it
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev"]

# --- Production Stage ---
FROM base AS prod
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
RUN npm run build
CMD ["npm", "start"]