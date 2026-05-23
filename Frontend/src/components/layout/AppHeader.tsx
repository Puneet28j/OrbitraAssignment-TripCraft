import { NavLink, useNavigate } from "react-router-dom";
import { Compass, UploadCloud, History, LogOut, User } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { ROUTES } from "../../lib/constants";

export const AppHeader = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate(ROUTES.LOGIN);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const navItems = [
    { label: "Dashboard", path: ROUTES.DASHBOARD, icon: Compass },
    { label: "Upload Documents", path: ROUTES.UPLOAD, icon: UploadCloud },
    { label: "History", path: ROUTES.HISTORY, icon: History },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => navigate(ROUTES.DASHBOARD)}
        >
          <div className="h-9 w-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Compass className="h-5 w-5 text-primary animate-pulse-ring" />
          </div>
          <span className="font-semibold text-lg tracking-tight text-foreground">
            TripCraft{" "}
            <span className="text-xs text-muted-foreground font-mono ml-0.5">AI</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition duration-fast ${
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-secondary hover:text-foreground hover:bg-surface-2 border border-transparent"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 bg-surface-2 border border-border px-2 py-1.5 sm:px-3 rounded-full">
            <div className="h-5 w-5 rounded-full bg-accent-border/20 border border-accent-border/30 flex items-center justify-center">
              <User className="h-3 w-3 text-accent" />
            </div>
            <span
              className="hidden sm:inline text-xs font-medium text-foreground truncate max-w-25"
              title={user?.name}
            >
              {user?.name || "Traveler"}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-full border border-border hover:border-destructive/30 hover:bg-destructive/10 text-muted hover:text-destructive transition duration-fast active:scale-95"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
