import { Hono } from "hono";
import * as ed from "@noble/ed25519";
import { mnemonicToAccount } from "viem/accounts";
import { Buffer } from 'node:buffer';
import qrcode from 'qrcode-generator';


const SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
  name: "Farcaster SignedKeyRequestValidator",
  version: "1",
  chainId: 10,
  verifyingContract: "0x00000000fc700472606ed4fa22623acf62c60553",
} as const;

const SIGNED_KEY_REQUEST_TYPE = [
  { name: "requestFid", type: "uint256" },
  { name: "key", type: "bytes" },
  { name: "deadline", type: "uint256" },
] as const;

type Bindings = {
  FARCASTER_DEVELOPER_FID: string;
  FARCASTER_DEVELOPER_MNEMONIC: string;
}

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/sign-in", async (c) => {
  try {
    const signInWithWarpcast = async () => {
      const privateKeyBytes = ed.utils.randomPrivateKey();
      const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);

      const keypairString = {
        publicKey: "0x" + Buffer.from(publicKeyBytes).toString("hex"),
        privateKey: "0x" + Buffer.from(privateKeyBytes).toString("hex"),
      };
      const appFid = c.env.FARCASTER_DEVELOPER_FID!;
      const account = mnemonicToAccount(
        c.env.FARCASTER_DEVELOPER_MNEMONIC!,
      );

      const deadline = Math.floor(Date.now() / 1000) + 86400; // signature is valid for 1 day
      const requestFid = parseInt(appFid);
      const signature = await account.signTypedData({
        domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
        types: {
          SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
        },
        primaryType: "SignedKeyRequest",
        message: {
          requestFid: BigInt(appFid),
          key: keypairString.publicKey as `0x`,
          deadline: BigInt(deadline),
        },
      });
      const authData = {
        signature: signature,
        requestFid: requestFid,
        deadline: deadline,
        requestSigner: account.address,
      };
      const {
        result: { signedKeyRequest },
      } = (await (
        await fetch(`https://api.warpcast.com/v2/signed-key-requests`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            key: keypairString.publicKey,
            signature,
            requestFid,
            deadline,
          }),
        })
      ).json()) as {
        result: { signedKeyRequest: { token: string; deeplinkUrl: string } };
      };
      const user: any = {
        ...authData,
        publicKey: keypairString.publicKey,
        deadline: deadline,
        token: signedKeyRequest.token,
        signerApprovalUrl: signedKeyRequest.deeplinkUrl,
        privateKey: keypairString.privateKey,
        status: "pending_approval",
      };
      return user;
    };

    const signInData = await signInWithWarpcast();
    if (!signInData) {
      return c.json({ error: "Failed to sign in user" }, { status: 500 });
    }
    if (signInData) {
      return c.json({
        deepLinkUrl: signInData?.signerApprovalUrl,
        pollingToken: signInData?.token,
        publicKey: signInData?.publicKey,
        privateKey: signInData?.privateKey,
      });
    } else {
      return c.json({ error: "Failed to get farcaster user" }, {status: 500});
    }
  } catch (error) {
    console.log(error)
    return c.json({ error: error }, {status: 500});
  }
});

app.get("/sign-in/poll", async (c) => {
  const pollingToken = c.req.query('token');
    try {
      const fcSignerRequestResponse = await fetch(
        `https://api.warpcast.com/v2/signed-key-request?token=${pollingToken}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const responseBody = (await fcSignerRequestResponse.json()) as {
        result: { signedKeyRequest:  any};
      };
      console.log(responseBody)
      return c.json({"state": responseBody.result.signedKeyRequest.state, "userFid": responseBody.result.signedKeyRequest.userFid}, { status: 200});
    }
    catch (error) {
      return c.json({ error: error}, {status: 500});
    }
  }
);


app.get('/qr/:token', (c) => {
  const token = c.req.param('token');
  try {
    let qr = qrcode(0, 'H');
    qr.addData(`farcaster://signed-key-request?token=${token}`);
    qr.make();
    const qrCodeDataURL = qr.createDataURL(6, 4);

    const imageData = qrCodeDataURL.split(',')[1];

    const imageBuffer = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': 'image/png'
      }
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Failed to generate QR code" }, { status: 500 });
  }
});

export default app;
