"use client";

import { useState } from "react";
import { FileDrop, PreviewPanel, fetchSample, useImportFlow } from "./shared";

const SAMPLE_URL = "/samples/zerodha_tradebook.csv";

export function ZerodhaImport() {
  const [file, setFile] = useState<File | null>(null);
  const flow = useImportFlow(() => ({ kind: "zerodha" }));

  function pick(f: File) {
    setFile(f);
    flow.preview(f);
  }

  return (
    <div className="space-y-4">
      <FileDrop
        file={file}
        onFile={pick}
        onSample={async () => pick(await fetchSample(SAMPLE_URL, "zerodha_tradebook_sample.csv"))}
        sampleUrl={SAMPLE_URL}
        disabled={flow.previewing}
      >
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Open Zerodha Console → Reports → Tradebook.</li>
          <li>Pick Equity and/or F&amp;O and a date range, then download the CSV.</li>
          <li>Upload it here. We group fills into complete trades and skip anything already imported.</li>
        </ol>
      </FileDrop>
      <PreviewPanel {...flow} onImport={() => file && flow.save(file)} />
    </div>
  );
}
