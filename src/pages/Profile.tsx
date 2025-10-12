import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Home, Shield, Upload } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { profileSchema } from "@/lib/validation";

const Profile = () => {
  const [themeColor, setThemeColor] = useState<string>("#d4eaf7");
  const [userName, setUserName] = useState<string>("");
  const [cityState, setCityState] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [secondaryEmail, setSecondaryEmail] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  useEffect(() => {
    // Load profile data
    setUserName(localStorage.getItem("username") || "");
    setCityState(localStorage.getItem("cityState") || "");
    setSecondaryEmail(localStorage.getItem("secondaryEmail") || "");
    setAvatarUrl(localStorage.getItem("avatarUrl") || "");
    
    const color = localStorage.getItem("favcolor") || "#d4eaf7";
    setThemeColor(color);
    document.documentElement.style.setProperty('--theme-color', color);
    
    // Load user email and admin status from Supabase
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
      
      // Check admin status
      if (user) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        
        setIsAdmin(!!roles);
      }
    };
    loadUserData();
  }, []);

  const saveProfile = async () => {
    // Validate input
    const validation = profileSchema.safeParse({
      name: userName,
      cityState: cityState,
      secondaryEmail: secondaryEmail
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast({
        title: "Validation Error",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    localStorage.setItem("username", userName);
    localStorage.setItem("cityState", cityState);
    localStorage.setItem("secondaryEmail", secondaryEmail);
    localStorage.setItem("avatarUrl", avatarUrl);
    
    // Update secondary email in Supabase profile if needed
    if (secondaryEmail) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').upsert({
          user_id: user.id,
          secondary_email: secondaryEmail
        });
      }
    }
    
    toast({
      title: "Profile saved!",
      description: "Your profile has been updated successfully.",
    });
  };

  const resetProfile = () => {
    if (confirm("Reset profile information?")) {
      localStorage.removeItem("username");
      localStorage.removeItem("cityState");
      localStorage.removeItem("secondaryEmail");
      localStorage.removeItem("avatarUrl");
      
      setUserName("");
      setCityState("");
      setSecondaryEmail("");
      setAvatarUrl("");
      
      toast({
        title: "Profile reset",
        description: "Profile information has been cleared.",
      });
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen" style={{ 
      background: 'linear-gradient(135deg, hsl(var(--parchment)) 0%, hsl(var(--parchment-dark)) 100%)',
      backgroundAttachment: 'fixed'
    }}>
      {/* Decorative border */}
      <div className="fixed inset-0 pointer-events-none border-8 border-double opacity-30 z-50" 
           style={{ borderColor: 'hsl(var(--brass))' }} />
      
      {/* Header */}
      <div className="relative border-b-2 border-[hsl(var(--brass))] shadow-lg"
           style={{ 
             background: 'linear-gradient(to bottom, hsl(var(--leather)), hsl(var(--brass)/0.3))',
             boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
           }}>
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild size="sm"
                    className="text-[hsl(var(--parchment))] hover:bg-white/10">
              <Link to="/" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Dashboard
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <User className="w-6 h-6 text-[hsl(var(--gold))]" />
              <span className="text-xl font-bold text-[hsl(var(--parchment))]" 
                    style={{ fontFamily: 'Georgia, serif' }}>
                Profile
              </span>
            </div>
          </div>
          {isAdmin && (
            <div className="px-4 py-2 rounded-full bg-gradient-to-r from-[hsl(var(--gold))] to-yellow-600 
                          border-2 border-yellow-800 shadow-lg flex items-center gap-2">
              <Shield className="w-4 h-4 text-[hsl(var(--leather))]" />
              <span className="text-sm font-bold text-[hsl(var(--leather))]">ADMIN</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <div className="bg-[hsl(var(--card))] rounded-lg border-2 border-[hsl(var(--brass))] shadow-xl p-8 space-y-8">
          <div className="space-y-6 pb-6 border-b-2 border-[hsl(var(--border))]">
            <h2 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
              <User className="w-6 h-6 text-[hsl(var(--brass))]" />
              Personal Information
            </h2>

          <div className="flex items-center gap-6">
            <div>
              <Avatar className="w-16 h-16 border-2 border-[hsl(var(--brass))]">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="bg-[hsl(var(--muted))] text-[hsl(var(--brass))]">
                  {userName ? userName[0].toUpperCase() : <User className="w-6 h-6" />}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1">
              <Label htmlFor="avatarUpload" className="font-semibold text-sm mb-2 block">Profile Picture:</Label>
              <div className="flex gap-2">
                <Input
                  id="avatarUpload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="border-[hsl(var(--border))]"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 italic">
                Upload a photo or choose from the gallery
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="userEmail" className="font-semibold text-sm">Registered Email (from Auth):</Label>
            <Input 
              id="userEmail"
              type="email"
              value={userEmail}
              disabled
              className="mt-1 bg-[hsl(var(--muted))] cursor-not-allowed border-[hsl(var(--border))]"
            />
            <p className="text-xs text-muted-foreground mt-1 italic">
              This email is your login credential and cannot be changed here.
            </p>
          </div>

          <div>
            <Label htmlFor="userName" className="font-semibold text-sm">Name:</Label>
            <Input 
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="mt-1 border-[hsl(var(--border))]"
            />
          </div>

          <div>
            <Label htmlFor="cityState" className="font-semibold text-sm">City, State:</Label>
            <Input 
              id="cityState"
              value={cityState}
              onChange={(e) => setCityState(e.target.value)}
              placeholder="e.g., New York, NY"
              className="mt-1 border-[hsl(var(--border))]"
            />
          </div>

          <div>
            <Label htmlFor="secondaryEmail" className="font-semibold text-sm">Recovery Email (optional):</Label>
            <Input 
              id="secondaryEmail"
              type="email"
              value={secondaryEmail}
              onChange={(e) => setSecondaryEmail(e.target.value)}
              placeholder="Recovery email address"
              className="mt-1 border-[hsl(var(--border))]"
            />
            <p className="text-xs text-muted-foreground mt-1 italic">
              An alternate email for account recovery purposes.
            </p>
          </div>
        </div>

         <div className="flex gap-4 pt-4">
           <Button onClick={saveProfile} 
                   variant="brass"
                   size="lg">
             Save Profile
           </Button>
           <Button onClick={resetProfile} variant="destructive" 
                   size="lg">
             Reset Profile
           </Button>
         </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;