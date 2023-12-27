# Doctor-WebApp-Mindmap-Service

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites
Node.js
   ```
   https://nodejs.org/en/
   ```
   
    
### Installing
A step by step series of examples that tell you how to get a development environment running
1. Clone or download this repository, repo consist of 3 services, auth-gateway, portal, web-rtc; below steps are required for each of the services
2. Install all the dependencies.
```
"npm install"
```    
3. Start the server
```
"npm start"
```

4. Open in browser
```
 "localhost:<ENV_PORT>"
```

## Built With

* [Express](https://expressjs.com/) - Express Framework

## Commeting Message (Examples)
1.Commit message with description and change in body
```
fix: allow provided config object to extend other configs
```
2.Commit message with scope
```
feat(lang): add language data
```
3.Commit message with optional ! to draw attention to breaking change
```
revert!: drop Node 12 from testing matrix
```

## Below .env service wise.

## portal .env (Create .env in the portal folder and use below environment keys)

```
NODE_ENV=xxxx
DOMAIN=xxxx
OPENMRS_USERNAME=xxxx
OPENMRS_PASS=xxxx

MYSQL_HOST=xxxx
MYSQL_PORT=xxxx
MYSQL_DIALECT=xxxx
MYSQL_USERNAME=xxxx
MYSQL_PASS=xxxx
MYSQL_DB=xxxx

APIKEY_2FACTOR=xxxx
OPEN_AI_KEY=xxxx

MAIL_USERNAME=xxxx
MAIL_PASSWORD=xxxx
OAUTH_CLIENT_ID=xxxx
OAUTH_CLIENT_SECRET=xxxx
OAUTH_CLIENT_REFRESH_TOKEN=xxxx

VAPID_PUBLIC_KEY=xxxx
VAPID_PRIVATE_KEY=xxxx
VAPID_MAILTO=xxxx

FIREBASE_DB_URL=xxxx
FIREBASE_SERVICE_ACCOUNT_KEY=xxxx

AWS_ACCESS_KEY_ID=xxxx
AWS_SECRET_ACCESS_KEY=xxxx
AWS_REGION=xxxx
AWS_BUCKET_NAME=xxxx
AWS_URL=xxxx

```

## auth-gateway .env (Create .env in the auth-gateway folder and use below environment keys)

```
NODE_ENV=production
PORT=xxxx
SSL_KEY_PATH=xxxx
SSL_CERT_PATH=xxxx
DOMAIN=xxxx
```

## web-rtc .env (Create .env in the web-rtc folder and use below environment keys)


```
PORT=xxxx
SECRET=xxxx
API_KEY=xxxx
SSL=xxxx  # make this true and pass cert and key path below to enable ssl and making site https
SSL_CERT_PATH=xxxx
SSL_KEY_PATH=xxxx
LIVEHOST=xxxx
TCP=xxxx
UDP=xxxx
```

