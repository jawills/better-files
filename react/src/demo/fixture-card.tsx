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
      onClickCapture={(event) => {
        // LWS retargets document.activeElement; keep the actual file button for focus restoration.
        if (event.target instanceof Element) {
          const button = event.target.closest<HTMLButtonElement>(".bf-file");
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
              `Demo: View All requested for ${context.recordId}. Email files: ${config.includeEmails ? "included" : "excluded"}; minimum size: ${config.minimumFileSizeKb} KB. Salesforce navigation is milestone 3.`
            ),
          requestUpload: (_context, config) =>
            setNotice(
              `Demo: upload requested (${config.multiple ? "multiple files" : "one file"}; ${config.accept}). No file was uploaded. Upload handling is milestone 2.`
            ),
          retry: () => {
            setRecovered(true);
            setNotice("Demo: retry succeeded.");
          }
        }}
      />
      <p
        className="bf-demo-notice"
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
          <DialogTitle className="bf-dialog-title">
            {selectedFile?.title}
          </DialogTitle>
          <DialogDescription className="bf-dialog-description">
            Fixture preview. Salesforce’s native file preview will be connected
            in milestone 3.
          </DialogDescription>
          {selectedFile && (
            <div className="bf-fixture-preview">
              <FileIcon extension={selectedFile.extension} />
              <span>{selectedFile.title}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </FileSurface>
  );
}
