
(() => {
  "use strict";

  // =====================================
  // EVERYDAY — APP.JS
  // Version 0.4
  // =====================================

  // =====================================
  // SUPABASE CONFIGURATION
  // =====================================

  const SUPABASE_URL =
    "https://wyfzcbqmrultttncnenb.supabase.co";

  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5ZnpjYnFtcnVsdHR0bmNuZW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MDA5MTUsImV4cCI6MjEwOTI3NjkxNX0.c33pupDQsZeeBJuC_DUHQ9GXJoJc7Lo2Mwr5WBEfjPU";

  if (!window.supabase) {
    console.error("Supabase library did not load.");
    return;
  }

  const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    }
  );

  window.everydaySupabase = supabase;

  // Shared authentication state for social.js
  window.everydayAuthReady = false;
  window.everydayAuthSession = null;

  // =====================================
  // HELPERS
  // =====================================

  const $ = id => document.getElementById(id);

  const readLocal = (key, fallback = []) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  const writeLocal = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Local storage error:", error);
    }
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

    if (className) {
      element.className = className;
    }

    if (text !== undefined && text !== null) {
      element.textContent = text;
    }

    return element;
  };

  const formatDate = date => {
    if (!date) return "";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    return parsedDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const setButtonLoading = (
    button,
    loading,
    loadingText = "Saving..."
  ) => {
    if (!button) return;

    if (loading) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.textContent = loadingText;
    } else {
      button.disabled = false;

      if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  };

  // =====================================
  // APP STATE
  // =====================================

  let mood = "Curious";
  let activityIndex = 0;
  let activityCompleted = false;

  let completed = Number(
    localStorage.getItem("everydayCompleted") || 0
  );

  let currentUser = null;
  let currentNickname = "Everyday member";
  let deferredInstall = null;
  let loadedAccountId = null;

  const SAVED_KEY = "everydaySavedDiscoveries";

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

  // Authentication form elements
  const authForm = $("authForm");
  const authEmailInput = $("authEmailInput");
  const authPasswordInput = $("authPasswordInput");
  const authConfirmPasswordInput = $("authConfirmPasswordInput");

  const authPasswordGroup = $("authPasswordGroup");
  const authConfirmPasswordGroup = $("authConfirmPasswordGroup");

  const authSubmitButton = $("authSubmitButton");
  const forgotPasswordButton = $("forgotPasswordButton");

  const authHeading = $("authHeading");
  const authDescription = $("authDescription");
  const authStatusMessage = $("authStatusMessage");

  const showSignInModeBtn = $("showSignInMode");
  const showSignUpModeBtn = $("showSignUpMode");

  let authMode = "signin";
  let isPasswordRecovery = false;

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
        symbol: "◎",
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

  function setAuthMode(mode) {
    const allowedModes = [
      "signin",
      "signup",
      "recovery",
      "newpassword"
    ];

    if (!allowedModes.includes(mode)) return;

    authMode = mode;

    const isSignIn = mode === "signin";
    const isSignUp = mode === "signup";
    const isRecovery = mode === "recovery";
    const isNewPassword = mode === "newpassword";

    if (authHeading) {
      const headings = {
        signin: "Welcome back",
        signup: "Create your account",
        recovery: "Reset your password",
        newpassword: "Choose a new password"
      };

      authHeading.textContent = headings[mode];
    }

    if (authDescription) {
      const descriptions = {
        signin: "Sign in to continue your everyday journey.",
        signup: "Create an account to keep your progress synced.",
        recovery: "Enter your email address to receive a password reset link.",
        newpassword: "Choose a new password for your account."
      };

      authDescription.textContent = descriptions[mode];
    }

    if (authPasswordGroup) {
      authPasswordGroup.hidden = isRecovery;
    }

    if (authConfirmPasswordGroup) {
      authConfirmPasswordGroup.hidden =
        !(isSignUp || isNewPassword);
    }

    if (authPasswordInput) {
      authPasswordInput.disabled = isRecovery;
      authPasswordInput.required =
        isSignIn || isSignUp || isNewPassword;

      authPasswordInput.autocomplete =
        isSignIn ? "current-password" : "new-password";

      authPasswordInput.value = "";
    }

    if (authConfirmPasswordInput) {
      authConfirmPasswordInput.disabled =
        !(isSignUp || isNewPassword);

      authConfirmPasswordInput.required =
        isSignUp || isNewPassword;

      authConfirmPasswordInput.value = "";
    }

    if (authEmailInput) {
      authEmailInput.disabled = isNewPassword;
      authEmailInput.required = !isNewPassword;
    }

    if (showSignInModeBtn) {
      showSignInModeBtn.hidden = isNewPassword;
      showSignInModeBtn.textContent =
        isRecovery ? "Back to Sign In" : "Sign In";

      showSignInModeBtn.setAttribute(
        "aria-pressed",
        String(isSignIn)
      );
    }

    if (showSignUpModeBtn) {
      showSignUpModeBtn.hidden = isRecovery || isNewPassword;

      showSignUpModeBtn.setAttribute(
        "aria-pressed",
        String(isSignUp)
      );
    }

    if (forgotPasswordButton) {
      forgotPasswordButton.hidden = !isSignIn;
    }

    if (authSubmitButton) {
      const buttonLabels = {
        signin: "Sign In",
        signup: "Create Account",
        recovery: "Send Reset Link",
        newpassword: "Update Password"
      };

      authSubmitButton.textContent = buttonLabels[mode];
    }

    if (authStatusMessage) {
      authStatusMessage.textContent = "";
      authStatusMessage.style.display = "none";
    }
  }

  function updateAuthUI(session) {
    const nextUser = session?.user || null;
    const previousUserId = currentUser?.id || null;
    const nextUserId = nextUser?.id || null;

    currentUser = nextUser;

    // Share authentication state with social.js.
    window.everydayAuthSession = session || null;
    window.everydayAuthReady = true;

    window.dispatchEvent(
      new CustomEvent("everyday:auth-change", {
        detail: {
          session: session || null
        }
      })
    );

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

      // Keep the modal open while choosing a new password.
      if (authModal?.open && !isPasswordRecovery) {
        authModal.close();
      }

      if (
        previousUserId !== nextUserId ||
        loadedAccountId !== nextUserId
      ) {
        loadedAccountId = nextUserId;
        loadAccountData();
      }
    } else {
      currentNickname = "Everyday member";
      loadedAccountId = null;

      if (guestView) guestView.style.display = "flex";
      if (userView) userView.style.display = "none";

      if (streakNotice) {
        streakNotice.textContent =
          "Your completed activities stay on this device in guest mode.";
      }

      if (previousUserId) {
        clearAccountDisplays();
      }

      renderGuestDiscoveries();
      renderProfileIdentity();
    }
  }

  async function loadAccountData() {
    if (!currentUser) return;

    const accountId = currentUser.id;

    try {
      await syncUserCloudData();

      if (currentUser?.id !== accountId) return;

      await loadProfile();

      if (currentUser?.id !== accountId) return;

      await loadJournalEntries();

      if (currentUser?.id !== accountId) return;

      await loadGoalCircles();

      if (currentUser?.id !== accountId) return;

      await loadSavedDiscoveries();

      if (currentUser?.id !== accountId) return;

      await migrateGuestDiscoveries();

    } catch (error) {
      console.error("Account data loading error:", error);
    }

    // Connect is managed by social.js.
    // Do not load or render community posts here.
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

    const bioDisplay = $("profileDescription");

    if (bioDisplay) {
      bioDisplay.textContent =
        "A little space to introduce yourself.";
    }

    currentNickname = "Everyday member";
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
      } else if (data && completed > Number(data.completed_count)) {
        await saveCompletedCount();
      }
    } catch (error) {
      console.error("Cloud progress sync error:", error);
    }
  }

  async function saveCompletedCount() {
    if (!currentUser) return;

    const { error } = await supabase
      .from("user_profiles")
      .upsert({
        id: currentUser.id,
        completed_count: completed
      });

    if (error) {
      console.error("Progress save error:", error);
    }
  }

  // =====================================
  // LOGIN MODAL
  // =====================================

  if (openAuthModalBtn && authModal) {
    openAuthModalBtn.addEventListener("click", event => {
      event.preventDefault();

      setAuthMode("signin");

      if (!authModal.open) {
        authModal.showModal();
      }
    });
  }

  if (closeAuthModalBtn && authModal) {
    closeAuthModalBtn.addEventListener("click", () => {
      authModal.close();
    });
  }

  if (authModal) {
    authModal.addEventListener("click", event => {
      if (event.target === authModal) {
        authModal.close();
      }
    });
  }

  if (showSignInModeBtn) {
    showSignInModeBtn.addEventListener("click", () => {
      setAuthMode("signin");
    });
  }

  if (showSignUpModeBtn) {
    showSignUpModeBtn.addEventListener("click", () => {
      setAuthMode("signup");
    });
  }

  if (forgotPasswordButton) {
    forgotPasswordButton.addEventListener("click", () => {
      setAuthMode("recovery");
    });
  }

  // =====================================
  // EMAIL + PASSWORD AUTHENTICATION
  // =====================================

  if (authForm) {
    authForm.addEventListener("submit", async event => {
      event.preventDefault();

      const email = authEmailInput?.value.trim() || "";
      const password = authPasswordInput?.value || "";
      const confirmPassword =
        authConfirmPasswordInput?.value || "";

      if (authMode !== "newpassword" && !email) {
        showStatus(
          "authStatusMessage",
          "Please enter your email address.",
          "error"
        );
        return;
      }

      if (
        authMode === "signin" ||
        authMode === "signup" ||
        authMode === "newpassword"
      ) {
        if (password.length < 6) {
          showStatus(
            "authStatusMessage",
            "Your password must contain at least 6 characters.",
            "error"
          );
          return;
        }
      }

      if (
        authMode === "signup" ||
        authMode === "newpassword"
      ) {
        if (password !== confirmPassword) {
          showStatus(
            "authStatusMessage",
            "Your passwords do not match.",
            "error"
          );
          return;
        }
      }

      setButtonLoading(
        authSubmitButton,
        true,
        "Please wait..."
      );

      try {
        // SIGN IN
        if (authMode === "signin") {
          showStatus(
            "authStatusMessage",
            "Signing you in...",
            "info"
          );

          const { data, error } =
            await supabase.auth.signInWithPassword({
              email,
              password
            });

          if (error) throw error;

          if (data.session) {
            updateAuthUI(data.session);

            showStatus(
              "authStatusMessage",
              "Welcome back!",
              "success"
            );
          }
        }

        // CREATE ACCOUNT
        else if (authMode === "signup") {
          showStatus(
            "authStatusMessage",
            "Creating your account...",
            "info"
          );

          const { data, error } =
            await supabase.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: window.location.origin
              }
            });

          if (error) throw error;

          if (data.session) {
            updateAuthUI(data.session);

            showStatus(
              "authStatusMessage",
              "Your account has been created!",
              "success"
            );
          } else {
            showStatus(
              "authStatusMessage",
              "Your account request was received. Please check your email to confirm your account before signing in.",
              "success"
            );
          }
        }

        // PASSWORD RESET EMAIL
        else if (authMode === "recovery") {
          showStatus(
            "authStatusMessage",
            "Sending your password reset request...",
            "info"
          );

          const { error } =
            await supabase.auth.resetPasswordForEmail(
              email,
              {
                redirectTo: window.location.origin
              }
            );

          if (error) throw error;

          showStatus(
            "authStatusMessage",
            "If an account exists for that email, a password reset link will be sent. Please check your inbox and spam folder.",
            "success"
          );
        }

        // SET A NEW PASSWORD
        else if (authMode === "newpassword") {
          const { error } =
            await supabase.auth.updateUser({
              password
            });

          if (error) throw error;

          isPasswordRecovery = false;

          showStatus(
            "authStatusMessage",
            "Your password has been updated successfully.",
            "success"
          );

          authModal?.close();

          setAuthMode("signin");
        }

      } catch (error) {
        console.error("Authentication error:", error);

        let message =
          error?.message || "Something went wrong. Please try again.";

        if (
          message.toLowerCase().includes("rate limit")
        ) {
          message =
            "Email rate limit reached. Please wait before requesting another email.";
        } else if (
          message.toLowerCase().includes("invalid login credentials")
        ) {
          message =
            "Incorrect email or password. Please try again.";
        } else if (
          message.toLowerCase().includes("email not confirmed")
        ) {
          message =
            "Please confirm your email address before signing in.";
        } else if (
          message.toLowerCase().includes("user already registered")
        ) {
          message =
            "An account with this email already exists. Please sign in instead.";
        }

        showStatus(
          "authStatusMessage",
          message,
          "error"
        );

      } finally {
        setButtonLoading(
          authSubmitButton,
          false
        );
      }
    });
  }

  // =====================================
  // LOGOUT
  // =====================================

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      logoutBtn.disabled = true;

      try {
        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.reload();

      } catch (error) {
        console.error("Logout error:", error);

        logoutBtn.disabled = false;

        showStatus(
          "authStatusMessage",
          "Could not sign out. Please try again.",
          "error"
        );
      }
    });
  }

  // =====================================
  // SHARED AUTHENTICATION LISTENER
  // =====================================

  // APP.JS IS THE SINGLE AUTHENTICATION LISTENER.
  // It shares changes with social.js through a custom event.
  // Supabase calls are deferred until after the callback returns.

  supabase.auth.onAuthStateChange((event, session) => {
    Promise.resolve().then(() => {

      if (event === "PASSWORD_RECOVERY") {
        isPasswordRecovery = true;

        setAuthMode("newpassword");

        if (authModal && !authModal.open) {
          authModal.showModal();
        }
      }

      updateAuthUI(session);

    }).catch(error => {
      console.error("Authentication state error:", error);
    });
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

      renderProfileIdentity(data?.bio || "");
    } catch (error) {
      console.error("Profile loading error:", error);

      showStatus(
        "profileStatus",
        "Could not load your profile.",
        "error"
      );
    }
  }

  function renderProfileIdentity(bio = "") {
    const nicknameDisplay = $("profileNickname");
    const bioDisplay = $("profileDescription");

    if (nicknameDisplay) {
      nicknameDisplay.textContent = currentNickname;
    }

    if (bioDisplay) {
      bioDisplay.textContent =
        bio.trim() || "A little space to introduce yourself.";
    }
  }

  async function saveProfile() {
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

    const saveButton = $("saveProfileButton");

    setButtonLoading(saveButton, true);

    try {
      const { data: existingProfile, error: lookupError } =
        await supabase
          .from("user_profiles")
          .select("id")
          .eq("id", currentUser.id)
          .maybeSingle();

      if (lookupError) throw lookupError;

      let result;

      if (existingProfile) {
        result = await supabase
          .from("user_profiles")
          .update({
            nickname,
            bio,
            completed_count: completed,
            updated_at: new Date().toISOString()
          })
          .eq("id", currentUser.id);
      } else {
        result = await supabase
          .from("user_profiles")
          .insert({
            id: currentUser.id,
            nickname,
            bio,
            completed_count: completed,
            is_private: false,
            updated_at: new Date().toISOString()
          });
      }

      if (result.error) throw result.error;

      currentNickname = nickname;
      renderProfileIdentity(bio);

      showStatus(
        "profileStatus",
        "Your profile has been saved!",
        "success"
      );

      const editor = $("profileEditor");

      if (editor) {
        editor.hidden = true;
      }
    } catch (error) {
      console.error("Profile save error:", error);

      showStatus(
        "profileStatus",
        "Could not save your profile: " + error.message,
        "error"
      );
    } finally {
      setButtonLoading(saveButton, false);
    }
  }

  const editProfileButton = $("editProfileButton");
  const profileEditor = $("profileEditor");
  const saveProfileButton = $("saveProfileButton");

  if (editProfileButton && profileEditor) {
    editProfileButton.addEventListener("click", () => {
      profileEditor.hidden = !profileEditor.hidden;

      if (!profileEditor.hidden) {
        $("nicknameInput")?.focus();
      }
    });
  }

  if (saveProfileButton) {
    saveProfileButton.addEventListener("click", event => {
      event.preventDefault();
      saveProfile();
    });
  }

  const profileForm = $("profileForm");

  if (profileForm) {
    profileForm.addEventListener("submit", event => {
      event.preventDefault();
      saveProfile();
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

      const heading = createElement(
        "h4",
        "",
        entry.title || "Untitled entry"
      );

      const date = createElement(
        "small",
        "muted",
        formatDate(entry.created_at)
      );

      const content = createElement("p", "", entry.content || "");

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

      const submitButton = journalForm.querySelector(
        'button[type="submit"]'
      );

      setButtonLoading(submitButton, true);

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
      } finally {
        setButtonLoading(submitButton, false);
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

      showStatus(
        "journalStatus",
        "Could not delete the entry.",
        "error"
      );
    }
  }

  // =====================================
  // GOAL CIRCLES
  // =====================================

  async function loadGoalCircles() {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from("goal_circles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      renderGoalCircles(data || []);
    } catch (error) {
      console.error("Goal loading error:", error);

      showStatus(
        "goalStatus",
        "Could not load Goal Circles.",
        "error"
      );
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

      const title = createElement(
        "h4",
        "",
        goal.title || "Untitled goal"
      );

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

      const submitButton = goalForm.querySelector(
        'button[type="submit"]'
      );

      setButtonLoading(submitButton, true);

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
      } finally {
        setButtonLoading(submitButton, false);
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

      showStatus(
        "goalStatus",
        "Could not delete this goal.",
        "error"
      );
    }
  }

  // =====================================
  // SAVED DISCOVERIES
  // =====================================

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
          .upsert(
            {
              user_id: currentUser.id,
              ...activity
            },
            {
              onConflict: "user_id,activity_title",
              ignoreDuplicates: true
            }
          );

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
      const card = createElement(
        "article",
        "saved-discovery-card"
      );

      const symbol = createElement(
        "span",
        "discovery-symbol",
        item.activity_symbol || "✧"
      );

      const title = createElement(
        "h4",
        "",
        item.activity_title || "Saved activity"
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
        entry =>
          entry.activity_title !== item.activity_title
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

    activityCompleted = false;

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
      $("progressText").textContent =
        "A small moment for yourself";
    }

    const answerList = $("answerList");
    if (!answerList) return;

    answerList.replaceChildren();

    activity.answers.forEach(answer => {
      const button = createElement("button", "answer", answer);

      button.type = "button";

      button.addEventListener("click", () => {
        if (button.disabled || activityCompleted) return;

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
    if (activityCompleted) return;

    activityCompleted = true;
    completed++;

    localStorage.setItem(
      "everydayCompleted",
      String(completed)
    );

    if ($("completedCount")) {
      $("completedCount").textContent = completed;
    }

    if ($("progressText")) {
      $("progressText").textContent =
        "Completed — nice work!";
    }

    if (currentUser) {
      saveCompletedCount();
    }

    updateExploreCompletedCount();
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

  function updateExploreCompletedCount() {
    const counter = $("exploreCompletedCount");

    if (counter) {
      counter.textContent = completed;
    }
  }

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

      try {
        await deferredInstall.userChoice;
      } catch (error) {
        console.error("Install prompt error:", error);
      }

      deferredInstall = null;
      installBtn.hidden = true;
    });
  }

  // =====================================
  // PAGE NAVIGATION
  // EVERYDAY — THREE MAIN SECTIONS
  // =====================================

  const pageLinks = document.querySelectorAll("[data-page-link]");
  const pageViews = document.querySelectorAll(".page-view[data-page]");

  // Keep compatibility with older page links.
  const pageAliases = {
    discover: "explore",
    play: "explore",
    connect: "community"
  };

  const availablePages = [
    "community",
    "explore",
    "my-space"
  ];

  function normalizePageName(pageName) {
    const normalized = String(pageName || "")
      .trim()
      .toLowerCase()
      .replace(/^#/, "");

    return pageAliases[normalized] || normalized;
  }

  function showPage(requestedPage, updateAddress = true) {
    let pageName = normalizePageName(requestedPage);

    if (!availablePages.includes(pageName)) {
      pageName = "community";
    }

    // Show only the selected page.
    pageViews.forEach(page => {
      const isSelected = page.dataset.page === pageName;

      page.hidden = !isSelected;
      page.classList.toggle("is-active", isSelected);
    });

    // Update navigation highlights.
    pageLinks.forEach(link => {
      const linkPage = normalizePageName(
        link.dataset.pageLink
      );

      const isSelected = linkPage === pageName;

      link.classList.toggle("active", isSelected);
      link.classList.toggle("is-active", isSelected);

      if (isSelected) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    // Update browser address.
    if (updateAddress) {
      const newHash = "#" + pageName;

      if (window.location.hash !== newHash) {
        history.pushState(
          { page: pageName },
          "",
          newHash
        );
      }
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  // Handle navigation and internal page links.
  document.addEventListener("click", event => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const link = target.closest("a[href^='#']");

    if (!link) return;

    const hash = link.getAttribute("href").slice(1);

    if (!hash) return;

    const pageName = normalizePageName(hash);

    if (!availablePages.includes(pageName)) return;

    event.preventDefault();

    showPage(pageName);
  });

  // Browser back and forward.
  window.addEventListener("popstate", () => {
    const pageName = window.location.hash.slice(1);

    showPage(pageName || "community", false);
  });

  // Open Connect by default.
  const initialPage = window.location.hash.slice(1);

  showPage(initialPage || "community", false);

  updateExploreCompletedCount();

  // =====================================
  // INITIALIZE APP
  // =====================================

  renderGuestDiscoveries();
  renderActivity();
  renderProfileIdentity();

  // Supabase INITIAL_SESSION event handles session restoration.

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
