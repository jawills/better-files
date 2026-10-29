import { RelatedDemo } from "./related-demo";
import { useState, type CSSProperties } from "react";
import { FixtureCard } from "./fixture-card";
import { scenarios, type Scenario } from "./fixtures";
import { defaultSettings, fileThemes, type FileTheme } from "@/model";
import { cn } from "@/lib/utils";
import { LiveCard, useLiveFiles } from "./live-card";

const demoScenarios = ["Live record", ...scenarios] as const;

export function App() {
  const params = new URLSearchParams(window.location.search);
  // ?theme= opens a theme and carries it between the two demo pages.
  const theme =
    fileThemes.find((value) => value === params.get("theme")) ??
    defaultSettings.theme;
  return params.get("view") === "related" ? (
    <RelatedDemo theme={theme} />
  ) : (
    <CardDemo initialTheme={theme} />
  );
}

function CardDemo({ initialTheme }: { initialTheme: FileTheme }) {
  const [scenario, setScenario] = useState<Scenario | "Live record">(
    import.meta.env.DEV ? "Live record" : "Populated"
  );
  const [settings, setSettings] = useState({
    ...defaultSettings,
    theme: initialTheme
  });
  const [width, setWidth] = useState(960);
  const previewStyle: CSSProperties & { "--preview-width": string } = {
    "--preview-width": `${width + 32}px`
  };
  const [mounted, setMounted] = useState(true);
  const live = useLiveFiles(scenario === "Live record");
  // Wisty themes draw borderless cards, as Lightning does on its gray page.
  const regionClassName = cn(
    "bf:rounded-[6px] bf:p-4",
    settings.theme === "better-files" ? "bf:bg-background" : "bf:bg-(--page)"
  );
  return (
    <main className="bf:mx-auto bf:box-border bf:max-w-[1280px] bf:p-6 bf:max-[601px]:p-4">
      <h1 className="bf:mt-0 bf:mb-2 bf:text-[23px]">
        Better Files{" "}
        <span className="bf:ml-3 bf:text-sm bf:font-normal">Record card</span>
      </h1>
      <p className="bf:mt-0 bf:mb-6">
        {scenario === "Live record"
          ? `Live files: ${live.state.status === "ready" ? live.state.data.recordName : "1Sync"} account in better-files.`
          : "Option A. Fixture data only. Preview, upload, and View All demonstrate host callbacks."}
      </p>
      <p>
        <a href={`/?view=related&theme=${settings.theme}`}>
          Review related list
        </a>
      </p>
      <div className="bf:mb-[30px] bf:flex bf:flex-wrap bf:items-end bf:gap-x-5 bf:gap-y-4 bf:[&_*]:box-border bf:[:where(&_label)]:flex bf:[:where(&_label)]:flex-col bf:[:where(&_label)]:gap-[5px] bf:[:where(&_label)]:text-xs bf:[:where(&_input,&_select,&_button)]:[font:inherit] bf:[:where(&_input,&_select,&_button)]:text-foreground bf:[:where(&_input,&_select,&_button)]:bg-background bf:[:where(&_input,&_select,&_button)]:border bf:[:where(&_input,&_select,&_button)]:border-solid bf:[:where(&_input,&_select,&_button)]:border-[#c9c9c9] bf:[:where(&_input,&_select,&_button)]:rounded-md bf:[:where(&_input,&_select,&_button)]:p-[7px] bf:[&_:focus-visible]:outline-2 bf:[&_:focus-visible]:outline-solid bf:[&_:focus-visible]:outline-[#1b96ff] bf:[&_:focus-visible]:outline-offset-[3px]">
        <label>
          State
          <select
            value={scenario}
            onChange={(event) => {
              const next = demoScenarios.find(
                (value) => value === event.target.value
              );
              if (next) setScenario(next);
            }}
          >
            {demoScenarios.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Theme
          <select
            value={settings.theme}
            onChange={(event) => {
              const next = fileThemes.find(
                (value) => value === event.target.value
              );
              if (next) setSettings({ ...settings, theme: next });
            }}
          >
            {fileThemes.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Card width: {width}px
          <input
            type="range"
            className="bf:w-[180px] bf:p-0"
            min="280"
            max="1100"
            step="20"
            value={width}
            onChange={(event) => setWidth(event.target.valueAsNumber)}
          />
        </label>
        <label>
          Files per row
          <select
            value={settings.filesPerRow}
            onChange={(event) =>
              setSettings({
                ...settings,
                filesPerRow: Number(event.target.value)
              })
            }
          >
            {[1, 2, 3, 4].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          File limit
          <input
            type="number"
            className="bf:w-[78px]"
            min="1"
            max="12"
            value={settings.fileLimit}
            onChange={(event) =>
              setSettings({
                ...settings,
                fileLimit: Math.max(
                  1,
                  Math.min(12, event.target.valueAsNumber || 6)
                )
              })
            }
          />
        </label>
        <label>
          Minimum KB
          <input
            type="number"
            className="bf:w-[78px]"
            min="0"
            value={settings.minimumFileSizeKb}
            onChange={(event) =>
              setSettings({
                ...settings,
                minimumFileSizeKb: Math.max(0, event.target.valueAsNumber || 0)
              })
            }
          />
        </label>
        <label className="bf:flex-row bf:items-center bf:pb-[7px]">
          <input
            type="checkbox"
            checked={settings.filePreview}
            onChange={(event) =>
              setSettings({ ...settings, filePreview: event.target.checked })
            }
          />
          Thumbnails
        </label>
        <label className="bf:flex-row bf:items-center bf:pb-[7px]">
          <input
            type="checkbox"
            checked={settings.includeEmails}
            onChange={(event) =>
              setSettings({ ...settings, includeEmails: event.target.checked })
            }
          />
          Email files
        </label>
        <label className="bf:flex-row bf:items-center bf:pb-[7px]">
          <input
            type="checkbox"
            checked={settings.multiple}
            onChange={(event) =>
              setSettings({ ...settings, multiple: event.target.checked })
            }
          />
          Multiple uploads
        </label>
        <button type="button" onClick={() => setMounted(!mounted)}>
          {mounted ? "Unmount cards" : "Mount cards"}
        </button>
        {scenario === "Live record" && (
          <button type="button" onClick={live.refresh}>
            Refresh files
          </button>
        )}
      </div>
      {mounted ? (
        <div className="bf:flex bf:flex-col bf:gap-6 bf:[&>section]:w-full bf:[&>section]:min-w-0 bf:[&>section>h2]:m-0 bf:[&>section>h2]:mb-[9px] bf:[&>section>h2]:text-[13px] bf:[&>section>h2]:font-normal">
          <section
            aria-label="Main record region"
            className="bf:max-w-(--preview-width)"
            style={previewStyle}
          >
            <h2>Main record region</h2>
            <div className={regionClassName}>
              {scenario === "Live record" ? (
                <LiveCard
                  state={live.state}
                  settings={settings}
                  refresh={live.refresh}
                />
              ) : (
                <FixtureCard
                  key={scenario}
                  scenario={scenario}
                  settings={settings}
                />
              )}
            </div>
          </section>
          <section
            aria-label="Narrow record region"
            className="bf:max-w-[352px]"
          >
            <h2>Narrow record region</h2>
            <div className={regionClassName}>
              {scenario === "Live record" ? (
                <LiveCard
                  state={live.state}
                  settings={settings}
                  refresh={live.refresh}
                />
              ) : (
                <FixtureCard
                  key={scenario}
                  scenario={scenario}
                  settings={settings}
                  label="Narrow card"
                />
              )}
            </div>
          </section>
        </div>
      ) : (
        <p role="status">
          Cards unmounted. Mount again to verify clean initialization.
        </p>
      )}
    </main>
  );
}
