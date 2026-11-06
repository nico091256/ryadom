FROM nginx:1.27-alpine

COPY apps/mobile_client/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/mobile_client/web_dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
