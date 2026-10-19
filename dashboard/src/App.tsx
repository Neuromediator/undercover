import { getHealth } from "./api";
import { ClaimPage } from "./Claim";
import { Instructions } from "./Instructions";
import { Queue } from "./Queue";
import { useRoute, type Route } from "./route";
import { usePolling } from "./usePolling";

const HEALTH_POLL_MS = 5000;

function backendStatus(loaded: boolean, failed: boolean): string {
  if (failed) return "down";
  return loaded ? "up" : "checking";
}

function Page({ route }: Readonly<{ route: Route }>) {
  switch (route.page) {
    case "claim":
      return <ClaimPage key={route.claimId} claimId={route.claimId} />;
    case "instructions":
      return <Instructions />;
    default:
      return <Queue />;
  }
}

export function App() {
  const route = useRoute();
  const { data, error } = usePolling(getHealth, HEALTH_POLL_MS);
  const current = (page: Route["page"]) =>
    route.page === page ? "page" : undefined;

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#/">
          UnderCover
        </a>
        <span className="tagline">Claims desk</span>
        <nav>
          <a href="#/" aria-current={current("queue")}>
            Queue
          </a>
          <a href="#/instructions" aria-current={current("instructions")}>
            Agent instructions
          </a>
        </nav>
        <span className="health">
          Backend: {backendStatus(data !== undefined, error)}
        </span>
      </header>
      <main>
        <Page route={route} />
      </main>
    </>
  );
}
