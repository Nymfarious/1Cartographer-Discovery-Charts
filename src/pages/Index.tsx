import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, MessageSquare, User, Settings, Activity, LogIn, LogOut, Code2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DevPanel } from "@/components/DevPanel";

const Index = () => {
  const [username, setUsername] = useState<string>("");
  const [themeColor, setThemeColor] = useState<string>("#d4eaf7");
  const [isAdmin, setIsAdmin] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const name = localStorage.getItem("username") || "";
    const color = localStorage.getItem("favcolor") || "#d4eaf7";
    
    setUsername(name);
    setThemeColor(color);
    document.documentElement.style.setProperty('--theme-color', color);
    
    // Check auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkAdminStatus();
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          setTimeout(() => {
            checkAdminStatus();
          }, 0);
        } else {
          setIsAdmin(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function checkAdminStatus() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    setIsAdmin(!!roles);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
    navigate('/auth');
  }

  const navigationItems = [
    { 
      href: "/history", 
      icon: MapPin, 
      title: "Explore Maps", 
      description: "Browse historical maps & atlases",
      color: "from-amber-700 to-amber-900"
    },
    { 
      href: "/chat", 
      icon: MessageSquare, 
      title: "History AI", 
      description: "Ask questions about the past",
      color: "from-stone-700 to-stone-900"
    },
  ];

  return (
    <div className="min-h-screen" style={{ 
      background: 'linear-gradient(135deg, hsl(var(--parchment)) 0%, hsl(var(--parchment-dark)) 100%)',
      backgroundAttachment: 'fixed'
    }}>
      {/* Decorative border - antique frame effect */}
      <div className="fixed inset-0 pointer-events-none border-8 border-double opacity-40 z-50" 
           style={{ borderColor: 'hsl(var(--brass))' }} />
      
      {/* Header */}
      <div className="relative border-b-2 border-[hsl(var(--brass))] shadow-lg"
           style={{ 
             background: 'linear-gradient(to bottom, hsl(var(--leather)), hsl(var(--brass)/0.3))',
             boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
           }}>
        <div className="px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--brass))] 
                          flex items-center justify-center shadow-lg">
              <MapPin className="w-6 h-6 text-[hsl(var(--leather))]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--parchment))] tracking-wide" 
                  style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                DiscoveryCharts
              </h1>
              <p className="text-sm text-[hsl(var(--parchment))]/70">HD Layered Historical Maps</p>
            </div>
          </div>
          
          {/* Settings Dropdown */}
          <div className="relative flex items-center gap-3">
            {!session ? (
              <Button
                variant="brass"
                size="sm"
                onClick={() => navigate('/auth')}
              >
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            ) : (
              <>
                {isAdmin && (
                  <div className="px-3 py-1 rounded-full bg-gradient-to-r from-[hsl(var(--gold))] to-yellow-600 
                                border border-yellow-800 shadow-md">
                    <span className="text-xs font-bold text-[hsl(var(--leather))]">ADMIN</span>
                  </div>
                )}
                <button
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  title="Settings"
                >
                  <Settings className="w-6 h-6 text-[hsl(var(--parchment))]" />
                </button>
                
                {settingsOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setSettingsOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 bg-[hsl(var(--card))] border-2 
                                  border-[hsl(var(--brass))] rounded-lg shadow-xl z-20 min-w-[180px]"
                         style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                      <Link
                        to="/preferences"
                        className="block px-4 py-3 text-foreground hover:bg-[hsl(var(--accent))] 
                                 transition-colors first:rounded-t-lg flex items-center gap-2"
                        onClick={() => setSettingsOpen(false)}
                      >
                        <Settings className="w-4 h-4" />
                        Preferences
                      </Link>
                      <Link
                        to="/profile"
                        className="block px-4 py-3 text-foreground hover:bg-[hsl(var(--accent))] 
                                 transition-colors flex items-center gap-2 border-t border-[hsl(var(--border))]"
                        onClick={() => setSettingsOpen(false)}
                      >
                       <User className="w-4 h-4" />
                        Profile
                      </Link>
                      <button
                        onClick={() => {
                          setSettingsOpen(false);
                          handleSignOut();
                        }}
                        className="w-full text-left px-4 py-3 text-foreground hover:bg-[hsl(var(--accent))] 
                                 transition-colors last:rounded-b-lg flex items-center gap-2 border-t border-[hsl(var(--border))]"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Main Content - Discovery Desk */}
      <div className="px-8 py-12 max-w-6xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8 text-center">
          <h2 className="text-4xl font-bold text-foreground mb-2" 
              style={{ fontFamily: 'Georgia, serif' }}>
            {username ? `Welcome back, ${username}!` : "Welcome, Explorer!"}
          </h2>
          <p className="text-lg text-muted-foreground italic">
            Your Discovery Desk — Ready to explore the world's greatest timelines?
          </p>
        </div>

        {/* Recent Activity */}
        <div className="mb-8 p-6 bg-[hsl(var(--card))] rounded-lg border-2 border-[hsl(var(--border))] shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-[hsl(var(--brass))]" />
            <h3 className="font-semibold text-foreground">Recent Activity</h3>
          </div>
          <p className="text-sm text-muted-foreground italic">
            No activity yet — start your first journey!
          </p>
        </div>
        
        {/* Navigation Cards - Explorer's Desk */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="group relative overflow-hidden"
            >
              <div className="relative p-8 bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] 
                            rounded-lg shadow-lg hover:shadow-2xl transition-all duration-300 
                            hover:scale-105 hover:border-[hsl(var(--gold))]"
                   style={{ 
                     background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--parchment-dark)) 100%)',
                     boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                   }}>
                {/* Icon with gradient background */}
                <div className={`inline-flex p-4 rounded-full bg-gradient-to-br ${item.color} mb-4 
                               shadow-lg group-hover:scale-110 transition-transform`}>
                  <item.icon className="w-8 h-8 text-[hsl(var(--parchment))]" />
                </div>
                
                <h3 className="text-2xl font-bold text-foreground mb-2" 
                    style={{ fontFamily: 'Georgia, serif' }}>
                  {item.title}
                </h3>
                <p className="text-muted-foreground">{item.description}</p>
                
                {/* Decorative corner */}
                <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 
                              border-[hsl(var(--brass))] opacity-40" />
                <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 
                              border-[hsl(var(--brass))] opacity-40" />
              </div>
            </Link>
          ))}
        </div>

        {/* Coming Soon Card */}
        <div className="mt-6 p-6 bg-[hsl(var(--muted))] border-2 border-dashed border-[hsl(var(--border))] 
                      rounded-lg opacity-60 text-center">
          <p className="text-lg font-semibold text-muted-foreground mb-1">More Features Coming Soon</p>
          <p className="text-sm text-muted-foreground italic">Voice chronicles, timeline builder & more...</p>
        </div>
      </div>

      {/* Dev Tools Toggle Button - Fixed Bottom Left */}
      {isAdmin && session && (
        <button
          onClick={() => setDevPanelOpen(!devPanelOpen)}
          className="fixed bottom-6 left-6 z-30 p-4 rounded-full bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--brass))] 
                   shadow-2xl hover:scale-110 transition-all duration-200 border-2 border-[hsl(var(--leather))]
                   hover:shadow-[0_0_30px_rgba(218,165,32,0.5)]"
          title="Developer Tools"
        >
          <Code2 className="w-6 h-6 text-[hsl(var(--leather))]" />
        </button>
      )}

      {/* Dev Panel */}
      <DevPanel isOpen={devPanelOpen} onClose={() => setDevPanelOpen(false)} />
    </div>
  );
};

export default Index;
