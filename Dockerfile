FROM node:24-slim

WORKDIR /home/node/app

USER node

EXPOSE 8090

CMD ["npm", "start"]
