# Authentication Implementation

1. Sessions (Common)
2. Tokens (Modern APIs) - this project used

## Token

After login:

```Plain text
User → login
Server → gives token
```

Then every request from browser includes the token:

```Plain text
(example)
GET /profile
Authorization: Bearer TOKEN
```

the server checks the token to verify the user.

## Details

https://chatgpt.com/share/69b34758-8acc-8010-b9a8-a9a4d04b664e
