@AGENTS.md

## Deployment

The user's installed build runs on the `preview` EAS channel (not
`development` or `production`). After committing and pushing a JS-only
change, ship it with:

```bash
eas update --branch preview --message "<summary>"
```

Only a native dependency change requires a new `eas build` instead.
