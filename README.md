# Farcaster Keys Server

This is an open sourced Hono server deployed via a Cloudflare worker that can be used for creating and authorizing signer keys on Farcaster.

It is currently being used in production to assist with authorizing Raycaster.

## Getting Started

Clone the repo then install the packages with your manager of choice (i.e. `bun install`)

Then create a file called `.dev.vars` and put the following values in:

```
FARCASTER_DEVELOPER_FID=    # The FID of the app account (e.g. @raycasterapp) that will be signing the keys
FARCASTER_DEVELOPER_MNEMONIC=    # The mnemonic phrase for the same app account
```

After setting the environment variables start up the server

```
bun run dev
```

## Endpoint Overview

### `POST /sign-in`

Creates a keypair, sign it, then make a `signed-key-request` to Warpcast. If successful it will return the following data.

```json
{
    "deepLinkUrl": "farcaster://signed-key-request?token=<POLLING_TOKEN>",
    "pollingToken": "<POLLING_TOKEN>",
    "privateKey": "<PRIVATE_KEY>",
    "publicKey": "<PUBLIC_KEY>"
}
```

- `deepLinkUrl` - Can be turned into a QR code or button on mobile to open up Warpcast to approve the signed key
- `pollingToken` - Used in the `/sign-in/poll` edpoint to check on the status of whether the key has been approved
- `privateKey` & `publicKey` - The signed keypair

### `GET /sign-in/poll`

Checks the status of an approval for an existing signed keypair, uses a query parameter of `?token=TOKEN` like so:

```
/sign-in/poll?token=<pollingToken>
```

Returns the following data:

```json
{
  "state": "approved",
  "userFid": 6023
}
```

- `state` - Can either be `pending` or `approved`
- `userFid` - Once a key is approved it will also return the user FID that approved the key

### `GET /qr/:token`

Returns a QR code that can be scanned by a mobile deviced based on the `pollingToken` passed into the path parameter.

## Contact

If you have any questions at all feel free to [contact me](https://warpcast.com/stevedylandev)!
