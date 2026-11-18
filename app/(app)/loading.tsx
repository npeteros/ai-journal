import { Page } from '@/components/app-shell/page'

/**
 * Shown right away while a signed-in page renders on the server. The (app) layout and app shell
 * stay on screen, so this only fills the page area.
 */
export default function AppLoading() {
  return (
    <Page>
      <div aria-busy="true" aria-label="Loading" className="flex animate-pulse flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <div className="h-3 w-28 rounded bg-neutral-100" />
          <div className="h-8 w-64 max-w-full rounded bg-neutral-100" />
          <div className="h-3.5 w-96 max-w-full rounded bg-neutral-100" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-neutral-100" />
          ))}
        </div>
      </div>
    </Page>
  )
}
