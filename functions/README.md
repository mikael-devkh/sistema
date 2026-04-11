# Firebase Functions – Proxy Jira (EX API)

Configuração (exemplo hipotético)

1) Defina os segredos (não commitá-los):

```
firebase functions:secrets:set JIRA_EMAIL
# wt@parceiro.delfia.tech

firebase functions:secrets:set JIRA_TOKEN
# ATATT3xFfGF07zDRvLFd2U3qviUo3bIH0Sc1ID6aaUXMRHeRfmSQpjDYrujXMRAM6OAOG6LjX0PFR5WP_jqjf5W-cwn9Pbssg3mta1ju1FYZkYjRCFWTYxX8RPkx_WnRsJkA0omP4jgY0mDrLGOy3ay-t-tBrwH72gboZHQvfsRjf-zdBnQn1qs=79B227D6

firebase functions:secrets:set JIRA_CLOUD_ID
# 82509b91-b5f8-483d-9a2f-815d58ae4567
```

Alternativa (Server/Data Center):

```
firebase functions:secrets:set JIRA_URL
# https://delfia.atlassian.net
```

2) Deploy:

```
firebase deploy --only functions
```

3) URLs disponíveis (após deploy):

- GET /jira/search?jql=...&fields=...
- GET /jira/transitions?issueKey=...
- POST /jira/transition { issueKey, transitionId }
- POST /jira/attach { issueKey, fileName, fileBase64 }

4) Frontend (.env exemplo):

```
VITE_JIRA_PROXY_BASE=https://REGIAO-PROJETO.cloudfunctions.net/api
VITE_JIRA_FIELD_ADDRESS=customfield_12271
VITE_JIRA_FIELD_CITY=customfield_11994
VITE_JIRA_FIELD_STATE=customfield_11948
VITE_JIRA_FIELD_PDV=customfield_14829
```

> Nunca exponha EMAIL/TOKEN no frontend. Use o proxy de Functions.



