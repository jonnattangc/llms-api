FROM node:24-slim

WORKDIR /home/node/app

ENV GEMINI_API_KEY ''
ENV OPENAI_API_KEY ''
ENV DEEPSEEK_API_KEY ''
ENV KIMI_API_KEY ''

ADD app/ /home/node/app/

RUN chown -R node:node . && \
    npm cache clean --force && \
    npm install

USER node

EXPOSE 8065

CMD ["npm", "start"]
