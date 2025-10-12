import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// ElevenLabs voices with IDs (free tier: 10k chars/month)
const ELEVENLABS_VOICES = [
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', gender: 'female' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', gender: 'male' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', gender: 'female' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', gender: 'male' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'male' },
];

// Theme presets with light, medium, and dark variants
const THEME_PRESETS = [
  {
    name: "Vintage Cartographer",
    colors: { light: "#f5e6d3", medium: "#8b7355", dark: "#5c4a3a" },
    description: "Aged parchment and explorer's desk"
  },
  {
    name: "Blue",
    colors: { light: "#e3f2fd", medium: "#2196f3", dark: "#1565c0" }
  },
  {
    name: "Purple", 
    colors: { light: "#f3e5f5", medium: "#9c27b0", dark: "#6a1b9a" }
  },
  {
    name: "Gray",
    colors: { light: "#f5f5f5", medium: "#757575", dark: "#424242" }
  },
  {
    name: "Pink",
    colors: { light: "#fce4ec", medium: "#e91e63", dark: "#ad1457" }
  },
  {
    name: "Orange",
    colors: { light: "#fff3e0", medium: "#ff9800", dark: "#e65100" }
  },
  {
    name: "Green",
    colors: { light: "#e8f5e8", medium: "#4caf50", dark: "#2e7d32" }
  }
];


const Preferences = () => {
  const [themeColor, setThemeColor] = useState<string>("#d4eaf7");
  const [emails, setEmails] = useState<string[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState<string>("");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [voiceProvider, setVoiceProvider] = useState<'browser' | 'elevenlabs'>('browser');
  const [userName, setUserName] = useState<string>("");
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentUtterance, setCurrentUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [trustedSources, setTrustedSources] = useState<string[]>([
    "wikipedia.org",
    "loc.gov",
    "britishmuseum.org"
  ]);

  useEffect(() => {
    // Load browser voices
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices().filter(voice => voice.lang.startsWith('en'));
      setBrowserVoices(voices);
    };
    
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    // Load preferences data
    const savedEmails = JSON.parse(localStorage.getItem("userEmails") || "[]");
    setEmails(savedEmails);
    setSelectedEmails(savedEmails.slice(0, 1)); // Default to first email selected
    setSelectedVoiceId(localStorage.getItem("selectedVoiceId") || "");
    setVoiceProvider(localStorage.getItem("voiceProvider") as 'browser' | 'elevenlabs' || 'browser');
    setUserName(localStorage.getItem("username") || "");
    
    const savedSources = localStorage.getItem("trustedSources");
    if (savedSources) {
      setTrustedSources(JSON.parse(savedSources));
    }
    
    const color = localStorage.getItem("favcolor") || "#d4eaf7";
    setThemeColor(color);
    document.documentElement.style.setProperty('--theme-color', color);
  }, []);

  const handleThemeChange = (color: string) => {
    setThemeColor(color);
    document.documentElement.style.setProperty('--theme-color', color);
  };

  const savePreferences = () => {
    localStorage.setItem("favcolor", themeColor);
    localStorage.setItem("selectedVoiceId", selectedVoiceId);
    localStorage.setItem("voiceProvider", voiceProvider);
    localStorage.setItem("userEmails", JSON.stringify(emails));
    localStorage.setItem("selectedEmails", JSON.stringify(selectedEmails));
    localStorage.setItem("trustedSources", JSON.stringify(trustedSources));
    
    toast({
      title: "Preferences saved!",
      description: "Your preferences have been updated successfully.",
    });
  };

  const resetPreferences = () => {
    if (confirm("Reset ALL preferences?")) {
      localStorage.removeItem("favcolor");
      localStorage.removeItem("selectedVoiceId");
      localStorage.removeItem("voiceProvider");
      localStorage.removeItem("userEmails");
      localStorage.removeItem("selectedEmails");
      
      setEmails([]);
      setSelectedEmails([]);
      setNewEmail("");
      setSelectedVoiceId("");
      setVoiceProvider('browser');
      const defaultColor = "#d4eaf7";
      setThemeColor(defaultColor);
      handleThemeChange(defaultColor);
      
      toast({
        title: "Preferences reset",
        description: "All preferences have been cleared.",
      });
    }
  };

  const stopVoice = () => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      setIsPlaying(false);
      setCurrentUtterance(null);
    }
  };

  const testVoice = async () => {
    const testText = `Welcome to History Discoveries! I'm your guide through time, ready to explore fascinating historical moments with you, ${userName || "explorer"}.`;
    
    if (voiceProvider === 'browser') {
      // Use Web Speech API (completely free)
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(testText);
        
        if (selectedVoiceId) {
          const selectedVoice = browserVoices.find(voice => voice.name === selectedVoiceId);
          if (selectedVoice) {
            utterance.voice = selectedVoice;
          }
        }
        
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);
        
        setCurrentUtterance(utterance);
        speechSynthesis.speak(utterance);
        
        toast({
          title: "Voice test successful!",
          description: "Playing browser voice - completely free!",
        });
      } else {
        toast({
          title: "Speech not supported",
          description: "Your browser doesn't support speech synthesis.",
          variant: "destructive"
        });
      }
    } else {
      // ElevenLabs voice testing via secure edge function
      if (!selectedVoiceId) {
        toast({
          title: "Voice not selected",
          description: "Please select an ElevenLabs voice first.",
          variant: "destructive"
        });
        return;
      }

      try {
        setIsPlaying(true);
        const { data, error } = await supabase.functions.invoke('text-to-speech', {
          body: { 
            text: testText,
            voiceId: selectedVoiceId,
            modelId: 'eleven_multilingual_v2'
          }
        });

        if (error) throw error;

        const audioBlob = new Blob([data], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => setIsPlaying(false);
        await audio.play();

        const selectedElevenVoice = ELEVENLABS_VOICES.find(v => v.id === selectedVoiceId);
        toast({
          title: "Voice test successful!",
          description: `Playing ${selectedElevenVoice?.name}'s voice.`,
        });
      } catch (error) {
        setIsPlaying(false);
        toast({
          title: "Voice test failed",
          description: "Please ensure the API key is configured in backend settings.",
          variant: "destructive"
        });
      }
    }
  };

  const addEmail = () => {
    if (newEmail && !emails.includes(newEmail)) {
      const updatedEmails = [...emails, newEmail];
      setEmails(updatedEmails);
      setSelectedEmails([...selectedEmails, newEmail]);
      setNewEmail("");
    }
  };

  const removeEmail = (emailToRemove: string) => {
    setEmails(emails.filter(e => e !== emailToRemove));
    setSelectedEmails(selectedEmails.filter(e => e !== emailToRemove));
  };

  const toggleEmailSelection = (email: string) => {
    if (selectedEmails.includes(email)) {
      setSelectedEmails(selectedEmails.filter(e => e !== email));
    } else {
      setSelectedEmails([...selectedEmails, email]);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <div 
        className="fixed left-0 top-0 bottom-0 w-4 opacity-90 z-10"
        style={{ backgroundColor: themeColor }}
      />
      
      {/* Header */}
      <div 
        className="w-full opacity-92 p-4 pl-12 text-foreground text-xl font-bold ml-4"
        style={{ backgroundColor: themeColor }}
      >
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary">
            ← Dashboard
          </Link>
        </Button>
        Preferences
      </div>
      
      {/* Main Content */}
      <div className="ml-10 mt-9 p-8 space-y-8">
        {/* Theme Settings */}
        <div className="space-y-6 pb-6 border-b border-border">
          <h2 className="text-lg font-semibold">Theme Settings</h2>
          <div>
            <Label htmlFor="favcolor" className="font-semibold">Theme Color:</Label>
            <input 
              id="favcolor"
              type="color"
              value={themeColor}
              onChange={(e) => handleThemeChange(e.target.value)}
              className="mt-1 w-16 h-8 rounded border border-border"
            />
          </div>
          
          {/* Theme Presets */}
          <div>
            <Label className="font-semibold">Theme Presets:</Label>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-4">
              {THEME_PRESETS.map((theme) => (
                <div key={theme.name} className="space-y-2">
                  <div className="flex items-center justify-center gap-1">
                    <h4 className="text-sm font-medium text-center">{theme.name}</h4>
                    {theme.name === "Vintage Cartographer" && <span className="text-lg">🗺️</span>}
                  </div>
                  {'description' in theme && (
                    <p className="text-xs text-muted-foreground text-center italic">
                      {theme.description}
                    </p>
                  )}
                  <div className="flex gap-1 justify-center">
                    <button
                      onClick={() => handleThemeChange(theme.colors.light)}
                      className="w-8 h-8 rounded border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: theme.colors.light }}
                      title={`${theme.name} Light`}
                    />
                    <button
                      onClick={() => handleThemeChange(theme.colors.medium)}
                      className="w-8 h-8 rounded border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: theme.colors.medium }}
                      title={`${theme.name} Medium`}
                    />
                    <button
                      onClick={() => handleThemeChange(theme.colors.dark)}
                      className="w-8 h-8 rounded border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: theme.colors.dark }}
                      title={`${theme.name} Dark`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Voice Settings */}
        <div className="space-y-6 pb-6 border-b border-border">
          <h2 className="text-lg font-semibold">Voice Settings</h2>
          
          {/* Unified Voice Selection */}
          <div>
            <Label className="font-semibold">Select Voice:</Label>
            <Select 
              value={`${voiceProvider}:${selectedVoiceId}`} 
              onValueChange={(value) => {
                const [provider, voiceId] = value.split(':');
                setVoiceProvider(provider as 'browser' | 'elevenlabs');
                setSelectedVoiceId(voiceId);
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a voice" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">Browser Voices (FREE)</div>
                {browserVoices.map((voice) => (
                  <SelectItem key={`browser:${voice.name}`} value={`browser:${voice.name}`}>
                    {voice.name} (Browser - FREE)
                  </SelectItem>
                ))}
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground border-t mt-2 pt-2">ElevenLabs (Premium)</div>
                {ELEVENLABS_VOICES.map((voice) => (
                  <SelectItem key={`elevenlabs:${voice.id}`} value={`elevenlabs:${voice.id}`}>
                    {voice.name} (ElevenLabs)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">
              Browser voices are completely free. ElevenLabs voices use secure backend configuration.
            </p>
          </div>

          {/* Voice Test Controls */}
          <div className="flex items-center gap-2">
            <Button onClick={testVoice} variant="outline" disabled={isPlaying}>
              🔊 Test Voice
            </Button>
            {isPlaying && (
              <Button onClick={stopVoice} variant="outline" className="bg-destructive/10 hover:bg-destructive/20">
                ⏹️ Stop
              </Button>
            )}
          </div>
        </div>

        {/* Email Settings */}
        <div className="space-y-6 pb-6 border-b border-border">
          <h2 className="text-lg font-semibold">Email Settings</h2>
          
          {/* Add Email */}
          <div className="flex gap-2">
            <Input 
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter email address"
              className="flex-1"
            />
            <Button onClick={addEmail} variant="outline">
              Add Email
            </Button>
          </div>

          {/* Email List */}
          {emails.length > 0 && (
            <div className="space-y-3">
              <Label className="font-semibold">Your Emails:</Label>
              {emails.map((email, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                  <div className="flex items-center space-x-2">
                    {emails.length > 1 && (
                      <input
                        type="checkbox"
                        checked={selectedEmails.includes(email)}
                        onChange={() => toggleEmailSelection(email)}
                        className="rounded"
                      />
                    )}
                    <span>{email}</span>
                  </div>
                  <Button 
                    onClick={() => removeEmail(email)} 
                    variant="outline" 
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {emails.length > 1 && (
                <p className="text-sm text-muted-foreground">
                  Selected emails: {selectedEmails.length} of {emails.length}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Trusted Sources (Zippy) */}
        <div className="space-y-6 pb-6 border-b border-border">
          <h2 className="text-lg font-semibold">Trusted Historical Sources (Zippy)</h2>
          <p className="text-sm text-muted-foreground">
            Search agents will prioritize results from these trusted domains when researching historical topics.
          </p>
          
          <div className="space-y-3">
            {trustedSources.map((source, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input 
                  value={source}
                  onChange={(e) => {
                    const updated = [...trustedSources];
                    updated[index] = e.target.value;
                    setTrustedSources(updated);
                  }}
                  placeholder="e.g., wikipedia.org"
                  className="flex-1"
                />
                <Button 
                  onClick={() => setTrustedSources(trustedSources.filter((_, i) => i !== index))}
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          
          {trustedSources.length < 5 && (
            <Button 
              onClick={() => setTrustedSources([...trustedSources, ""])}
              variant="outline"
              size="sm"
            >
              + Add Source
            </Button>
          )}
          
          <p className="text-xs text-muted-foreground">
            Maximum 5 trusted sources. Enter domain names only (e.g., loc.gov, not https://loc.gov)
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button onClick={savePreferences}>
            💾 Save Preferences
          </Button>
          <Button onClick={resetPreferences} variant="outline">
            ♻️ Reset Preferences
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Preferences;