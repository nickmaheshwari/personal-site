import { type FormEvent, useState } from "react";

interface Props {
  analyzing: boolean;
  error: string | null;
  onAnalyze: (file: File) => void;
}

const ACCEPT = ".pdf,.docx,.txt,.md,application/pdf";

export function Upload({ analyzing, error, onAnalyze }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (file) onAnalyze(file);
  }

  return (
    <section className="card">
      <h2>
        <span className="step">1</span> Your resume
      </h2>
      <form onSubmit={submit}>
        <label
          className={`dropzone${dragging ? " dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const dropped = e.dataTransfer.files[0];
            if (dropped) setFile(dropped);
          }}
        >
          <input type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <span className="file-name">{file.name}</span>
          ) : (
            <span>
              <strong>Choose a file</strong> or drag it here
            </span>
          )}
          <span className="hint">PDF, DOCX, TXT or MD, up to 10 MB</span>
        </label>

        <div className="actions">
          <button type="submit" className="primary" disabled={!file || analyzing}>
            {analyzing ? "Reading your resume…" : "Suggest job titles"}
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
