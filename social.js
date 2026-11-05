(() => {
  "use strict";

  // =========================================
  // EVERYDAY — SOCIAL COMMUNITY
  // =========================================

  const supabase = window.everydaySupabase;

  if (!supabase) {
    console.error(
      "EVERYDAY Social: Supabase client was not found. Check app.js."
    );
    return;
  }

  const LOCAL_KEY = "everyday_local_social_posts";
  const MAX_POST_LENGTH = 1000;
  const MAX_FEED_POSTS = 500;

  let currentUser = null;
  let currentProfile = null;
  let feedPosts = [];
  let followRelationships = [];
  let incomingRequests = [];
  let searchTimer = null;
  let searchRequestNumber = 0;

  // =========================================
  // HELPERS
  // =========================================

  const byId = (id) => document.getElementById(id);

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined && text !== null) {
      element.textContent = text;
    }

    return element;
  }

  function getLocalPosts() {
    try {
      const stored = JSON.parse(
        localStorage.getItem(LOCAL_KEY) || "[]"
      );

      if (!Array.isArray(stored)) return [];

      return stored.map((post) => ({
        ...post,
        local: true
      }));
    } catch (error) {
      console.error("EVERYDAY local posts:", error);
      return [];
    }
  }

  function saveLocalPosts(posts) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(posts));
      return true;
    } catch (error) {
      console.error("EVERYDAY could not save local posts:", error);
      return false;
    }
  }

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function setStatus(element, message, isError = false) {
    if (!element) return;

    element.textContent = message;
    element.classList.toggle("is-error", isError);
  }

  function getNickname() {
    return (
      currentProfile?.nickname ||
      currentUser?.user_metadata?.nickname ||
      "Everyday member"
    );
  }

  function escapeSearchTerm(value) {
    return value.replace(/[%,_]/g, "").trim();
  }

  function getFollowRelationship(userId) {
    return followRelationships.find(
      (relationship) =>
        relationship.following_id === userId
    );
  }

  function getFollowButtonLabel(relationship) {
    if (!relationship) return "Follow";

    return relationship.status === "pending"
      ? "Cancel request"
      : "Unfollow";
  }

  function mergePosts(serverPosts, localPosts) {
    const merged = new Map();

    (serverPosts || []).forEach((post) => {
      merged.set(post.id, {
        ...post,
        local: false
      });
    });

    (localPosts || []).forEach((post) => {
      if (!merged.has(post.id)) {
        merged.set(post.id, {
          ...post,
          local: true
        });
      }
    });

    return Array.from(merged.values()).sort(
      (a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
    );
  }

  // =========================================
  // BUILD THE COMMUNITY INTERFACE
  // =========================================

  function buildCommunityInterface() {
    const communityPage = document.querySelector(
      '[data-page="community"]'
    );

    if (!communityPage || byId("everydaySocial")) {
      return;
    }

    const oldCommunityPost = byId("community");

    if (oldCommunityPost) {
      oldCommunityPost.hidden = true;
    }

    const root = createElement("section", "everyday-social");
    root.id = "everydaySocial";

    const composer = createElement(
      "article",
      "social-card social-composer"
    );

    const composerHeading = createElement(
      "div",
      "social-section-heading"
    );

    const headingCopy = createElement("div");

    headingCopy.append(
      createElement("p", "eyebrow", "YOUR COMMUNITY"),
      createElement("h2", "", "Any thoughts?")
    );

    composerHeading.append(headingCopy);

    const composerDescription = createElement(
      "p",
      "muted",
      "Share a thought, a question, a small discovery, or something worth discussing."
    );

    const form = createElement("form", "social-compose-form");
    form.id = "socialComposeForm";

    const textarea = document.createElement("textarea");
    textarea.id = "socialComposeInput";
    textarea.name = "thought";
    textarea.maxLength = MAX_POST_LENGTH;
    textarea.rows = 4;
    textarea.placeholder = "Write something worth sharing...";
    textarea.required = true;

    const formFooter = createElement(
      "div",
      "social-compose-footer"
    );

    const characterCount = createElement(
      "span",
      "social-character-count",
      `0 / ${MAX_POST_LENGTH}`
    );

    characterCount.id = "socialCharacterCount";

    // Preserve the character counter spacing.
    characterCount.style.marginRight = "30px";
    characterCount.style.flexShrink = "0";

    const submitButton = createElement(
      "button",
      "primary-button",
      "Save thought"
    );

    submitButton.type = "submit";
    submitButton.style.marginLeft = "0";
    submitButton.style.flexShrink = "0";

    formFooter.style.display = "flex";
    formFooter.style.alignItems = "center";
    formFooter.style.justifyContent = "flex-start";
    formFooter.style.gap = "0";

    formFooter.append(characterCount, submitButton);
    form.append(textarea, formFooter);

    const signInNotice = createElement(
      "p",
      "social-notice",
      "You're in Guest Mode. Your thoughts will be saved on this device. Sign in to join conversations with other members."
    );

    signInNotice.id = "socialGuestNotice";

    composer.append(
      composerHeading,
      composerDescription,
      form,
      signInNotice
    );

    const feedCard = createElement(
      "article",
      "social-card social-feed-card"
    );

    const feedHeading = createElement(
      "div",
      "social-section-heading"
    );

    const feedHeadingCopy = createElement("div");

    feedHeadingCopy.append(
      createElement("p", "eyebrow", "OPEN CONVERSATIONS"),
      createElement("h2", "", "From the community")
    );

    const refreshButton = createElement(
      "button",
      "text-button",
      "Refresh"
    );

    refreshButton.type = "button";
    refreshButton.id = "socialRefreshButton";

    feedHeading.append(feedHeadingCopy, refreshButton);

    const feedStatus = createElement(
      "p",
      "social-status",
      "Loading community thoughts..."
    );

    feedStatus.id = "socialFeedStatus";
    feedStatus.setAttribute("aria-live", "polite");

    const feed = createElement("div", "social-feed");
    feed.id = "socialFeed";

    feedCard.append(feedHeading, feedStatus, feed);

    root.append(composer, feedCard);

    const layout = communityPage.querySelector(
      ".community-page-layout"
    );

    if (layout) {
      layout.before(root);
    } else {
      communityPage.append(root);
    }

    textarea.addEventListener("input", () => {
      characterCount.textContent =
        `${textarea.value.length} / ${MAX_POST_LENGTH}`;
    });

    form.addEventListener("submit", handleNewPost);
    refreshButton.addEventListener("click", loadFeed);

    if (oldCommunityPost) {
      oldCommunityPost.hidden = true;
    }
  }

  // =========================================
  // BUILD MY SPACE SOCIAL SETTINGS
  // =========================================

  function buildProfileSocialInterface() {
    const profileEditor = byId("profileEditor");

    if (!profileEditor || byId("everydayPrivacySettings")) {
      return;
    }

    const settings = createElement(
      "div",
      "social-privacy-settings"
    );

    settings.id = "everydayPrivacySettings";

    settings.append(
      createElement("p", "eyebrow", "PROFILE VISIBILITY"),
      createElement("h3", "", "Choose who can follow you."),
      createElement(
        "p",
        "muted",
        "Public profiles can be followed immediately. Private profiles require your approval."
      )
    );

    const label = document.createElement("label");
    label.htmlFor = "socialProfilePrivacy";
    label.textContent = "Profile privacy";

    const select = document.createElement("select");
    select.id = "socialProfilePrivacy";
    select.name = "socialProfilePrivacy";

    const publicOption = document.createElement("option");
    publicOption.value = "public";
    publicOption.textContent = "Public — anyone can follow";

    const privateOption = document.createElement("option");
    privateOption.value = "private";
    privateOption.textContent = "Private — approve follow requests";

    select.append(publicOption, privateOption);

    const saveButton = createElement(
      "button",
      "secondary-button",
      "Save privacy"
    );

    saveButton.type = "button";
    saveButton.id = "saveSocialPrivacy";

    const status = createElement("p", "feedback");
    status.id = "socialPrivacyStatus";
    status.setAttribute("aria-live", "polite");

    settings.append(label, select, saveButton, status);
    profileEditor.append(settings);

    saveButton.addEventListener("click", saveProfilePrivacy);

    buildMemberDiscovery();
  }

  function buildMemberDiscovery() {
    const mySpace = document.querySelector(
      '[data-page="my-space"]'
    );

    if (!mySpace || byId("everydayMemberDiscovery")) {
      return;
    }

    const section = createElement(
      "section",
      "my-space-card social-member-section"
    );

    section.id = "everydayMemberDiscovery";

    const heading = createElement(
      "div",
      "social-section-heading"
    );

    const headingCopy = createElement("div");

    headingCopy.append(
      createElement("p", "eyebrow", "FIND YOUR PEOPLE"),
      createElement("h2", "", "Discover members")
    );

    heading.append(headingCopy);

    const description = createElement(
      "p",
      "muted",
      "Search for people by their nickname. You can follow public profiles or request to follow private profiles."
    );

    const search = document.createElement("input");
    search.type = "search";
    search.id = "socialMemberSearch";
    search.placeholder = "Search by nickname...";
    search.maxLength = 30;
    search.autocomplete = "off";

    const searchResults = createElement(
      "div",
      "social-member-results"
    );

    searchResults.id = "socialMemberResults";

    const requestHeading = createElement(
      "div",
      "social-request-heading"
    );

    requestHeading.append(
      createElement("p", "eyebrow", "YOUR COMMUNITY"),
      createElement("h3", "", "Follow requests")
    );

    const requests = createElement(
      "div",
      "social-request-list"
    );

    requests.id = "socialIncomingRequests";

    section.append(
      heading,
      description,
      search,
      searchResults,
      requestHeading,
      requests
    );

    const grid = mySpace.querySelector(".my-space-grid");

    if (grid) {
      grid.before(section);
    } else {
      mySpace.append(section);
    }

    search.addEventListener("input", () => {
      clearTimeout(searchTimer);

      searchTimer = setTimeout(() => {
        searchMembers(search.value);
      }, 350);
    });
  }

  // =========================================
  // AUTHENTICATION STATE
  // =========================================

  async function getCurrentSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error(
        "EVERYDAY Social session:",
        error.message
      );

      return null;
    }

    return data.session;
  }

  async function handleAuthChange(session) {
    currentUser = session?.user || null;

    const guestNotice = byId("socialGuestNotice");
    const composeInput = byId("socialComposeInput");

    const submitButton = document.querySelector(
      "#socialComposeForm button[type='submit']"
    );

    if (guestNotice) {
      guestNotice.hidden = Boolean(currentUser);
    }

    if (composeInput) {
      composeInput.placeholder = currentUser
        ? "Write something worth sharing..."
        : "Write a thought to save on this device...";
    }

    if (submitButton) {
      submitButton.textContent = currentUser
        ? "Share thought"
        : "Save thought";
    }

    if (!currentUser) {
      currentProfile = null;
      followRelationships = [];
      incomingRequests = [];

      await loadFeed();
      renderIncomingRequests();

      return;
    }

    await Promise.all([
      loadCurrentProfile(),
      loadFollowRelationships(),
      loadIncomingRequests()
    ]);

    await loadFeed();

    updatePrivacyControl();
    await renderIncomingRequests();
  }

  // =========================================
  // PROFILE
  // =========================================

  async function loadCurrentProfile() {
    if (!currentUser) return;

    const { data, error } = await supabase
      .from("user_profiles")
      .select("id,nickname,bio,is_private")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) {
      console.error(
        "EVERYDAY Social profile:",
        error.message
      );

      return;
    }

    currentProfile = data || {
      id: currentUser.id,
      nickname: "",
      bio: "",
      is_private: false
    };

    updatePrivacyControl();
  }

  function updatePrivacyControl() {
    const select = byId("socialProfilePrivacy");

    if (!select) return;

    select.value = currentProfile?.is_private
      ? "private"
      : "public";
  }

  async function saveProfilePrivacy() {
    if (!currentUser) {
      setStatus(
        byId("socialPrivacyStatus"),
        "Please sign in to change profile privacy.",
        true
      );

      return;
    }

    const select = byId("socialProfilePrivacy");
    const status = byId("socialPrivacyStatus");

    if (!select) return;

    const isPrivate = select.value === "private";

    const { error } = await supabase
      .from("user_profiles")
      .upsert(
        {
          id: currentUser.id,
          is_private: isPrivate,
          updated_at: new Date().toISOString()
        },
        { onConflict: "id" }
      );

    if (error) {
      setStatus(status, error.message, true);
      return;
    }

    currentProfile = {
      ...(currentProfile || {}),
      id: currentUser.id,
      is_private: isPrivate
    };

    setStatus(
      status,
      isPrivate
        ? "Your profile is now private."
        : "Your profile is now public."
    );

    await loadCurrentProfile();
    await loadIncomingRequests();

    await renderIncomingRequests();
  }

  // =========================================
  // COMMUNITY POSTS
  // =========================================

  async function handleNewPost(event) {
    event.preventDefault();

    const input = byId("socialComposeInput");
    const text = input?.value.trim();

    if (!text) return;

    if (text.length > MAX_POST_LENGTH) {
      setStatus(
        byId("socialFeedStatus"),
        "Your thought is too long.",
        true
      );

      return;
    }

    const submitButton = document.querySelector(
      "#socialComposeForm button[type='submit']"
    );

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sharing...";
    }

    try {
      if (!currentUser) {
        const posts = getLocalPosts();

        posts.unshift({
          id: crypto.randomUUID(),
          user_id: null,
          text,
          author: "Guest",
          parent_id: null,
          created_at: new Date().toISOString(),
          local: true
        });

        if (!saveLocalPosts(posts)) {
          throw new Error(
            "Your thought could not be saved on this device."
          );
        }

        input.value = "";

        const count = byId("socialCharacterCount");

        if (count) {
          count.textContent = `0 / ${MAX_POST_LENGTH}`;
        }

        await loadFeed();

        return;
      }

      const { error } = await supabase
        .from("community_thoughts")
        .insert({
          user_id: currentUser.id,
          text,
          author: getNickname(),
          parent_id: null
        });

      if (error) throw error;

      input.value = "";

      const count = byId("socialCharacterCount");

      if (count) {
        count.textContent = `0 / ${MAX_POST_LENGTH}`;
      }

      await loadFeed();

    } catch (error) {
      setStatus(
        byId("socialFeedStatus"),
        error.message || "Your thought could not be shared.",
        true
      );

    } finally {
      if (submitButton) {
        submitButton.disabled = false;

        submitButton.textContent = currentUser
          ? "Share thought"
          : "Save thought";
      }
    }
  }

  async function loadFeed() {
    const feed = byId("socialFeed");
    const status = byId("socialFeedStatus");

    if (!feed) return;

    feed.replaceChildren();

    setStatus(status, "Loading community thoughts...");

    const localPosts = getLocalPosts();

    if (!currentUser) {
      feedPosts = localPosts;
      renderFeed();

      return;
    }

    const { data, error } = await supabase
      .from("community_thoughts")
      .select("id,user_id,text,author,parent_id,created_at")
      .order("created_at", { ascending: false })
      .limit(MAX_FEED_POSTS);

    if (error) {
      setStatus(
        status,
        "We couldn't load the community right now. Please try again.",
        true
      );

      console.error(
        "EVERYDAY Social feed:",
        error.message
      );

      // Still show locally saved guest posts if the
      // community feed cannot be loaded.
      feedPosts = localPosts;
      renderFeed();

      return;
    }

    // Keep guest posts visible on this device after login.
    // These posts remain local and are not uploaded to Supabase.
    feedPosts = mergePosts(data || [], localPosts);

    renderFeed();
  }

  function renderFeed() {
    const feed = byId("socialFeed");
    const status = byId("socialFeedStatus");

    if (!feed) return;

    feed.replaceChildren();

    const roots = feedPosts
      .filter((post) => !post.parent_id)
      .sort(
        (a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
      );

    if (!roots.length) {
      setStatus(
        status,
        currentUser
          ? "No thoughts here yet. Be the first to start a conversation."
          : "No local thoughts yet. Share the first one."
      );

      return;
    }

    setStatus(status, "");

    roots.forEach((post) => {
      feed.append(renderPost(post, 0));
    });
  }

  function renderPost(post, depth) {
    const wrapper = createElement(
      "article",
      depth > 0
        ? "social-post social-reply"
        : "social-post"
    );

    const header = createElement(
      "div",
      "social-post-header"
    );

    const avatar = createElement(
      "div",
      "social-post-avatar",
      (post.author || "E").charAt(0).toUpperCase()
    );

    const authorBlock = createElement(
      "div",
      "social-post-author"
    );

    authorBlock.append(
      createElement(
        "strong",
        "",
        post.author || "Everyday member"
      ),
      createElement(
        "span",
        "",
        formatDate(post.created_at)
      )
    );

    header.append(avatar, authorBlock);

    const content = createElement(
      "p",
      "social-post-text",
      post.text
    );

    const actions = createElement(
      "div",
      "social-post-actions"
    );

    // Guest posts exist only in local storage.
    // They cannot be used as Supabase reply parents.
    if (!post.local) {
      const replyButton = createElement(
        "button",
        "text-button",
        "Reply"
      );

      replyButton.type = "button";
      replyButton.dataset.replyTo = post.id;

      actions.append(replyButton);
    } else {
      actions.append(
        createElement(
          "span",
          "social-local-label",
          "Saved on this device"
        )
      );
    }

    const children = feedPosts
      .filter((item) => item.parent_id === post.id)
      .sort(
        (a, b) =>
          new Date(a.created_at) - new Date(b.created_at)
      );

    const childContainer = createElement(
      "div",
      "social-replies"
    );

    // Only server posts can receive replies.
    if (!post.local && depth < 4) {
      const replyForm = createElement(
        "form",
        "social-reply-form"
      );

      replyForm.dataset.parentId = post.id;

      const replyInput = document.createElement("input");
      replyInput.type = "text";
      replyInput.maxLength = MAX_POST_LENGTH;
      replyInput.placeholder = "Write a reply...";
      replyInput.required = true;

      replyInput.setAttribute(
        "aria-label",
        `Reply to ${post.author || "this thought"}`
      );

      const replySubmit = createElement(
        "button",
        "secondary-button",
        "Send"
      );

      replySubmit.type = "submit";

      replyForm.append(replyInput, replySubmit);

      wrapper.append(header, content, actions, replyForm);
    } else {
      wrapper.append(header, content, actions);
    }

    children.forEach((child) => {
      childContainer.append(
        renderPost(child, depth + 1)
      );
    });

    if (children.length) {
      wrapper.append(childContainer);
    }

    return wrapper;
  }

  // =========================================
  // REPLIES
  // =========================================

  async function handleReply(event) {
    const form = event.target.closest(".social-reply-form");

    if (!form) return;

    event.preventDefault();

    if (!currentUser) {
      setStatus(
        byId("socialFeedStatus"),
        "Sign in to reply to community conversations.",
        true
      );

      return;
    }

    const input = form.querySelector("input");
    const text = input?.value.trim();
    const parentId = form.dataset.parentId;

    if (!text || !parentId) return;

    const button = form.querySelector("button");

    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }

    try {
      const { error } = await supabase
        .from("community_thoughts")
        .insert({
          user_id: currentUser.id,
          text,
          author: getNickname(),
          parent_id: parentId
        });

      if (error) throw error;

      await loadFeed();

    } catch (error) {
      setStatus(
        byId("socialFeedStatus"),
        error.message || "Your reply could not be sent.",
        true
      );

      if (button) {
        button.disabled = false;
        button.textContent = "Send";
      }
    }
  }

  // =========================================
  // MEMBER SEARCH
  // =========================================

  async function searchMembers(value) {
    const results = byId("socialMemberResults");

    if (!results) return;

    const requestNumber = ++searchRequestNumber;

    results.replaceChildren();

    if (!currentUser) {
      results.append(
        createElement(
          "p",
          "muted",
          "Sign in to discover and follow other members."
        )
      );

      return;
    }

    const query = escapeSearchTerm(value);

    if (query.length < 2) {
      results.append(
        createElement(
          "p",
          "muted",
          "Enter at least two characters to search."
        )
      );

      return;
    }

    results.append(
      createElement("p", "muted", "Searching...")
    );

    const { data, error } = await supabase
      .from("user_profiles")
      .select("id,nickname,is_private")
      .ilike("nickname", `%${query}%`)
      .neq("id", currentUser.id)
      .limit(20);

    // Ignore older searches that finish after a newer one.
    if (requestNumber !== searchRequestNumber) return;

    results.replaceChildren();

    if (error) {
      results.append(
        createElement(
          "p",
          "social-error",
          "We couldn't search members right now."
        )
      );

      console.error(
        "EVERYDAY member search:",
        error.message
      );

      return;
    }

    if (!data || !data.length) {
      results.append(
        createElement(
          "p",
          "muted",
          "No members found with that nickname."
        )
      );

      return;
    }

    data.forEach((profile) => {
      results.append(renderMember(profile));
    });
  }

  function renderMember(profile) {
    const row = createElement(
      "div",
      "social-member-row"
    );

    const avatar = createElement(
      "div",
      "social-post-avatar",
      (profile.nickname || "E").charAt(0).toUpperCase()
    );

    const details = createElement(
      "div",
      "social-member-details"
    );

    details.append(
      createElement(
        "strong",
        "",
        profile.nickname || "Everyday member"
      ),
      createElement(
        "span",
        "",
        profile.is_private
          ? "Private profile"
          : "Public profile"
      )
    );

    const relationship = getFollowRelationship(profile.id);

    const button = createElement(
      "button",
      "secondary-button social-follow-button",
      getFollowButtonLabel(relationship)
    );

    button.type = "button";
    button.disabled = false;
    button.dataset.followUser = profile.id;

    row.append(avatar, details, button);

    return row;
  }

  // =========================================
  // FOLLOWING / UNFOLLOWING
  // =========================================

  async function loadFollowRelationships() {
    if (!currentUser) {
      followRelationships = [];
      return;
    }

    const { data, error } = await supabase
      .from("user_follows")
      .select("id,follower_id,following_id,status")
      .eq("follower_id", currentUser.id);

    if (error) {
      console.error(
        "EVERYDAY follows:",
        error.message
      );

      return;
    }

    followRelationships = data || [];
  }

  async function followMember(userId, button) {
    if (!currentUser || !userId || !button) return;

    const relationship = getFollowRelationship(userId);

    button.disabled = true;

    try {
      if (relationship) {
        button.textContent = "Updating...";

        // Remove an existing accepted follow or
        // cancel a pending follow request.
        const { error } = await supabase
          .from("user_follows")
          .delete()
          .eq("id", relationship.id)
          .eq("follower_id", currentUser.id);

        if (error) throw error;

        await loadFollowRelationships();

        button.textContent = "Follow";
        button.disabled = false;

        return;
      }

      button.textContent = "Following...";

      const { error } = await supabase
        .from("user_follows")
        .insert({
          follower_id: currentUser.id,
          following_id: userId
        });

      if (error) throw error;

      await loadFollowRelationships();

      const updatedRelationship =
        getFollowRelationship(userId);

      button.textContent =
        getFollowButtonLabel(updatedRelationship);

      button.disabled = false;

    } catch (error) {
      console.error(
        "EVERYDAY follow action:",
        error.message
      );

      button.textContent = relationship
        ? getFollowButtonLabel(relationship)
        : "Follow";

      button.disabled = false;

      setStatus(
        byId("socialPrivacyStatus"),
        error.message || "We couldn't update this follow.",
        true
      );
    }
  }

  // =========================================
  // FOLLOW REQUESTS
  // =========================================

  async function loadIncomingRequests() {
    if (!currentUser) {
      incomingRequests = [];
      return;
    }

    const { data, error } = await supabase
      .from("user_follows")
      .select("id,follower_id,following_id,status")
      .eq("following_id", currentUser.id)
      .eq("status", "pending");

    if (error) {
      console.error(
        "EVERYDAY follow requests:",
        error.message
      );

      incomingRequests = [];
      return;
    }

    incomingRequests = data || [];
  }

  async function getRequestProfiles(requests) {
    const userIds = [
      ...new Set(
        requests.map((request) => request.follower_id)
      )
    ];

    if (!userIds.length) return {};

    const { data, error } = await supabase
      .from("user_profiles")
      .select("id,nickname")
      .in("id", userIds);

    if (error) {
      console.error(
        "EVERYDAY request profiles:",
        error.message
      );

      return {};
    }

    const profiles = {};

    (data || []).forEach((profile) => {
      profiles[profile.id] = profile;
    });

    return profiles;
  }

  async function renderIncomingRequests() {
    const container = byId("socialIncomingRequests");

    if (!container) return;

    container.replaceChildren();

    if (!currentUser) {
      container.append(
        createElement(
          "p",
          "muted",
          "Sign in to receive and manage follow requests."
        )
      );

      return;
    }

    if (!incomingRequests.length) {
      container.append(
        createElement(
          "p",
          "muted",
          "You don't have any pending follow requests."
        )
      );

      return;
    }

    const profiles = await getRequestProfiles(incomingRequests);

    // A newer request list may have replaced this one.
    if (!container.isConnected) return;

    for (const request of incomingRequests) {
      const row = createElement(
        "div",
        "social-request-row"
      );

      const details = createElement(
        "div",
        "social-member-details"
      );

      const requester = profiles[request.follower_id];

      const nickname =
        requester?.nickname || "Everyday member";

      details.append(
        createElement("strong", "", nickname),
        createElement(
          "span",
          "",
          "Would like to follow you."
        )
      );

      const approve = createElement(
        "button",
        "secondary-button",
        "Approve"
      );

      approve.type = "button";
      approve.dataset.approveRequest = request.id;

      const decline = createElement(
        "button",
        "text-button",
        "Decline"
      );

      decline.type = "button";
      decline.dataset.declineRequest = request.id;

      const actions = createElement(
        "div",
        "social-request-actions"
      );

      actions.append(approve, decline);
      row.append(details, actions);

      container.append(row);
    }
  }

  async function approveRequest(requestId) {
    const { error } = await supabase
      .from("user_follows")
      .update({ status: "accepted" })
      .eq("id", requestId)
      .eq("following_id", currentUser.id)
      .eq("status", "pending");

    if (error) {
      console.error(
        "EVERYDAY approve request:",
        error.message
      );

      setStatus(
        byId("socialPrivacyStatus"),
        "We couldn't approve this request.",
        true
      );

      return;
    }

    await loadIncomingRequests();
    await renderIncomingRequests();
  }

  async function declineRequest(requestId) {
    const { error } = await supabase
      .from("user_follows")
      .delete()
      .eq("id", requestId)
      .eq("following_id", currentUser.id);

    if (error) {
      console.error(
        "EVERYDAY decline request:",
        error.message
      );

      setStatus(
        byId("socialPrivacyStatus"),
        "We couldn't decline this request.",
        true
      );

      return;
    }

    await loadIncomingRequests();
    await renderIncomingRequests();
  }

  // =========================================
  // INTERFACE EVENTS
  // =========================================

  document.addEventListener("submit", (event) => {
    if (
      event.target instanceof Element &&
      event.target.matches(".social-reply-form")
    ) {
      handleReply(event);
    }
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;

    const replyButton = event.target.closest(
      "[data-reply-to]"
    );

    if (replyButton) {
      const post = replyButton.closest(".social-post");
      const form = post?.querySelector(".social-reply-form");
      const input = form?.querySelector("input");

      if (!currentUser) {
        setStatus(
          byId("socialFeedStatus"),
          "Sign in to reply to community conversations.",
          true
        );

        return;
      }

      if (form) {
        form.classList.toggle("is-visible");
        input?.focus();
      }

      return;
    }

    const followButton = event.target.closest(
      "[data-follow-user]"
    );

    if (followButton) {
      followMember(
        followButton.dataset.followUser,
        followButton
      );

      return;
    }

    const approveButton = event.target.closest(
      "[data-approve-request]"
    );

    if (approveButton) {
      approveRequest(
        approveButton.dataset.approveRequest
      );

      return;
    }

    const declineButton = event.target.closest(
      "[data-decline-request]"
    );

    if (declineButton) {
      declineRequest(
        declineButton.dataset.declineRequest
      );
    }
  });

  // =========================================
  // STARTUP
  // =========================================

  async function start() {
    buildCommunityInterface();
    buildProfileSocialInterface();

    const session = await getCurrentSession();

    await handleAuthChange(session);

    supabase.auth.onAuthStateChange((event, session) => {
      // Avoid additional Supabase work inside
      // the authentication callback itself.
      setTimeout(() => {
        handleAuthChange(session);
      }, 0);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

})();
