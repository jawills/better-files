import { describe, expect, it, vi } from "vitest";
import { uploadBinary, EMBEDDED_MAX_UPLOAD_BYTES } from "./upload";
const bodyId = "05Tal0000153EPfEAM";
const config = {
  token: "test-csrf",
  uploadUrl: "/chatter/handlers/file/body",
  maxFileSize: 10737418240
};

describe("SDK binary uploads", () => {
  it("transfers a file above 2 MB as multipart and only publishes its body ID", async () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024)], "large.txt");
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(config))
      .mockResolvedValueOnce(
        new Response(
          `while(1);\n${JSON.stringify({ content_body_id: bodyId })}`
        )
      );
    const publish = vi.fn().mockResolvedValue("068al00000YPkTtAAL");
    await uploadBinary(file, fetcher, publish);
    const body = fetcher.mock.calls[1][1]?.body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toMatchObject({
      name: file.name,
      size: file.size
    });
    expect((body as FormData).get("token")).toBe("test-csrf");
    expect(publish).toHaveBeenCalledWith({
      filename: "large.txt",
      contentBodyId: bodyId
    });
  });
  it("surfaces Salesforce errors without publishing a file", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(config))
      .mockResolvedValueOnce(
        new Response('while(1);\n{"errormessage":"Session expired"}', {
          status: 400
        })
      );
    const publish = vi.fn();
    await expect(
      uploadBinary(new File(["x"], "test.txt"), fetcher, publish)
    ).rejects.toThrow("Session expired");
    expect(publish).not.toHaveBeenCalled();
  });
  it("does not send credentials to an unexpected upload URL", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ ...config, uploadUrl: "https://example.com/upload" })
      );
    await expect(
      uploadBinary(new File(["x"], "test.txt"), fetcher, vi.fn())
    ).rejects.toThrow("unsupported upload endpoint");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects a file beyond the product limit before making requests", async () => {
    const file = new File(["x"], "large.txt");
    Object.defineProperty(file, "size", {
      value: EMBEDDED_MAX_UPLOAD_BYTES + 1
    });
    const fetcher = vi.fn<typeof fetch>();
    await expect(uploadBinary(file, fetcher, vi.fn())).rejects.toThrow(
      "100 MB"
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
