export function getImageKitPublicKey() {
  return process.env.IMAGEKIT_PUBLIC_KEY || process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "";
}

export function getImageKitUrlEndpoint() {
  return process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "";
}

export function getImageKitPrivateKey() {
  return process.env.IMAGEKIT_PRIVATE_KEY || "";
}

export function getImageKitConfigStatus() {
  const publicKey = getImageKitPublicKey();
  const privateKey = getImageKitPrivateKey();
  const urlEndpoint = getImageKitUrlEndpoint();

  return {
    publicKey,
    privateKey,
    urlEndpoint,
    configured: Boolean(publicKey && privateKey && urlEndpoint),
  };
}
