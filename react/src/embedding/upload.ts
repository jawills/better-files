// An initial product limit, independent of Apex heap and below Salesforce's org limit.
export const EMBEDDED_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

type UploadConfig = { token: string; uploadUrl: string; maxFileSize: number };
function isUploadConfig(value: unknown): value is UploadConfig {
  return Boolean(
    value &&
      typeof value === "object" &&
      "token" in value &&
      typeof value.token === "string" &&
      value.token &&
      "uploadUrl" in value &&
      typeof value.uploadUrl === "string" &&
      "maxFileSize" in value &&
      typeof value.maxFileSize === "number" &&
      value.maxFileSize > 0
  );
}

/** The SDK authenticates both requests; the final Apex call only publishes a body ID. */
export async function uploadBinary(
  file: File,
  fetchSalesforce: typeof fetch,
  publish: (input: {
    filename: string;
    contentBodyId: string;
  }) => Promise<string>,
  signal?: AbortSignal
): Promise<void> {
  if (file.size > EMBEDDED_MAX_UPLOAD_BYTES)
    throw new Error("The upload limit is 100 MB per file.");
  const configResponse = await fetchSalesforce(
    "/services/data/v68.0/connect/file/upload/config",
    { signal }
  );
  if (!configResponse.ok)
    throw new Error(
      "Unable to prepare the upload. Refresh the page and try again."
    );
  const config: unknown = await configResponse.json();
  if (!isUploadConfig(config))
    throw new Error("Salesforce returned an invalid upload configuration.");
  // Do not forward the upload token or bytes to an arbitrary URL.
  if (config.uploadUrl !== "/chatter/handlers/file/body")
    throw new Error("Salesforce returned an unsupported upload endpoint.");
  if (file.size > config.maxFileSize)
    throw new Error("This file exceeds your Salesforce org upload limit.");
  const body = new FormData();
  body.append("token", config.token);
  body.append("fromUITier", "true");
  body.append("target", "ContentVersion");
  body.append("file", file, file.name);
  const response = await fetchSalesforce(config.uploadUrl, {
    method: "POST",
    body,
    signal
  });
  const text = await response.text();
  let result: unknown;
  try {
    result = JSON.parse(text.replace(/^while\(1\);\s*/, ""));
  } catch {
    throw new Error("Upload not confirmed. Refresh files before trying again.");
  }
  if (
    result &&
    typeof result === "object" &&
    "errormessage" in result &&
    typeof result.errormessage === "string"
  )
    throw new Error(result.errormessage);
  if (
    !response.ok ||
    !result ||
    typeof result !== "object" ||
    !("content_body_id" in result) ||
    typeof result.content_body_id !== "string" ||
    !/^05T[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/.test(result.content_body_id)
  ) {
    throw new Error("Upload not confirmed. Refresh files before trying again.");
  }
  signal?.throwIfAborted();
  const versionId = await publish({
    filename: file.name,
    contentBodyId: result.content_body_id
  });
  if (!versionId)
    throw new Error(
      "The file was transferred, but Salesforce did not confirm its record link. Refresh files before trying again."
    );
}
