(function () {
  const SUPABASE_URL = 'https://wyfzcbqmrultttncnenb.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5ZnpjYnFtcnVsdHR0bmNuZW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MDA5MTUsImV4cCI6MjEwOTI3NjkxNX0.c33pupDQsZeeBJuC_DUHQ9GXJoJc7Lo2Mwr5WBEfjPU';

  if (!window.supabase) {
    console.error("Supabase is not loaded. Check the Supabase script tag.");
    return;
  }

  const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  function initializeApp() {
    // Helper selector
    const $ = id => document.getElementById(id);

    let mood = "Curious";
    let activityIndex = 0;
    let completed = Number(localStorage.getItem("everydayCompleted") || 0);
    let currentUser = null;
    let deferredInstall = null;

    // DOM elements
    const guestView = $('guest-view');
    const userView = $('user-view');
    const userEmailTag = $('userEmailTag');
    const openAuthModalBtn = $('openAuthModal');
    const closeAuthModalBtn = $('closeAuthModal');
    const authModal = $('authModal');
    const logoutBtn = $('logoutBtn');
    const streakNotice = $('streakNotice');
    const magicLinkForm = $('magicLinkForm');
    const authEmailInput = $('authEmailInput');
    const authStatusMessage = $('authStatusMessage');

    // Activities
    const activities = {
      Curious: [
        {
          type: "QUICK TRIVIA",
          symbol: "✳",
          title: "A little knowledge goes a long way",
          description: "Try a quick question and see what you know.",
          question: "Which planet is known for its prominent rings?",
          answers: ["Earth", "Saturn", "Mars", "Venus"],
          correct: "Saturn",
          explain: "Saturn is famous for its extensive ring system."
        },
        {
          type: "EVERYDAY KNOWLEDGE",
          symbol: "⌁",
          title: "Think about the everyday",
          description: "A small question about the world around us.",
          question: "Which material is commonly used to make traditional glass?",
          answers: ["Sand (silica)", "Wood", "Cotton", "Clay only"],
          correct: "Sand (silica)",
          explain: "Silica, often sourced from sand, is a primary ingredient in ordinary glass."
        }
      ],

      Playful: [
        {
          type: "BRAIN GAME",
          symbol: "◉",
          title: "Word detective",
          description: "A tiny riddle to warm up your thinking.",
          question: "What has keys but cannot open locks?",
          answers: ["A piano", "A map", "A door", "A clock"],
          correct: "A piano",
          explain: "A piano has musical keys, not door keys."
        },
        {
          type: "QUICK RIDDLE",
          symbol: "?",
          title: "One for your brain",
          description: "Take a moment and think it through.",
          question: "What gets wetter the more it dries?",
          answers: ["A towel", "A sponge", "Rain", "A cloud"],
          correct: "A towel",
          explain: "A towel absorbs water as it dries something else."
        }
      ],

      Creative: [
        {
          type: "CREATIVE CHALLENGE",
          symbol: "✎",
          title: "One-minute creator",
          description: "There is more than one right way to imagine.",
          question: "Invent a new use for an empty glass bottle.",
          answers: ["A miniature garden", "A desk organizer", "A lamp", "All of these"],
          correct: "All of these",
          explain: "Creativity is about seeing possibilities. All are valid ideas!"
        },
        {
          type: "IMAGINATION PROMPT",
          symbol: "✧",
          title: "Make something from nothing",
          description: "A small creative exercise for an ordinary day.",
          question: "If you could redesign one everyday object, what would you choose?",
          answers: ["A backpack", "A water bottle", "A chair", "A kitchen tool"],
          correct: null,
          explain: "There is no wrong answer. Pick one and imagine how you would improve it."
        }
      ],

      Social: [
        {
          type: "COMMUNITY ACTIVITY",
          symbol: "◎",
          title: "Two perspectives",
          description: "A friendly question to compare different points of view.",
          question: "What makes a perfect weekend?",
          answers: ["Adventure", "Rest and relaxation", "Learning something new", "Spending time with people"],
          correct: null,
          explain: "Everyone has a different idea of a good weekend. Share yours with someone!"
        },
        {
          type: "CONVERSATION STARTER",
          symbol: "♡",
          title: "Find common ground",
          description: "A question you can ask a friend or a new acquaintance.",
          question: "What is something you would love to learn?",
          answers: ["A language", "A creative skill", "A practical skill", "Something completely new"],
          correct: null,
          explain: "Use this as a conversation starter. You might discover a shared interest."
        }
      ],

      Productive: [
        {
          type: "LIFE CHALLENGE",
          symbol: "↗",
          title: "The ten-minute reset",
          description: "A tiny action can make the day feel lighter.",
          question: "Choose one small task you can finish in ten minutes.",
          answers: ["Organize my space", "Plan tomorrow", "Clear my inbox", "Learn one useful skill"],
          correct: null,
          explain: "Choose one action and give it ten focused minutes."
        },
        {
          type: "SMALL STEP",
          symbol: "✓",
          title: "Make tomorrow easier",
          description: "Do one small thing now for your future self.",
          question: "What would help you tomorrow?",
          answers: ["Prepare what I need", "Write a short plan", "Tidy one area", "Set a reminder"],
          correct: null,
          explain: "Small preparation can make tomorrow feel more manageable."
        }
      ],

      Relaxed: [
        {
          type: "MINI RESET",
          symbol: "☼",
          title: "A moment of calm",
          description: "Pause for a moment and check in with yourself.",
          question: "What would help you feel refreshed right now?",
          answers: ["A little quiet", "A short walk", "Some music", "A glass of water"],
          correct: null,
          explain: "Choose what feels helpful for you. A short pause counts."
        },
        {
          type: "GENTLE PROMPT",
          symbol: "☁",
          title: "Notice the little things",
          description: "A gentle reminder to slow down for a moment.",
          question: "Which small moment would you like more of?",
          answers: ["A quiet morning", "A good conversation", "Time outdoors", "A creative break"],
          correct: null,
          explain: "Noticing what restores you can help you make room for it."
        }
      ]
    };

    // Daily thoughts
    const thoughts = [
      "Curiosity is a good place to begin.",
      "Small progress is still progress.",
      "A new perspective can start with one good question.",
      "You don't have to do everything today.",
      "There is always something new to notice.",
      "Make room for a little wonder."
    ];

    // Check authentication session
    async function checkSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        updateAuthUI(data.session);
      } catch (error) {
        console.error("Unable to check the current session:", error);
        updateAuthUI(null);
      }
    }

    // Update authentication interface
    function updateAuthUI(session) {
      if (session) {
        currentUser = session.user;

        if (guestView) guestView.style.display = 'none';
        if (userView) userView.style.display = 'flex';

        if (userEmailTag) {
          userEmailTag.textContent = currentUser.email || '';
        }

        if (streakNotice) {
          streakNotice.textContent = 'Your everyday activity is synced to your account.';
        }

        if (authModal && authModal.open) {
          authModal.close();
        }

        syncUserCloudData();

      } else {
        currentUser = null;

        if (guestView) guestView.style.display = 'flex';
        if (userView) userView.style.display = 'none';

        if (streakNotice) {
          streakNotice.textContent = 'Your completed activities stay on this device in guest mode.';
        }
      }
    }

    // Synchronize user data with Supabase
    async function syncUserCloudData() {
      if (!currentUser) return;

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('completed_count')
          .eq('id', currentUser.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data && data.completed_count > completed) {
          completed = data.completed_count;

          localStorage.setItem(
            "everydayCompleted",
            String(completed)
          );

          if ($("completedCount")) {
            $("completedCount").textContent = completed;
          }

        } else {
          const { error: upsertError } = await supabase
            .from('user_profiles')
            .upsert({
              id: currentUser.id,
              completed_count: completed
            });

          if (upsertError) throw upsertError;
        }

      } catch (error) {
        console.error("Unable to synchronize user data:", error);
      }
    }

    // Magic link authentication
    if (magicLinkForm) {
      magicLinkForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = authEmailInput
          ? authEmailInput.value.trim()
          : '';

        if (!email) return;

        if (authStatusMessage) {
          authStatusMessage.style.display = 'block';
          authStatusMessage.textContent = 'Sending magic link...';
          authStatusMessage.style.color = '';
        }

        try {
          const { error } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
              emailRedirectTo: window.location.origin
            }
          });

          if (error) throw error;

          if (authStatusMessage) {
            authStatusMessage.textContent =
              '✨ Check your email! We sent you a magic login link.';
            authStatusMessage.style.color = '#10b981';
          }

          if (authEmailInput) {
            authEmailInput.value = '';
          }

        } catch (error) {
          if (authStatusMessage) {
            authStatusMessage.textContent = `Error: ${error.message}`;
            authStatusMessage.style.color = '#ef4444';
          }

          console.error("Authentication error:", error);
        }
      });
    }

    // Logout
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          const { error } = await supabase.auth.signOut();

          if (error) throw error;

          window.location.reload();

        } catch (error) {
          console.error("Logout error:", error);
        }
      });
    }

    // Listen for authentication changes
    supabase.auth.onAuthStateChange((_event, session) => {
      updateAuthUI(session);
    });

    // Authentication modal
    if (openAuthModalBtn && authModal) {
      openAuthModalBtn.addEventListener('click', () => {
        authModal.showModal();
      });
    }

    if (closeAuthModalBtn && authModal) {
      closeAuthModalBtn.addEventListener('click', () => {
        authModal.close();
      });
    }

    // Get current activity
    function currentActivity() {
      const list = activities[mood] || activities.Curious;
      return list[activityIndex % list.length];
    }

    // Render activity
    function renderActivity() {
      const a = currentActivity();

      if ($("activityType")) {
        $("activityType").textContent = a.type;
      }

      if ($("activitySymbol")) {
        $("activitySymbol").textContent = a.symbol;
      }

      if ($("activityTitle")) {
        $("activityTitle").textContent = a.title;
      }

      if ($("activityDescription")) {
        $("activityDescription").textContent = a.description;
      }

      if ($("activityQuestion")) {
        $("activityQuestion").textContent = a.question;
      }

      if ($("answerFeedback")) {
        $("answerFeedback").textContent = "";
      }

      if ($("progressText")) {
        $("progressText").textContent = "A small moment for yourself";
      }

      const answerList = $("answerList");

      if (!answerList) return;

      answerList.innerHTML = "";

      a.answers.forEach(answer => {
        const button = document.createElement("button");

        button.className = "answer";
        button.textContent = answer;
        button.type = "button";

        button.addEventListener("click", () => {
          [...answerList.children].forEach(item => {
            item.disabled = true;
            item.classList.remove("selected");
          });

          button.classList.add("selected");

          if (a.correct === null) {
            if ($("answerFeedback")) {
              $("answerFeedback").textContent = a.explain;
            }

            completeActivity();

          } else if (answer === a.correct) {
            button.classList.add("correct");

            if ($("answerFeedback")) {
              $("answerFeedback").textContent =
                "That's right! " + a.explain;
            }

            completeActivity();

          } else {
            button.classList.add("wrong");

            if ($("answerFeedback")) {
              $("answerFeedback").textContent =
                "Good try. " + a.explain;
            }
          }
        });

        answerList.appendChild(button);
      });
    }

    // Complete activity
    function completeActivity() {
      completed++;

      localStorage.setItem(
        "everydayCompleted",
        String(completed)
      );

      if ($("completedCount")) {
        $("completedCount").textContent = completed;
      }

      if ($("progressText")) {
        $("progressText").textContent = "Completed — nice work!";
      }

      if (currentUser) {
        supabase
          .from('user_profiles')
          .upsert({
            id: currentUser.id,
            completed_count: completed
          })
          .then(({ error }) => {
            if (error) {
              console.error(
                "Unable to sync completed activities:",
                error
              );
            }
          });
      }
    }

    // Change mood
    function setMood(next) {
      if (!activities[next]) return;

      mood = next;
      activityIndex = 0;

      document.querySelectorAll(".mood").forEach(button => {
        button.classList.toggle(
          "active",
          button.dataset.mood === mood
        );
      });

      renderActivity();
    }

    document.querySelectorAll(".mood").forEach(button => {
      button.addEventListener("click", () => {
        setMood(button.dataset.mood);
      });
    });

    // Next activity
    const nextBtn = $("nextActivity");

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        activityIndex++;
        renderActivity();
      });
    }

    // Surprise activity
    const surpriseBtn = $("surpriseButton");

    if (surpriseBtn) {
      surpriseBtn.addEventListener("click", () => {
        const moods = Object.keys(activities).filter(
          item => item !== mood
        );

        const randomMood = moods[
          Math.floor(Math.random() * moods.length)
        ];

        setMood(randomMood);
      });
    }

    // Generate a new daily thought
    const newThoughtBtn = $("newThought");

    if (newThoughtBtn) {
      newThoughtBtn.addEventListener("click", () => {
        const next = thoughts[
          Math.floor(Math.random() * thoughts.length)
        ];

        if ($("dailyThought")) {
          $("dailyThought").textContent = next;
        }
      });
    }

    // Display completed activities
    if ($("completedCount")) {
      $("completedCount").textContent = completed;
    }

    // Community thought form
    const thoughtForm = $("thoughtForm");

    if (thoughtForm) {
      thoughtForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const input = $("thoughtInput");

        if (!input) return;

        const value = input.value.trim();

        if (!value) return;

        const authorName = currentUser && currentUser.email
          ? currentUser.email.split('@')[0]
          : "You";

        try {
          const saved = JSON.parse(
            localStorage.getItem("everydayThoughts") || "[]"
          );

          saved.unshift({
            text: value,
            author: authorName,
            date: new Date().toISOString()
          });

          localStorage.setItem(
            "everydayThoughts",
            JSON.stringify(saved.slice(0, 10))
          );

          addWallItem(
            value,
            authorName.charAt(0).toUpperCase(),
            authorName
          );

          input.value = "";

          if (currentUser) {
            const { error } = await supabase
              .from('community_thoughts')
              .insert([{
                user_id: currentUser.id,
                text: value,
                author: authorName
              }]);

            if (error) throw error;

            if ($("answerFeedback")) {
              $("answerFeedback").textContent =
                "Your thought has been shared to the community wall!";
            }

          } else {
            if ($("answerFeedback")) {
              $("answerFeedback").textContent =
                "Your thought has been saved on this device.";
            }
          }

        } catch (error) {
          console.error("Unable to save community thought:", error);

          if ($("answerFeedback")) {
            $("answerFeedback").textContent =
              "There was a problem saving your thought.";
          }
        }
      });
    }

    // Add community wall item
    function addWallItem(text, letter, name = "You") {
      const communityWall = $("communityWall");

      if (!communityWall) return;

      const row = document.createElement("div");
      row.className = "wall-item";

      const avatar = document.createElement("span");
      avatar.className = "avatar";
      avatar.textContent = letter;

      const paragraph = document.createElement("p");

      const strong = document.createElement("strong");
      strong.textContent = name;

      const message = document.createElement("span");
      message.className = "muted";
      message.textContent = text;

      paragraph.append(
        strong,
        document.createElement("br"),
        message
      );

      row.append(avatar, paragraph);

      communityWall.prepend(row);
    }

    // Load saved community thoughts
    try {
      const savedThoughts = JSON.parse(
        localStorage.getItem("everydayThoughts") || "[]"
      );

      savedThoughts.forEach(item => {
        addWallItem(
          item.text,
          item.author
            ? item.author.charAt(0).toUpperCase()
            : "Y",
          item.author || "You"
        );
      });

    } catch (error) {
      console.error("Unable to load saved thoughts:", error);
    }

    // PWA installation prompt
    window.addEventListener("beforeinstallprompt", e => {
      e.preventDefault();

      deferredInstall = e;

      if ($("installButton")) {
        $("installButton").hidden = false;
      }
    });

    const installBtn = $("installButton");

    if (installBtn) {
      installBtn.addEventListener("click", async () => {
        if (!deferredInstall) return;

        deferredInstall.prompt();

        await deferredInstall.userChoice;

        deferredInstall = null;
        installBtn.hidden = true;
      });
    }

    // Initialize application
    checkSession();
    renderActivity();

    // Register service worker
    if (
      "serviceWorker" in navigator &&
      (
        location.protocol === "https:" ||
        location.hostname === "localhost"
      )
    ) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("./service-worker.js")
          .catch(error => {
            console.error("Service worker registration failed:", error);
          });
      });
    }
  }

  // Wait until the DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeApp,
      { once: true }
    );
  } else {
    initializeApp();
  }
})();
