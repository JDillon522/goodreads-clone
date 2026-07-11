# Local CA Certificates

Put a trusted local development CA at `certs/local-ca.pem` when Node reports
`SELF_SIGNED_CERT_IN_CHAIN` for outbound HTTPS calls.

The file is ignored by Git. Development startup paths use it automatically:

- `npm run dev:backend` sets `NODE_EXTRA_CA_CERTS` for host backend startup.
- Docker builds admit only `certs/local-ca.pem` into the build context and use it when Prisma
  downloads its Linux engine.
- `npm run docker:up` sets `NODE_EXTRA_CA_CERTS` for Docker backend startup.
- Direct `docker compose up` also points the backend at `/app/certs/local-ca.pem`.

Do not use `NODE_TLS_REJECT_UNAUTHORIZED=0` as a runtime default.

## Important: mkcert vs intercepted external HTTPS

`mkcert` is useful when you are creating certificates for local domains like
`localhost` or `bookshelf.local`. It does not fix external requests when a
network security product is intercepting HTTPS and re-signing real sites such as
`www.googleapis.com`.

To identify the CA that Node needs, inspect the actual server chain:

```bash
openssl s_client -connect www.googleapis.com:443 -servername www.googleapis.com -showcerts </dev/null
```

Look at the `issuer` values in the certificate chain. Export the matching
root/intermediate CA from Keychain Access, then save it as `certs/local-ca.pem`.

For the current Netskope/GoSkope chain seen on this machine, the useful trust
anchor is the self-signed Netskope root:

```text
CN=caadmin.netskope.com
SHA256 Fingerprint=55:33:55:59:11:54:5D:6C:02:2F:DE:A0:D2:97:15:65:33:09:A3:96:4C:FC:EE:1B:BE:54:18:37:83:DB:47:F6
```

The `ca.ornl.goskope.com` intermediate can rotate. If you include an
intermediate in `certs/local-ca.pem`, make sure it matches the certificate
currently presented by `openssl s_client`; an older intermediate with the same
subject name will not fix Node HTTPS validation.
