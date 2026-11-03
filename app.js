(function() {
  const SUPABASE_URL = 'https://ufzfrhezueypxauppkwy.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmemZyaGV6dWV5cHhhdXBwa3d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyMzg2Mzh9.EXAMPLE_KEY_REPLACE_WITH_FULL_KEY'; 
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Define updateAuthUI inside the safe IIFE scope
  function updateAuthUI(session) {
    const guestView = document.getElementById('guest-view');
    const userView = document.getElementById('user-view');
    const userEmailTag = document.getElementById('userEmailTag');

    if (session) {
      if (guestView) guestView.style.display = 'none';
      if (userView) userView.style.display = 'inline-flex';
      if (userEmailTag) userEmailTag.textContent = session.user.email;
    } else {
      if (guestView) guestView.style.display = 'inline-flex';
      if (userView) userView.style.display = 'none';
    }
  }

  // Listen to Supabase auth state changes safely
  supabase.auth.onAuthStateChange((_event, session) => {
    updateAuthUI(session);
  });

  // Activities data structure
  const activities = {
    Curious: [
      { type: "QUICK TRIVIA", symbol: "*", title: "A little knowledge goes a long way", description: "Try a quick question and see what you know.", question: "Which planet is known for its prominent ring system?" },
      { type: "EVERYDAY KNOWLEDGE", symbol: "~", title: "Think about the everyday", description: "A small question about the world around us.", question: "Which material is commonly used to make traditional coffee filters?" }
    ],
    Playful: [
      { type: "BRAIN GAME", symbol: "@", title: "Word detective", description: "A tiny riddle to warm up your thinking.", question: "What has keys but cannot open locks?", answers: ["A piano", "A map"] },
      { type: "QUICK RIDDLE", symbol: "?", title: "One for your brain", description: "Take a moment and think it through.", question: "What gets wetter the more it dries?", answers: ["A towel", "A sponge"] }
    ],
    Creative: [
      { type: "CREATIVE CHALLENGE", symbol: "\\", title: "One-minute creator", description: "There is more than one right way to imagine.", question: "Invent a new use for an empty glass bottle." },
      { type: "IMAGINATION PROMPT", symbol: "<>", title: "Make something from nothing", description: "A small creative exercise for an ordinary day.", question: "If you could redesign one everyday object..." }
    ],
    Social: [
      { type: "COMMUNITY ACTIVITY", symbol: "@", title: "Two perspectives", description: "A friendly question to compare different points of view.", question: "What makes a perfect weekend?" }
    ]
  };

  // Document Ready Initialization
  document.addEventListener('DOMContentLoaded', () => {
    // Check initial session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      updateAuthUI(session);
    });

    // Add any additional UI bindings or event listeners here
  });

})();
