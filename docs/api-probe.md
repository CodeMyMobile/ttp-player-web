# API probe for player match profile

Tried to authenticate and fetch player match profile data using the provided test account:

```
curl -i -H 'Content-Type: application/json' -X POST \
  https://ttp-api.codemymobile.com/api/auth/login \
  -d '{"email":"player27@thetennisplan.com","password":"tennis123"}'
```

**Result:** The request was blocked by the outbound proxy with `HTTP/1.1 403 Forbidden` ("CONNECT tunnel failed"). No API token could be retrieved, so follow-up GET requests for the match profile could not be executed from this environment.
