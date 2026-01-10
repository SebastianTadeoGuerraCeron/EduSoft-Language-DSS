FROM node:20-alpine3.18 AS base

ENV DIR usr/src/app
WORKDIR $DIR
ARG NPM_TOKEN

FROM base AS build
ENV NODE_ENV=production
# instalar para mayor compatibilidad de node con docker
RUN apk update && apk add --no-cache dumb-init=1.2.5-r2
# copiar los archivos json para instalar las depencencias
COPY package*.json ./
# SEGUIRIDAD: instalar lib y dependencias  privadas, y borrar el file para no tener el TOKEN
RUN echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > ".npmrc" && \
  rm -f .npmrc
# copia la configuracion de TS
COPY tsconfig*.json ./
# copia los esquemas de Prisma primero
COPY prisma ./prisma
# copia los archivos de la app
COPY . .
# Instala dependencias primero
RUN npm ci --include=dev
# Genera los 3 clientes de Prisma ANTES del build
RUN npx prisma generate --schema=prisma/schema.prisma
RUN npx prisma generate --schema=prisma/audit.prisma
RUN npx prisma generate --schema=prisma/billing.prisma
# Ahora construye la app (TypeScript ya puede encontrar los clientes de Prisma)
RUN npm run build
# Elimina las dependencias de desarrollo
RUN npm prune --omit=dev




FROM base AS production
ENV NODE_ENV=production
# SEGURIDAD: un usuario de NODE con pocos privilegios
# (no puede eliminar o instalar archivos o dependencias)
ENV USER=node
# copiar todos los archivo de generados en BUILD
COPY --from=build /usr/bin/dumb-init /usr/bin/dumb-init
COPY --from=build $DIR/node_modules node_modules
COPY --from=build $DIR/dist dist
COPY --from=build $DIR/public public
COPY --from=build $DIR/prisma prisma

# Permiso de subida de imagenes de perfil
RUN chown -R node:node public/profile-pictures && \
  chmod -R 700 public/profile-pictures

USER $USER
EXPOSE ${PORT}
CMD ["dumb-init", "node", "dist/index.js"]
