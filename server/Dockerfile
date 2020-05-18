FROM python:3.6.9

WORKDIR /usr/src/app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m spacy download en_core_web_sm

COPY . .

EXPOSE 8080 

CMD ["python", "./run_server.py", "--port", "8080"]
