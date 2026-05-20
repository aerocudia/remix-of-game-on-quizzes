import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center glass rounded-2xl p-10">
        <h1 className="text-7xl font-display font-bold gradient-text">404</h1>
        <p className="mt-4 text-muted-foreground">This room doesn't exist.</p>
        <Link to="/" className="mt-6 inline-block rounded-xl gradient-primary px-6 py-3 font-semibold text-white glow-violet">
          Back home
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "DeonToWin — Host Live Quizzes" },
      { name: "description", content: "Host live quizzes, flashcards, and assessments with Game On Quizzes. Engage players with interactive games and study tools." },
      { property: "og:title", content: "DeonToWin — Host Live Quizzes" },
      { property: "og:description", content: "Host live quizzes, flashcards, and assessments with Game On Quizzes. Engage players with interactive games and study tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "DeonToWin — Host Live Quizzes" },
      { name: "twitter:description", content: "Host live quizzes, flashcards, and assessments with Game On Quizzes. Engage players with interactive games and study tools." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9ed98fa0-41b2-4499-aa08-68d57affeb70/id-preview-8b61c174--08cdc4eb-202b-482a-89dc-355f7a559bb6.lovable.app-1779269873978.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9ed98fa0-41b2-4499-aa08-68d57affeb70/id-preview-8b61c174--08cdc4eb-202b-482a-89dc-355f7a559bb6.lovable.app-1779269873978.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" position="top-center" />
    </QueryClientProvider>
  );
}
