import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import EkkoClassicPanel from "./ekko/EkkoClassicPanel";
import EkkoLabsPanel from "./ekko/EkkoLabsPanel";
// Ekko v2 styles are loaded via index.html link
const Ekko = () => {
  const [themeColor, setThemeColor] = useState<string>("#d4eaf7");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const color = localStorage.getItem("favcolor") || "#d4eaf7";
    setThemeColor(color);
    document.documentElement.style.setProperty('--theme-color', color);
    
    // Load voices
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices().filter(v =>
        v.lang.startsWith('en') && v.voiceURI.toLowerCase().includes('google')
      );
      setVoices(availableVoices);
      setSelectedVoice(availableVoices[0] || null);
    };
    
    if (typeof speechSynthesis !== "undefined") {
      speechSynthesis.onvoiceschanged = loadVoices;
      loadVoices();
    }
  }, []);

  const getVoiceLabel = (voice: SpeechSynthesisVoice) => {
    const name = voice.name.toLowerCase();
    if (name.includes("female") || name.includes("zira")) return "Aunt Violet";
    if (name.includes("male") || name.includes("david") || name.includes("brian")) return "Cody";
    return voice.name;
  };

  const playTestVoice = (voiceType: "female" | "male") => {
    const name = localStorage.getItem("username") || "friend";
    let voice: SpeechSynthesisVoice | undefined;
    let text = "";

    if (voiceType === "female") {
      voice = voices.find(v => getVoiceLabel(v) === "Aunt Violet");
      text = `Hi! My name is Little Sister. It is so very lovely to meet you, ${name}.`;
    } else {
      voice = voices.find(v => getVoiceLabel(v) === "Cody");
      text = `Hey! I'm Little Sister, and I'm happy to help you, ${name}!`;
    }

    if (!voice) {
      toast({
        title: "Voice not found",
        description: "Please check your browser's voice settings.",
        variant: "destructive"
      });
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.rate = 1;
    speechSynthesis.speak(utterance);
  };

  const toggleMicrophone = () => {
    if (isListening) {
      stopListening();
      return;
    }

    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast({
        title: "Speech Recognition not supported",
        description: "Your browser doesn't support Speech Recognition. Try Chrome!",
        variant: "destructive"
      });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript("Listening...");
    };

    recognition.onresult = (event) => {
      const result = event.results[0][0].transcript;
      setTranscript(result);
      speakTranscript(result);
    };

    recognition.onerror = (event) => {
      setTranscript("Error: " + event.error);
      setIsListening(false);
      toast({
        title: "Recognition error",
        description: "Error: " + event.error,
        variant: "destructive"
      });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const speakTranscript = (text: string) => {
    if (!text) return;
    
    const voice = voices.find(v => getVoiceLabel(v) === "Cody") || voices[0];
    if (!voice) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.rate = 1;
    speechSynthesis.speak(utterance);
  };


  const name = localStorage.getItem("username") || "friend";
  const currentVoiceLabel = selectedVoice ? getVoiceLabel(selectedVoice) : "(no Google voice found)";

  return (
    <div className="min-h-screen" style={{ 
      background: 'linear-gradient(135deg, hsl(var(--parchment)) 0%, hsl(var(--parchment-dark)) 100%)',
      backgroundAttachment: 'fixed'
    }}>
      {/* Decorative border */}
      <div className="fixed inset-0 pointer-events-none border-8 border-double opacity-30 z-50" 
           style={{ borderColor: 'hsl(var(--brass))' }} />
      
      {/* Header with consistent styling */}
      <header className="sticky top-0 z-20 backdrop-blur-sm bg-card/95 border-b-2 border-[hsl(var(--brass))] shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/" className="flex items-center gap-2 hover:text-primary transition-colors">
                <ArrowLeft className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎤</span>
              <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Georgia, serif' }}>
                Cartographer Study - Ekko Voice
              </h1>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-2xl font-bold mb-6 text-foreground">
            Hi {name}!
          </div>



        {/* Side-by-side: Classic (left) and Labs (right) */}
        <div className="ekko-split mt-4">
          <div>
            <small className="opacity-70">Ekko v3 (Classic)</small>
            <EkkoClassicPanel />
          </div>
          <div>
            <small className="opacity-70">Ekko Labs (New)</small>
            <EkkoLabsPanel />
          </div>
        </div>
        </div>
      </main>
    </div>
  );
};

export default Ekko;