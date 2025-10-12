import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Clock, Trash2, Copy, CheckCircle2, LogOut, Home, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface ChatHistoryItem {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

const ChatHistory = () => {
  const [themeColor] = useState<string>("#d4eaf7");
  const navigate = useNavigate();
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const color = localStorage.getItem("favcolor") || "#d4eaf7";
    document.documentElement.style.setProperty('--theme-color', color);
    loadChatHistory();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  async function loadChatHistory() {
    try {
      const { data, error } = await supabase
        .from('chat_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChatHistory(data || []);
    } catch (error) {
      console.error('Error loading chat history:', error);
    } finally {
      setChatLoading(false);
    }
  }

  async function deleteHistoryItem(id: string) {
    try {
      const { error } = await supabase
        .from('chat_history')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setChatHistory(prev => prev.filter(item => item.id !== id));
      toast.success('Chat entry removed from history');
    } catch (error) {
      console.error('Error deleting chat history:', error);
      toast.error('Failed to delete chat entry');
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Text copied to clipboard');
  }

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
              <Link to="/chat" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Chat
              </Link>
            </Button>
            <Button variant="ghost" asChild size="sm"
                    className="text-[hsl(var(--parchment))] hover:bg-white/10">
              <Link to="/" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Dashboard
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-[hsl(var(--gold))]" />
              <span className="text-xl font-bold text-[hsl(var(--parchment))]" 
                    style={{ fontFamily: 'Georgia, serif' }}>
                AI Conversation Archive
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}
                  className="text-[hsl(var(--parchment))] hover:bg-white/10">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <Card className="border-2 border-[hsl(var(--brass))] shadow-xl bg-[hsl(var(--card))]">
          <CardHeader className="border-b border-[hsl(var(--border))]">
            <CardTitle className="flex items-center gap-2 text-2xl" style={{ fontFamily: 'Georgia, serif' }}>
              <MessageSquare className="w-6 h-6 text-[hsl(var(--brass))]" />
              Your Historical Inquiries
            </CardTitle>
            <CardDescription className="italic">
              View and manage your past conversations with the historian (Future: FAQ generation)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {chatLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading conversation history...
              </div>
            ) : chatHistory.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="text-muted-foreground italic">No conversations recorded yet</p>
                <Button variant="outline" asChild>
                  <Link to="/chat">Start a conversation with the historian</Link>
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {chatHistory.map((item) => (
                    <Card key={item.id} className="border-border/50 bg-muted/20">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(item.created_at).toLocaleString()}
                            </div>
                            <CardTitle className="text-base font-semibold text-foreground font-serif">
                              📜 {item.question}
                            </CardTitle>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(item.answer, item.id)}
                              title="Copy answer"
                            >
                              {copiedId === item.id ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteHistoryItem(item.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Delete entry"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-card/50 rounded-lg p-4 border border-border/50">
                          <p className="text-sm font-medium text-primary mb-2 font-serif">📖 Answer:</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-serif">
                            {item.answer}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChatHistory;
