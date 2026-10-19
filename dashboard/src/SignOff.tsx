import { useState } from "react";
import { signOff, type Claim, type Handler } from "./api";
import { money } from "./format";
import { Notice } from "./Parts";

export function SignOff(
  props: Readonly<{
    claim: Claim;
    handlers: Handler[];
    onSignedOff: () => void;
  }>,
) {
  const { claim, handlers, onSignedOff } = props;
  const [handlerId, setHandlerId] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setProblem("");
    try {
      await signOff(claim.claim_id, handlerId);
      onSignedOff();
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : "Could not sign off.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="signoff"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label htmlFor="signoff-handler">Signing off</label>
      <select
        id="signoff-handler"
        value={handlerId}
        onChange={(event) => {
          setHandlerId(event.target.value);
        }}
      >
        <option value="">Choose your name</option>
        {handlers
          .filter((handler) => handler.can_approve_over_limit)
          .map((handler) => (
            <option key={handler.handler_id} value={handler.handler_id}>
              {handler.name}
            </option>
          ))}
      </select>
      <button type="submit" className="primary" disabled={!handlerId || busy}>
        Sign off and pay {money(claim.payout ?? 0)}
      </button>
      {problem && <Notice>{problem}</Notice>}
    </form>
  );
}
