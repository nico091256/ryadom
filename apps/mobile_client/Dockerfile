FROM nginx:alpine

COPY apps/mobile_client/web_dist /usr/share/nginx/html
COPY apps/mobile_client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["sh", "-c", "sed -i 's/listen       80;/listen       '\"$PORT\"';/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
