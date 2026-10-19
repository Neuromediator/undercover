import { getInstructions } from "./api";
import { Notice } from "./Parts";
import { usePolling } from "./usePolling";

const INSTRUCTIONS_POLL_MS = 10000;

export function Instructions() {
  const { data, error } = usePolling(getInstructions, INSTRUCTIONS_POLL_MS);
  return (
    <>
      <h1>Agent instructions</h1>
      <p className="muted">
        What the UnderCover Agent is told before every claim. Read only.
      </p>
      {error && <Notice>Could not load the instructions.</Notice>}
      {data && (
        <section className="panel">
          <pre className="instructions">{data.text}</pre>
        </section>
      )}
    </>
  );
}
