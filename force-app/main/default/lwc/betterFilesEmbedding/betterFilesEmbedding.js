import { LightningElement, api } from "lwc";
import getReactAppUrl from "@salesforce/apex/FileListController.getReactAppUrl";
import getTheme from "@salesforce/apex/FileListController.getTheme";
import completeUpload from "@salesforce/apex/BetterFilesReactUpload.completeUpload";

/** The channel carries cloneable props and a small allowlist of commands, never file bytes. */
export default class BetterFilesEmbedding extends LightningElement {
  @api view;
  @api config;
  appUrl;
  error;
  host;
  theme;

  connectedCallback() {
    this.loadAppUrl();
  }

  async loadAppUrl() {
    let appUrl;
    let theme;
    try {
      // The app waits for the org's theme so it doesn't first paint in another.
      // Without one, it uses its own default.
      [appUrl, theme] = await Promise.all([
        getReactAppUrl(),
        getTheme().catch(() => undefined)
      ]);
    } catch {
      if (this.template.host.isConnected)
        this.error = "Unable to find the Better Files app. Check your Better Files permissions and refresh the page.";
      return;
    }
    // Locker doesn't expose LightningElement.isConnected; the HTML host does.
    if (!this.template.host.isConnected) return;
    this.theme = theme;
    try {
      const url = new URL(appUrl?.trim());
      // Only the packaged app on a Salesforce-hosted origin may receive record data.
      if (
        url.protocol !== "https:" ||
        !url.hostname.endsWith(".salesforce.app") ||
        url.username || url.password || url.port || url.search || url.hash ||
        url.pathname !== "/app/file1sync__BetterFilesReact"
      ) throw new Error("Invalid app URL");
      this.appUrl = url.href;
      this.error = undefined;
    } catch {
      this.error = "The Better Files app is unavailable. Ask your admin to check the app installation and your Better Files React permission set.";
    }
  }

  get guestProps() {
    const config = this.config;
    // LWC proxies cannot cross the iframe structured-clone boundary.
    return {
      payload: JSON.stringify({
        view: this.view,
        context: config?.context,
        // Both views take the org-wide theme from File Related List Config.
        settings: { ...config?.settings, theme: this.theme },
        state: config?.state,
        initialFilter: config?.initialFilter,
        revision: config?.revision,
        lightningOrigin: window.location.origin
      })
    };
  }
  renderedCallback() {
    const host = this.refs.embedding;
    if (this.host === host) return;
    this.host = host;
    if (!host) return;
    host.addEventListener("sf-embedding.component.error", (event) => {
      this.error =
        event.detail?.message ||
        "Unable to connect to Files. Refresh the page to try again.";
    });
    host.addEventListener("sf-embedding.component.ready", () => {
      this.error = undefined;
    });
  }
  async handleRequest(event) {
    const request = event.detail;
    const config = this.config;
    const host = this.host;
    if (
      !request ||
      typeof request.id !== "string" ||
      !Array.isArray(request.args) ||
      !host
    )
      return;
    let result;
    let error;
    try {
      if (
        !config?.context?.recordId ||
        request.recordId !== config.context.recordId
      )
        throw new Error(
          "The record changed. Refresh files before trying again."
        );
      const args = request.args;
      switch (request.operation) {
        case "completeUpload":
          result = await completeUpload({
            filename: args[0]?.filename,
            contentBodyId: args[0]?.contentBodyId,
            recordId: config.context.recordId
          });
          break;
        case "info":
          result = await config.adapter.info();
          break;
        case "load":
          result = await config.adapter.load(args[0]);
          break;
        case "delete":
          result = await config.adapter.delete(args[0]);
          break;
        case "refresh":
          result = await config.upload.refresh();
          break;
        case "preview":
          result = await config.actions.preview(args[0]);
          break;
        case "viewAll":
          result = await config.actions.viewAll(
            config.context,
            config.settings
          );
          break;
        case "download":
          result = await config.actions.download(args[0]);
          break;
        case "record":
          result = await config.actions.record();
          break;
        case "object":
          result = await config.actions.object();
          break;
        case "retry":
          result = await config.actions.retry();
          break;
        default:
          throw new Error("Unsupported Files action.");
      }
    } catch (failure) {
      error =
        failure?.body?.message ||
        failure?.message ||
        "Unable to complete the action.";
    }
    if (this.template.host.isConnected && host === this.host)
      host.dispatchEvent(
        new CustomEvent("bfresponse", {
          detail: JSON.stringify({ id: request.id, result, error })
        })
      );
  }
}
