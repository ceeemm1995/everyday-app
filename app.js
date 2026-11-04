(() => {
  "use strict";

  // =====================================
  // EVERYDAY — APP.JS
  // Version 0.2
  // =====================================

  // =====================================
  // SUPABASE CONFIGURATION
  // =====================================

  const SUPABASE_URL =
    "https://wyfzcbqmrultttncnenb.supabase.co";

  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhbGciOiJIUzI1NiIsInJlZiI6Ind5ZnpjYnFtcnVsdHR0bmNuZW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MDA5MTUsImV4cCI6MjEwOTI3NjkxNX0.c33pupDQsZeeBJuC_DUHQ9GXJoJc7Lo2Mwr5WBEfjPU";

  if (!window.supabase) {
    console.error("Supabase library did not load.");
    return;
  }

  const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  // =====================================
  // HELPERS
  // =====================================

  const $ = id => document.getElementById(id);

  const readLocal = (key, fallback = []) => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };

  const writeLocal = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const showStatus = (id, message, type = "info") => {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.style.display = "block";

    const colors = {
      success: "#a879f5",
      error: "#ef7777",
      info: "#b9aecb"
    };

    element.style.color = colors[type] || colors.info;
  };

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
  };

  const formatDate = date => {
    if (!date) return "";

    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  let mood = "Curious";
  let activityIndex = 0;

  let completed = Number(
    localStorage.getItem("everydayCompleted") || 0
  );

  let currentUser = null;
  let currentNickname = "Everyday member";
  let deferredInstall = null;

  // =====================================
  // DOM ELEMENTS
  // =====================================

  const guestView = $("guest-view");
  const userView = $("user-view");
  const userEmailTag = $("userEmailTag");

  const openAuthModalBtn = $("openAuthModal");
  const closeAuthModalBtn = $("closeAuthModal");
  const authModal = $("authModal");

  const logoutBtn = $("logoutBtn");
  const streakNotice = $("streakNotice");

  const magicLinkForm = $("magicLinkForm");
  const authEmailInput = $("authEmailInput");
  const authStatusMessage = $("authStatusMessage");

  // =====================================
  // ACTIVITIES
  // =====================================

  const activities = {
    Curious: [
      {
        type: "QUICK TRIVIA",
        symbol: "⌕",
        title: "A little knowledge goes a long way",
        description: "Try a quick question and see what you know.",
        question: "Which planet is known for its prominent rings?",
        answers: ["Earth", "Saturn", "Mars", "Venus"],
        correct: "Saturn",
        explain: "Saturn is famous for its extensive ring system."
      },
      {
        type: "EVERYDAY KNOWLEDGE",
        symbol: "⌕",
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
        answers: [
          "A miniature garden",
          "A desk organizer",
          "A lamp",
          "All of these"
        ],
        correct: "All of these",
        explain: "Creativity is about seeing possibilities. All are valid ideas!"
      },
      {
        type: "IMAGINATION PROMPT",
        symbol: "✧",
        title: "Make something from nothing",
        description: "A small creative exercise for an ordinary day.",
        question: "If you could redesign one everyday object, what would you choose?",
        answers: [
          "A backpack",
          "A water bottle",
          "A chair",
          "A kitchen tool"
        ],
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
        answers: [
          "Adventure",
          "Rest and relaxation",
          "Learning something new",
          "Spending time with people"
        ],
        correct: null,
        explain: "Everyone has a different idea of a good weekend. Share yours with someone!"
      },
      {
        type: "CONVERSATION STARTER",
        symbol: "♡",
        title: "Find common ground",
        description: "A question you can ask a friend or a new acquaintance.",
        question: "What is something you would love to learn?",
        answers: [
          "A language",
          "A creative skill",
          "A practical skill",
          "Something completely new"
        ],
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
        answers: [
          "Organize my space",
          "Plan tomorrow",
          "Clear my inbox",
          "Learn one useful skill"
        ],
        correct: null,
        explain: "Choose one action and give it ten focused minutes."
      },
      {
        type: "SMALL STEP",
        symbol: "✓",
        title: "Make tomorrow easier",
        description: "Do one small thing now for your future self.",
        question: "What would help you tomorrow?",
        answers: [
          "Prepare what I need",
          "Write a short plan",
          "Tidy one area",
          "Set a reminder"
        ],
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
        answers: [
          "A little quiet",
          "A short walk",
          "Some music",
          "A glass of water"
        ],
        correct: null,
        explain: "Choose what feels helpful for you. A short pause counts."
      },
      {
        type: "GENTLE PROMPT",
        symbol: "☁",
        title: "Notice the little things",
        description: "A gentle reminder to slow down for a moment.",
        question: "Which small moment would you like more of?",
        answers: [
          "A quiet morning",
          "A good conversation",
          "Time outdoors",
          "A creative break"
        ],
        correct: null,
        explain: "Noticing what restores you can help you make room for it."
      }
    ]
  };

  // =====================================
  // DAILY THOUGHTS
  // =====================================

  const thoughts = [
    "Curiosity is a good place to begin.",
    "Small progress is still progress.",
    "A new perspective can start with one good question.",
    "You don't have to do everything today.",
    "There is always something new to notice.",
    "Make room for a little wonder."
  ];

  // =====================================
  // AUTHENTICATION
  // =====================================

  async function checkSession() {
    try {
      const {
        data: { session },
        error
      } = await supabase.auth.getSession();

      if (error) throw error;

      updateAuthUI(session);
    } catch (error) {
      console.error("Session error:", error);
    }
  }

  function updateAuthUI(session) {
    const nextUser = session?.user || null;
    const previousUserId = currentUser?.id || null;
    const nextUserId = nextUser?.id || null;

    currentUser = nextUser;

    if (currentUser) {
      if (guestView) guestView.style.display = "none";
      if (userView) userView.style.display = "flex";

      if (userEmailTag) {
        userEmailTag.textContent = "My account";
      }

      if (streakNotice) {
        streakNotice.textContent =
          "Your everyday activity is synced to your account.";
      }

      if (authModal?.open) authModal.close();

      if (previousUserId !== nextUserId) {
        loadAccountData();
      }
    } else {
      currentNickname = "Everyday member";

      if (guestView) guestView.style.display = "flex";
      if (userView) userView.style.display = "none";

      if (streakNotice) {
        streakNotice.textContent =
          "Your completed activities stay on this device in guest mode.";
      }

      if (previousUserId) {
        clearAccountDisplays();
      }
    }
  }

  async function loadAccountData() {
    if (!currentUser) return;

    await syncUserCloudData();
    await loadProfile();
    await loadJournalEntries();
    await loadGoalCircles();
    await loadSavedDiscoveries();
    await migrateGuestDiscoveries();
  }

  function clearAccountDisplays() {
    [
      "journalEntries",
      "goalCircles",
      "savedDiscoveries"
    ].forEach(id => {
      const element = $(id);
      if (element) element.replaceChildren();
    });

    const nicknameInput = $("nicknameInput");
    const bioInput = $("profileBioInput");

    if (nicknameInput) nicknameInput.value = "";
    if (bioInput) bioInput.value = "";
  }

  // =====================================
  // ACTIVITY PROGRESS SYNC
  // =====================================

  async function syncUserCloudData() {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("completed_count")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (error) throw error;

      if (data && Number(data.completed_count) > completed) {
        completed = Number(data.completed_count);

        localStorage.setItem(
          "everydayCompleted",
          String(completed)
        );

        if ($("completedCount")) {
          $("completedCount").textContent = completed;
        }
      } else if (!data) {
        const { error: saveError } = await supabase
          .from("user_profiles")
          .upsert({
            id: currentUser.id,
            completed_count: completed
          });

        if (saveError) throw saveError;
      }
    } catch (error) {
      console.error("Cloud progress sync error:", error);
    }
  }

  // =====================================
  // LOGIN MODAL
  // =====================================

  if (openAuthModalBtn && authModal) {
    openAuthModalBtn.addEventListener("click", event => {
      event.preventDefault();

      if (!authModal.open) authModal.showModal();
    });
  }

  if (closeAuthModalBtn && authModal) {
    closeAuthModalBtn.addEventListener("click", () => {
      authModal.close();
    });
  }

  if (authModal) {
    authModal.addEventListener("click", event => {
      if (event.target === authModal) authModal.close();
    });
  }

  // =====================================
  // MAGIC LINK LOGIN
  // =====================================

  if (magicLinkForm) {
    magicLinkForm.addEventListener("submit", async event => {
      event.preventDefault();

      const email = authEmailInput?.value.trim() || "";
      if (!email) return;

      showStatus(
        "authStatusMessage",
        "Sending magic link...",
        "info"
      );

      const submitButton = magicLinkForm.querySelector(
        'button[type="submit"]'
      );

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
      }

      try {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin
          }
        });

        if (error) throw error;

        showStatus(
          "authStatusMessage",
          "✨ Check your email! We sent you a magic login link.",
          "success"
        );

        if (authEmailInput) authEmailInput.value = "";
      } catch (error) {
        console.error("Login error:", error);

        showStatus(
          "authStatusMessage",
          "Error: " + error.message,
          "error"
        );
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Send Magic Link";
        }
      }
    });
  }

  // =====================================
  // LOGOUT
  // =====================================

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.reload();
      } catch (error) {
        console.error("Logout error:", error);
      }
    });
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    updateAuthUI(session);
  });

  // =====================================
  // PROFILE
  // =====================================

  async function loadProfile() {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("nickname, bio")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (error) throw error;

      currentNickname =
        data?.nickname?.trim() ||
        "Everyday member";

      if ($("nicknameInput")) {
        $("nicknameInput").value = data?.nickname || "";
      }

      if ($("profileBioInput")) {
        $("profileBioInput").value = data?.bio || "";
      }

      renderProfileIdentity();
    } catch (error) {
      console.error("Profile loading error:", error);
      showStatus("profileStatus", "Could not load your profile.", "error");
    }
  }

  function renderProfileIdentity() {
    const nicknameDisplay = $("profileNickname");
    const bioDisplay = $("profileBio");

    if (nicknameDisplay) {
      nicknameDisplay.textContent = currentNickname;
    }

    if (bioDisplay && !bioDisplay.textContent.trim()) {
      bioDisplay.textContent = "A little space to introduce yourself.";
    }
  }

  const profileForm = $("profileForm");

  if (profileForm) {
    profileForm.addEventListener("submit", async event => {
      event.preventDefault();

      if (!currentUser) {
        showStatus(
          "profileStatus",
          "Please sign in to save your profile.",
          "error"
        );
        return;
      }

      const nickname = $("nicknameInput")?.value.trim() || "";
      const bio = $("profileBioInput")?.value.trim() || "";

      if (!nickname) {
        showStatus(
          "profileStatus",
          "Please choose a nickname.",
          "error"
        );
        return;
      }

      try {
        const { error } = await supabase
          .from("user_profiles")
          .upsert({
            id: currentUser.id,
            nickname,
            bio,
            completed_count: completed,
            updated_at: new Date().toISOString()
          });

        if (error) throw error;

        currentNickname = nickname;
        renderProfileIdentity();

        showStatus(
          "profileStatus",
          "Your profile has been saved!",
          "success"
        );
      } catch (error) {
        console.error("Profile save error:", error);

        showStatus(
          "profileStatus",
          "Could not save your profile: " + error.message,
          "error"
        );
      }
    });
  }

  // =====================================
  // JOURNAL ENTRIES
  // =====================================

  async function loadJournalEntries() {
    if (!currentUser) return;

    const container = $("journalEntries");
    if (!container) return;

    try {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      renderJournalEntries(data || []);
    } catch (error) {
      console.error("Journal loading error:", error);
      showStatus(
        "journalStatus",
        "Could not load your journal entries.",
        "error"
      );
    }
  }

  function renderJournalEntries(entries) {
    const container = $("journalEntries");
    if (!container) return;

    container.replaceChildren();

    if (!entries.length) {
      container.appendChild(
        createElement(
          "p",
          "muted",
          "Your journal is waiting for its first entry."
        )
      );
      return;
    }

    entries.forEach(entry => {
      const card = createElement("article", "journal-entry-card");

      const heading = createElement("h4", "", entry.title);
      const date = createElement(
        "small",
        "muted",
        formatDate(entry.created_at)
      );

      const content = createElement("p", "", entry.content);
      const visibility = createElement(
        "span",
        "privacy-tag",
        entry.visibility === "shared" ? "Shared" : "Private"
      );

      const deleteButton = createElement(
        "button",
        "delete-entry-button",
        "Delete"
      );

      deleteButton.type = "button";
      deleteButton.addEventListener("click", () => {
        deleteJournalEntry(entry.id);
      });

      card.append(
        heading,
        date,
        visibility,
        content,
        deleteButton
      );

      container.appendChild(card);
    });
  }

  const journalForm = $("journalForm");

  if (journalForm) {
    journalForm.addEventListener("submit", async event => {
      event.preventDefault();

      if (!currentUser) {
        showStatus(
          "journalStatus",
          "Please sign in to save journal entries.",
          "error"
        );
        return;
      }

      const title = $("journalTitle")?.value.trim() || "";
      const content = $("journalInput")?.value.trim() || "";
      const visibility = $("journalPrivacy")?.value || "private";

      if (!title || !content) {
        showStatus(
          "journalStatus",
          "Please add a title and journal entry.",
          "error"
        );
        return;
      }

      if (!["private", "shared"].includes(visibility)) {
        showStatus(
          "journalStatus",
          "Please select a valid privacy setting.",
          "error"
        );
        return;
      }

      try {
        const { error } = await supabase
          .from("journal_entries")
          .insert({
            user_id: currentUser.id,
            title,
            content,
            visibility,
            author_nickname: currentNickname
          });

        if (error) throw error;

        journalForm.reset();
        await loadJournalEntries();

        showStatus(
          "journalStatus",
          visibility === "shared"
            ? "Your journal entry has been shared."
            : "Your private journal entry has been saved.",
          "success"
        );
      } catch (error) {
        console.error("Journal save error:", error);

        showStatus(
          "journalStatus",
          "Could not save your journal: " + error.message,
          "error"
        );
      }
    });
  }

  async function deleteJournalEntry(id) {
    if (!currentUser) return;

    if (!window.confirm("Delete this journal entry?")) return;

    try {
      const { error } = await supabase
        .from("journal_entries")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUser.id);

      if (error) throw error;

      await loadJournalEntries();

      showStatus(
        "journalStatus",
        "Journal entry deleted.",
        "success"
      );
    } catch (error) {
      console.error("Journal delete error:", error);
      showStatus("journalStatus", "Could not delete the entry.", "error");
    }
  }

  // =====================================
  // GOAL CIRCLES
  // =====================================

  async function loadGoalCircles() {
    if (!currentUser) return;

    try {
      // RLS returns the user's own goals and shared goals.
      const { data, error } = await supabase
        .from("goal_circles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      renderGoalCircles(data || []);
    } catch (error) {
      console.error("Goal loading error:", error);
      showStatus("goalStatus", "Could not load Goal Circles.", "error");
    }
  }

  function renderGoalCircles(goals) {
    const container = $("goalCircles");
    if (!container) return;

    container.replaceChildren();

    if (!goals.length) {
      container.appendChild(
        createElement(
          "p",
          "muted",
          "Your first small goal can begin here."
        )
      );
      return;
    }

    goals.forEach(goal => {
      const card = createElement("article", "goal-circle-card");

      const title = createElement("h4", "", goal.title);
      const description = createElement(
        "p",
        "",
        goal.description || "A new goal begins with one small step."
      );

      const owner = createElement(
        "small",
        "muted",
        goal.user_id === currentUser.id
          ? "Your goal"
          : "By " + (goal.owner_nickname || "Everyday member")
      );

      const privacy = createElement(
        "span",
        "privacy-tag",
        goal.visibility === "shared" ? "Shared" : "Private"
      );

      card.append(title, description, owner, privacy);

      if (goal.user_id === currentUser.id) {
        const deleteButton = createElement(
          "button",
          "delete-entry-button",
          "Delete"
        );

        deleteButton.type = "button";
        deleteButton.addEventListener("click", () => {
          deleteGoalCircle(goal.id);
        });

        card.appendChild(deleteButton);
      }

      container.appendChild(card);
    });
  }

  const goalForm = $("goalForm");

  if (goalForm) {
    goalForm.addEventListener("submit", async event => {
      event.preventDefault();

      if (!currentUser) {
        showStatus(
          "goalStatus",
          "Please sign in to save your goals.",
          "error"
        );
        return;
      }

      const title = $("goalTitle")?.value.trim() || "";
      const description =
        $("goalDescription")?.value.trim() || "";

      const visibility = $("goalPrivacy")?.value || "private";

      if (!title) {
        showStatus(
          "goalStatus",
          "Please give your goal a title.",
          "error"
        );
        return;
      }

      if (!["private", "shared"].includes(visibility)) {
        showStatus(
          "goalStatus",
          "Please select a valid privacy setting.",
          "error"
        );
        return;
      }

      try {
        const { error } = await supabase
          .from("goal_circles")
          .insert({
            user_id: currentUser.id,
            title,
            description,
            visibility,
            owner_nickname: currentNickname
          });

        if (error) throw error;

        goalForm.reset();
        await loadGoalCircles();

        showStatus(
          "goalStatus",
          "Your goal has been created!",
          "success"
        );
      } catch (error) {
        console.error("Goal save error:", error);

        showStatus(
          "goalStatus",
          "Could not save your goal: " + error.message,
          "error"
        );
      }
    });
  }

  async function deleteGoalCircle(id) {
    if (!currentUser) return;

    if (!window.confirm("Delete this goal?")) return;

    try {
      const { error } = await supabase
        .from("goal_circles")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUser.id);

      if (error) throw error;

      await loadGoalCircles();

      showStatus(
        "goalStatus",
        "Goal deleted.",
        "success"
      );
    } catch (error) {
      console.error("Goal delete error:", error);
      showStatus("goalStatus", "Could not delete this goal.", "error");
    }
  }

  // =====================================
  // SAVED DISCOVERIES
  // =====================================

  const SAVED_KEY = "everydaySavedDiscoveries";

  function getCurrentActivityData() {
    const activity = currentActivity();

    return {
      activity_title: activity.title,
      activity_type: activity.type,
      activity_description: activity.description,
      activity_symbol: activity.symbol
    };
  }

  function createSaveActivityButton() {
    if ($("saveActivityButton")) return;

    const button = createElement(
      "button",
      "secondary-button",
      "☆ Save this activity"
    );

    button.id = "saveActivityButton";
    button.type = "button";

    const nextButton = $("nextActivity");

    if (nextButton?.parentElement) {
      nextButton.parentElement.appendChild(button);
    } else {
      $("activityQuestion")?.parentElement?.appendChild(button);
    }

    button.addEventListener("click", saveCurrentDiscovery);
  }

  async function saveCurrentDiscovery() {
    const activity = getCurrentActivityData();

    if (currentUser) {
      try {
        const { error } = await supabase
          .from("saved_discoveries")
          .upsert({
            user_id: currentUser.id,
            ...activity
          }, {
            onConflict: "user_id,activity_title",
            ignoreDuplicates: true
          });

        if (error) throw error;

        await loadSavedDiscoveries();

        showStatus(
          "discoveryStatus",
          "Activity saved to My Space!",
          "success"
        );
      } catch (error) {
        console.error("Save discovery error:", error);

        showStatus(
          "discoveryStatus",
          "Could not save this activity: " + error.message,
          "error"
        );
      }
    } else {
      const saved = readLocal(SAVED_KEY, []);

      if (!saved.some(item =>
        item.activity_title === activity.activity_title
      )) {
        saved.unshift(activity);
        writeLocal(SAVED_KEY, saved);
      }

      renderGuestDiscoveries();

      showStatus(
        "discoveryStatus",
        "Saved on this device. Sign in to sync it to your account.",
        "success"
      );
    }
  }

  async function loadSavedDiscoveries() {
    if (!currentUser) {
      renderGuestDiscoveries();
      return;
    }

    try {
      const { data, error } = await supabase
        .from("saved_discoveries")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      renderSavedDiscoveries(data || []);
    } catch (error) {
      console.error("Saved discoveries loading error:", error);
      showStatus(
        "discoveryStatus",
        "Could not load saved discoveries.",
        "error"
      );
    }
  }

  function renderGuestDiscoveries() {
    renderSavedDiscoveries(readLocal(SAVED_KEY, []));
  }

  function renderSavedDiscoveries(items) {
    const container = $("savedDiscoveries");
    if (!container) return;

    container.replaceChildren();

    if (!items.length) {
      container.appendChild(
        createElement(
          "p",
          "muted",
          "Activities you save will appear here."
        )
      );
      return;
    }

    items.forEach(item => {
      const card = createElement("article", "saved-discovery-card");

      const symbol = createElement(
        "span",
        "discovery-symbol",
        item.activity_symbol || "✧"
      );

      const title = createElement(
        "h4",
        "",
        item.activity_title
      );

      const type = createElement(
        "small",
        "muted",
        item.activity_type || "EVERYDAY ACTIVITY"
      );

      const description = createElement(
        "p",
        "",
        item.activity_description || ""
      );

      const removeButton = createElement(
        "button",
        "delete-entry-button",
        "Remove"
      );

      removeButton.type = "button";
      removeButton.addEventListener("click", () => {
        removeDiscovery(item);
      });

      card.append(
        symbol,
        title,
        type,
        description,
        removeButton
      );

      container.appendChild(card);
    });
  }

  async function removeDiscovery(item) {
    if (currentUser && item.id) {
      try {
        const { error } = await supabase
          .from("saved_discoveries")
          .delete()
          .eq("id", item.id)
          .eq("user_id", currentUser.id);

        if (error) throw error;

        await loadSavedDiscoveries();
      } catch (error) {
        console.error("Remove discovery error:", error);
        showStatus(
          "discoveryStatus",
          "Could not remove this discovery.",
          "error"
        );
      }
    } else {
      const saved = readLocal(SAVED_KEY, []).filter(
        entry => entry.activity_title !== item.activity_title
      );

      writeLocal(SAVED_KEY, saved);
      renderGuestDiscoveries();
    }
  }

  async function migrateGuestDiscoveries() {
    if (!currentUser) return;

    const localItems = readLocal(SAVED_KEY, []);
    if (!localItems.length) return;

    try {
      const records = localItems.map(item => ({
        user_id: currentUser.id,
        activity_title: item.activity_title,
        activity_type: item.activity_type,
        activity_description: item.activity_description,
        activity_symbol: item.activity_symbol
      }));

      const { error } = await supabase
        .from("saved_discoveries")
        .upsert(records, {
          onConflict: "user_id,activity_title",
          ignoreDuplicates: true
        });

      if (error) throw error;

      localStorage.removeItem(SAVED_KEY);
      await loadSavedDiscoveries();
    } catch (error) {
      console.error("Guest discoveries sync error:", error);
    }
  }

  // =====================================
  // CURRENT ACTIVITY
  // =====================================

  function currentActivity() {
    const list = activities[mood];
    return list[activityIndex % list.length];
  }

  // =====================================
  // RENDER ACTIVITY
  // =====================================

  function renderActivity() {
    const activity = currentActivity();

    if ($("activityType")) {
      $("activityType").textContent = activity.type;
    }

    if ($("activitySymbol")) {
      $("activitySymbol").textContent = activity.symbol;
    }

    if ($("activityTitle")) {
      $("activityTitle").textContent = activity.title;
    }

    if ($("activityDescription")) {
      $("activityDescription").textContent = activity.description;
    }

    if ($("activityQuestion")) {
      $("activityQuestion").textContent = activity.question;
    }

    if ($("answerFeedback")) {
      $("answerFeedback").textContent = "";
    }

    if ($("progressText")) {
      $("progressText").textContent = "A small moment for yourself";
    }

    const answerList = $("answerList");
    if (!answerList) return;

    answerList.replaceChildren();

    activity.answers.forEach(answer => {
      const button = createElement("button", "answer", answer);
      button.type = "button";

      button.addEventListener("click", () => {
        if (button.disabled) return;

        button.classList.add("selected");

        if (activity.correct === null) {
          [...answerList.children].forEach(item => {
            item.disabled = true;
          });

          if ($("answerFeedback")) {
            $("answerFeedback").textContent = activity.explain;
          }

          completeActivity();
          return;
        }

        if (answer === activity.correct) {
          [...answerList.children].forEach(item => {
            item.disabled = true;
          });

          button.classList.add("correct");

          if ($("answerFeedback")) {
            $("answerFeedback").textContent =
              "That's right! " + activity.explain;
          }

          completeActivity();
        } else {
          button.classList.add("wrong");

          if ($("answerFeedback")) {
            $("answerFeedback").textContent =
              "Good try. Have another look and try again!";
          }

          button.disabled = true;
        }
      });

      answerList.appendChild(button);
    });

    createSaveActivityButton();
  }

  // =====================================
  // COMPLETE ACTIVITY
  // =====================================

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
        .from("user_profiles")
        .upsert({
          id: currentUser.id,
          completed_count: completed
        })
        .then(({ error }) => {
          if (error) {
            console.error("Progress save error:", error);
          }
        });
    }
  }

  // =====================================
  // CHANGE MOOD
  // =====================================

  function setMood(nextMood) {
    if (!activities[nextMood]) return;

    mood = nextMood;
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

  // =====================================
  // NEXT ACTIVITY
  // =====================================

  const nextBtn = $("nextActivity");

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      activityIndex++;
      renderActivity();
    });
  }

  // =====================================
  // SURPRISE ME
  // =====================================

  const surpriseBtn = $("surpriseButton");

  if (surpriseBtn) {
    surpriseBtn.addEventListener("click", () => {
      const moods = Object.keys(activities).filter(
        item => item !== mood
      );

      const randomMood =
        moods[Math.floor(Math.random() * moods.length)];

      setMood(randomMood);
    });
  }

  // =====================================
  // DAILY THOUGHT
  // =====================================

  const newThoughtBtn = $("newThought");

  if (newThoughtBtn) {
    newThoughtBtn.addEventListener("click", () => {
      const next =
        thoughts[Math.floor(Math.random() * thoughts.length)];

      if ($("dailyThought")) {
        $("dailyThought").textContent = next;
      }
    });
  }

  // =====================================
  // COMPLETED COUNT
  // =====================================

  if ($("completedCount")) {
    $("completedCount").textContent = completed;
  }

  // =====================================
  // COMMUNITY THOUGHTS
  // =====================================

  const thoughtForm = $("thoughtForm");

  if (thoughtForm) {
    thoughtForm.addEventListener("submit", async event => {
      event.preventDefault();

      const input = $("thoughtInput");
      if (!input) return;

      const value = input.value.trim();
      if (!value) return;

      const authorName = currentUser
        ? currentNickname
        : "You";

      const saved = readLocal("everydayThoughts", []);

      saved.unshift({
        text: value,
        author: authorName,
        date: new Date().toISOString()
      });

      writeLocal(
        "everydayThoughts",
        saved.slice(0, 10)
      );

      addWallItem(
        value,
        authorName.charAt(0).toUpperCase(),
        authorName
      );

      input.value = "";

      if (currentUser) {
        try {
          const { error } = await supabase
            .from("community_thoughts")
            .insert([{
              user_id: currentUser.id,
              text: value,
              author: authorName
            }]);

          if (error) throw error;

          if ($("answerFeedback")) {
            $("answerFeedback").textContent =
              "Your thought has been shared!";
          }
        } catch (error) {
          console.error("Community save error:", error);

          if ($("answerFeedback")) {
            $("answerFeedback").textContent =
              "Saved on this device, but cloud sharing failed.";
          }
        }
      } else {
        if ($("answerFeedback")) {
          $("answerFeedback").textContent =
            "Your thought has been saved on this device.";
        }
      }
    });
  }

  // =====================================
  // ADD WALL ITEM
  // =====================================

  function addWallItem(text, letter, name = "You") {
    const communityWall = $("communityWall");
    if (!communityWall) return;

    const row = createElement("div", "wall-item");
    const avatar = createElement("span", "avatar", letter);
    const paragraph = createElement("p");
    const strong = createElement("strong", "", name);
    const message = createElement("span", "muted", text);

    paragraph.append(
      strong,
      document.createElement("br"),
      message
    );

    row.append(avatar, paragraph);
    communityWall.prepend(row);
  }

  // =====================================
  // LOAD SAVED THOUGHTS
  // =====================================

  const savedThoughts = readLocal("everydayThoughts", []);

  savedThoughts.forEach(item => {
    addWallItem(
      item.text,
      item.author
        ? item.author.charAt(0).toUpperCase()
        : "Y",
      item.author || "You"
    );
  });

  // =====================================
  // PWA INSTALLATION
  // =====================================

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();

    deferredInstall = event;

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

  // =====================================
  // INITIALIZE APP
  // =====================================

  renderGuestDiscoveries();
  renderActivity();
  checkSession();

  // =====================================
  // SERVICE WORKER
  // =====================================

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
          console.error("Service worker error:", error);
        });
    });
  }

})();
