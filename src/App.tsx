import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginGate from "./components/LoginGate";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import TellMe from "./pages/TellMe";
import ProveIt from "./pages/ProveIt";
import Profile from "./pages/Profile";
import Preferences from "./pages/Preferences";
import MakeIt from "./pages/MakeIt";
import ChatWithMe from "./pages/ChatWithMe";
import ChatHistory from "./pages/ChatHistory";
import Ekko from "./pages/Ekko";
import History from "./pages/History";
import ViewPoster from "./pages/ViewPoster";
import FamilyTree from "./pages/FamilyTree";
import AdminIngest from "./pages/AdminIngest";
import OverlayCreator from "./pages/OverlayCreator";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile" element={<LoginGate><Profile /></LoginGate>} />
          <Route path="/preferences" element={<LoginGate><Preferences /></LoginGate>} />
          <Route path="/make-it" element={<MakeIt />} />
          <Route path="/tell-me" element={<TellMe />} />
          <Route path="/history" element={<LoginGate><History /></LoginGate>} />
          <Route path="/history/view" element={<LoginGate><ViewPoster /></LoginGate>} />
          <Route path="/admin/ingest" element={<LoginGate><AdminIngest /></LoginGate>} />
          <Route path="/overlay-creator" element={<LoginGate><OverlayCreator /></LoginGate>} />
          <Route path="/chat" element={<ChatWithMe />} />
          <Route path="/chat-history" element={<LoginGate><ChatHistory /></LoginGate>} />
          <Route path="/prove-it" element={<ProveIt />} />
          <Route path="/ekko" element={<Ekko />} />
          <Route path="/family-tree" element={<FamilyTree />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
