import { useRef, useState } from "react";
import { FileCard } from "@/components/file-card";
import { FileSurface } from "@/components/file-surface";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "@/components/ui/dialog";
import { FileIcon } from "@/components/file-icon";
import { defaultSettings, type FileRecord, type FileSettings } from "@/model";
import { fixtureContext, getFixtureState, type Scenario } from "./fixtures";

export type FixtureCardProps = {
  scenario?: Scenario;
  settings?: FileSettings;
  label?: string;
};

export function FixtureCard({
  scenario = "Populated",
  settings = defaultSettings,
  label = "Main card"
}: FixtureCardProps) {
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [notice, setNotice] = useState("");
  const [recovered, setRecovered] = useState(false);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);

  return (
    <FileSurface
      theme={settings.theme}
      onClickCapture={(event) => {
        // LWS retargets document.activeElement; keep the actual file button for focus restoration.
        if (event.target instanceof Element) {
          const button = event.target.closest<HTMLButtonElement>(
            "[data-file-preview]"
          );
          if (button) previewTrigger.current = button;
        }
      }}
    >
      <FileCard
        context={fixtureContext}
        settings={settings}
        state={getFixtureState(
          recovered && scenario === "Error" ? "Populated" : scenario,
          settings
        )}
        actions={{
          preview: (file) => {
            setSelectedFile(file);
          },
          viewAll: (context, config) =>
            setNotice(
              `Demo: View All requested for ${context.recordId}. Email files: ${config.includeEmails ? "included" : "excluded"}; minimum size: ${config.minimumFileSizeKb} KB.`
            ),
          requestUpload: (_context, config) =>
            setNotice(
              `Demo: upload requested (${config.multiple ? "multiple files" : "one file"}; ${config.accept}). No file was uploaded.`
            ),
          retry: () => {
            setRecovered(true);
            setNotice("Demo: retry succeeded.");
          }
        }}
      />
      <p
        className="bf:mt-2.5 bf:text-sm bf:wrap-anywhere bf:empty:hidden"
        role="status"
        aria-label={`${label} action`}
      >
        {notice}
      </p>
      <Dialog
        open={selectedFile !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedFile(null);
        }}
      >
        <DialogContent finalFocus={previewTrigger}>
          <DialogTitle>{selectedFile?.title}</DialogTitle>
          <DialogDescription>
            Sample file preview. Live records use Salesforce’s native preview.
          </DialogDescription>
          {selectedFile && (
            <div className="bf:flex bf:items-center bf:gap-3.5 bf:bg-header bf:px-4 bf:py-6 bf:wrap-anywhere">
              <FileIcon
                extension={selectedFile.extension}
                className="bf:h-[62px] bf:w-[50px]"
              />
              <span>{selectedFile.title}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </FileSurface>
  );
}
