FROM node:24-slim

WORKDIR /home/node/app

ADD app/package.json /home/node/app/package.json

RUN chown -R node:node . && \
    npm cache clean --force && \
    npm install && \
    echo "node_modules" > .dockerignore
    #npm install -g pm2 && \
    #npm run build

USER node

EXPOSE 8090

CMD ["npm", "run", "dev"]
