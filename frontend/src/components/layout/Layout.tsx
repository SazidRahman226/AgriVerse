import Navbar from "./Navbar";
import { useLocation } from "react-router-dom";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  // Hide footer on app-like pages where it hurts UX
  const hideFooterRoutes = [
    "/profile",
    "/forum",
    "/requests",
    "/ml/disease",
    "/map",
    "/requests/", // safety for nested
  ];

  const hideFooter = hideFooterRoutes.some((path) =>
    location.pathname.startsWith(path.replace(/\/$/, ""))
  );

  return (
    <div className="h-dvh flex flex-col bg-background">
      <Navbar />

      {/* ✅ main scrolls, footer can sit at bottom */}
      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {/* page content */}
        <div className="flex-1">
          {children}
        </div>

        {/* footer sits at bottom when content is short */}
        {!hideFooter && (
          <footer className="mt-auto border-t border-border/50 py-4 bg-card/30">
            <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
              <p>
                © {new Date().getFullYear()} AgriVerse. Cultivating the future of agriculture.
              </p>
            </div>
          </footer>
        )}
      </main>
    </div>
  );
};

export default Layout;
