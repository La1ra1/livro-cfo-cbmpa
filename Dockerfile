FROM nginx:1.27-alpine

RUN apk add --no-cache gettext

COPY . /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY config.template.js /usr/share/nginx/html/config.template.js
COPY docker-entrypoint.d/ /docker-entrypoint.d/

RUN chmod +x /docker-entrypoint.d/*.sh
