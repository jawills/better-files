import type { ViewSDK } from "@salesforce/platform-sdk/core";
import type { FileRecord, RecordContext } from "../model";
import type { RelatedFile, RelatedInfo, RelatedQuery } from "../related-list";
import type { SalesforceFileRow } from "../salesforce";

export type HostOperations = {
  info: { args: []; result: RelatedInfo };
  load: {
    args: [RelatedQuery];
    result: { rows: SalesforceFileRow[]; total: number };
  };
  delete: { args: [RelatedFile[]]; result: void };
  completeUpload: {
    args: [{ filename: string; contentBodyId: string }];
    result: string;
  };
  refresh: { args: []; result: void };
  preview: { args: [FileRecord]; result: void };
  viewAll: { args: []; result: void };
  download: { args: [RelatedFile[]]; result: void };
  record: { args: []; result: void };
  object: { args: []; result: void };
  retry: { args: []; result: void };
};

/** Only metadata crosses the embedding channel. File bytes never enter the LWC. */
export function createHostTransport(sdk: ViewSDK, context: RecordContext) {
  const pending = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  let disposed = false;
  const receive = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    let reply: unknown;
    try {
      reply =
        typeof event.detail === "string" ? JSON.parse(event.detail) : undefined;
    } catch {
      return;
    }
    if (
      !reply ||
      typeof reply !== "object" ||
      !("id" in reply) ||
      typeof reply.id !== "string"
    )
      return;
    const request = pending.get(reply.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(reply.id);
    if ("error" in reply && typeof reply.error === "string")
      request.reject(new Error(reply.error));
    else request.resolve("result" in reply ? reply.result : undefined);
  };
  return {
    connect() {
      disposed = false;
      sdk.addEventListener?.("bfresponse", receive);
    },
    request<K extends keyof HostOperations>(
      operation: K,
      ...args: HostOperations[K]["args"]
    ): Promise<HostOperations[K]["result"]> {
      if (disposed || !sdk.dispatchEvent)
        return Promise.reject(
          new Error(
            "The Salesforce connection is no longer available. Refresh the page."
          )
        );
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(
            new Error(
              "Salesforce did not confirm the operation. Refresh files before trying again."
            )
          );
        }, 60000);
        pending.set(id, {
          resolve: (value) => resolve(value as HostOperations[K]["result"]),
          reject,
          timer
        });
        sdk.dispatchEvent?.(
          new CustomEvent("bfrequest", {
            detail: { id, recordId: context.recordId, operation, args }
          })
        );
      });
    },
    dispose() {
      disposed = true;
      sdk.removeEventListener?.("bfresponse", receive);
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(
          new Error("The record changed. Refresh files before trying again.")
        );
      }
      pending.clear();
    }
  };
}
