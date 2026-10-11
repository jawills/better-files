import { useState } from "react";
import { FixtureCard } from "./fixture-card";
import { scenarios, type Scenario } from "./fixtures";
import { defaultSettings } from "@/model";
import { LiveCard, useLiveFiles } from "./live-card";

const demoScenarios = ["Live record", ...scenarios] as const;

export function App() {
  const [scenario, setScenario] = useState<Scenario | "Live record">(
    import.meta.env.DEV ? "Live record" : "Populated"
  );
  const [settings, setSettings] = useState(defaultSettings);
  const [width, setWidth] = useState(960);
  const [mounted, setMounted] = useState(true);
  const live = useLiveFiles(scenario === "Live record");
  return (
    <main className="demo">
      <h1>
        Better Files <span>Milestone 2</span>
      </h1>
      <p className="demo-intro">
        {scenario === "Live record"
          ? `Live files: ${live.state.status === "ready" ? live.state.data.recordName : "1Sync"} account in better-files.`
          : "Option A. Fixture data only. Preview, upload, and View All demonstrate host callbacks."}
      </p>
      <div className="demo-controls">
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
          Card width: {width}px
          <input
            type="range"
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
        <label className="demo-checkbox">
          <input
            type="checkbox"
            checked={settings.filePreview}
            onChange={(event) =>
              setSettings({ ...settings, filePreview: event.target.checked })
            }
          />
          Thumbnails
        </label>
        <label className="demo-checkbox">
          <input
            type="checkbox"
            checked={settings.includeEmails}
            onChange={(event) =>
              setSettings({ ...settings, includeEmails: event.target.checked })
            }
          />
          Email files
        </label>
        <label className="demo-checkbox">
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
        <div className="demo-canvases">
          <section
            aria-label="Main record region"
            style={{ maxWidth: width + 32 }}
          >
            <h2>Main record region</h2>
            <div className="demo-canvas">
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
          <section aria-label="Narrow record region" className="demo-narrow">
            <h2>Narrow record region</h2>
            <div className="demo-canvas">
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
