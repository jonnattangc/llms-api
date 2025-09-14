FROM node:24-slim

WORKDIR /home/node/app

EXPOSE 8090

RUN chown -R node:node . && \
    npm install && \
    #npm install -g pm2 && \
    #npm run build
    echo "node_modules" > .dockerignore

USER node

CMD ["npm", "run", "dev"]
