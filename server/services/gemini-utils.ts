export function createUserContent(parts: any[]) {
  return {
    role: "user",
    parts: parts
  };
}

export function createPartFromUri(uri: string, mimeType: string) {
  return {
    fileData: {
      mimeType: mimeType,
      fileUri: uri,
    },
  };
}