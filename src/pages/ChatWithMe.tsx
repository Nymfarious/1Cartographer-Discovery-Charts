import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mic, Square, Send, Volume2, Loader2, History, MessageSquare, Home, LogOut, ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ChatWithMe = () => {
  const [themeColor, setThemeColor] = useState<string>("#d4eaf7");
  const [prompt, setPrompt] = useState<string>("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  useEffect(() => {
    const color = localStorage.getItem("favcolor") || "#d4eaf7";
    setThemeColor(color);
    document.documentElement.style.setProperty('--theme-color', color);
  }, []);

  const sendMessage = async () => {
    if (!prompt.trim() || isLoading) return;

    const userMessage = prompt.trim();
    setPrompt("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('historian-qa', {
        body: { question: userMessage }
      });

      if (error) throw error;

      const assistantMessage = data.answer;
      setMessages(prev => [...prev, { role: "assistant", content: assistantMessage }]);

      // Save to chat history
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('chat_history').insert({
          user_id: user.id,
          question: userMessage,
          answer: assistantMessage
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to get response from historian",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Microphone Error",
        description: "Could not access microphone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-to-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ audio: base64Audio }),
        });

        const data = await response.json();
        if (data.text) {
          setPrompt(data.text);
        }
      };
    } catch (error) {
      console.error('Error transcribing audio:', error);
      toast({
        title: "Transcription Error",
        description: "Could not transcribe audio",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const speakText = async (text: string) => {
    if (isSpeaking) return;
    
    setIsSpeaking(true);
    const voiceProvider = localStorage.getItem("voiceProvider") || "browser";
    const selectedVoiceId = localStorage.getItem("selectedVoiceId");

    try {
      if (voiceProvider === "elevenlabs" && selectedVoiceId) {
        // Use backend edge function for ElevenLabs
        const { data, error } = await supabase.functions.invoke('text-to-speech', {
          body: { 
            text,
            voiceId: selectedVoiceId,
            modelId: 'eleven_multilingual_v2'
          }
        });

        if (error) throw error;

        const audioBlob = new Blob([data], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        await audio.play();
      } else {
        // Default to browser voice (UK English)
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        
        // Try to find UK English voice, fallback to any English voice
        const ukVoice = voices.find(v => 
          v.lang === 'en-GB' || 
          v.name.includes('UK') || 
          v.name.includes('British')
        );
        const anyEnglishVoice = voices.find(v => v.lang.startsWith('en'));
        
        utterance.voice = ukVoice || anyEnglishVoice || voices[0];
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Error speaking text:', error);
      setIsSpeaking(false);
      toast({
        title: "Speech Error",
        description: "Could not speak text. Using default voice.",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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
      
      {/* Header with consistent styling */}
      <header className="sticky top-0 z-20 backdrop-blur-sm bg-card/95 border-b-2 border-[hsl(var(--brass))] shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/" className="flex items-center gap-2 hover:text-primary transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Dashboard</span>
                </Link>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Georgia, serif' }}>
                  History AI Assistant
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild className="border-[hsl(var(--brass))]">
                <Link to="/chat-history" className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  <span>Chat History</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
        {/* Messages Display */}
        <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border-2 border-primary/20 p-6 mb-4 min-h-[400px] max-h-[500px] overflow-y-auto" 
             style={{ 
               backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(255,255,255,0))',
               boxShadow: '0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.1)'
             }}>
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 space-y-2">
              <div className="text-6xl mb-4">📜</div>
              <p className="text-lg font-serif italic">Consult the historian's archives...</p>
              <p className="text-sm">Ask about maps, territories, and the passage of time</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    msg.role === "user"
                      ? "bg-primary/10 border-primary/30 ml-8 shadow-md"
                      : "bg-card/90 border-border/50 mr-8 shadow-md backdrop-blur-sm"
                  }`}
                  style={msg.role === "assistant" ? {
                    backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0))',
                  } : undefined}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="whitespace-pre-wrap text-foreground flex-1 font-serif leading-relaxed">
                      {msg.role === "assistant" && <span className="text-primary font-bold">📖 </span>}
                      {msg.content}
                    </div>
                    {msg.role === "assistant" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => speakText(msg.content)}
                        disabled={isSpeaking}
                      >
                        <Volume2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border-2 border-primary/20 p-6"
             style={{ 
               backgroundImage: 'linear-gradient(to top, rgba(255,255,255,0.05), rgba(255,255,255,0))',
               boxShadow: '0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.1)'
             }}>
          <div className="space-y-4">
            <Label htmlFor="prompt" className="font-semibold font-serif text-lg flex items-center gap-2">
              <span>🖋️</span>
              Inscribe your query:
            </Label>
            <div className="flex gap-2">
              <Textarea
                id="prompt"
                placeholder="What would you like to know about history?"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyPress}
                className="flex-1 min-h-[80px]"
                disabled={isLoading}
              />
            </div>
            <div className="flex gap-2 justify-end">
              {!isRecording ? (
                <Button
                  variant="outline"
                  onClick={startRecording}
                  disabled={isLoading}
                >
                  <Mic className="h-4 w-4 mr-2" />
                  Record
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={stopRecording}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}
              <Button
                onClick={sendMessage}
                disabled={isLoading || !prompt.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
};

export default ChatWithMe;