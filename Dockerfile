FROM node:24-slim

LABEL VERSION=1.0.0
LABEL DESCRIPCION="LLM API"
LABEL AUTOR="Jonnattan Griffiths"

ENV GEMINI_API_KEY ''
ENV OPENAI_API_KEY ''
ENV DEEPSEEK_API_KEY ''
ENV KIMI_API_KEY ''
ENV SHEETS_SPREADSHEET_ID ''
ENV ANTHROPIC_API_KEY ''
ENV XAI_API_KEY ''
ENV MISTRAL_API_KEY ''
ENV QWEN_API_KEY ''
ENV GROQ_API_KEY ''


WORKDIR /home/node/app

ADD app/ /home/node/app/

ADD credentials-excel.json /home/node/app/credentials.json

RUN chown -R node:node . && \
    npm cache clean --force && \
    npm install

USER node

EXPOSE 8065

CMD ["npm", "start"]
