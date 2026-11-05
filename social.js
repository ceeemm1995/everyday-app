
(() => {
  "use strict";

  // =========================================
  // EVERYDAY — SOCIAL COMMUNITY
  // PROFILE PHOTOS + POST MEDIA
  // =========================================

  const supabase = window.everydaySupabase;

  if (!supabase) {
    console.error(
      "EVERYDAY Social: Supabase client was not found. Check app.js."
    );
    return;
  }

  // =========================================
  // CONFIGURATION
  // =========================================

  const LOCAL_KEY = "everyday_local_social_posts";
  const MAX_POST_LENGTH = 1000;

  const AVATAR_BUCKET = "everyday-avatars";
  const MEDIA_BUCKET = "everyday-community-media";

  const AVATAR_MAX_SIZE = 5 * 1024 * 1024;
  const MEDIA_MAX_SIZE = 50 * 1024 * 1024;

  const SIGNED_URL_SECONDS = 60 * 60;

  const AVATAR_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
  ];

  const MEDIA_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime"
  ];

  // =========================================
  // STATE
  // =========================================

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

  function byId(id) {
    return document.getElementById(id);
  }

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

  function setStatus(message, isError = false) {
    const status = byId("socialStatus");

    if (!status) return;

    status.textContent = message || "";
    status.classList.toggle("is-error", isError);
  }

  function setButtonLoading(button, loading, loadingText = "Please wait...") {
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
  }

  function getNickname(profile, fallback = "Everyday member") {
    return (
      profile?.nickname ||
      profile?.author ||
      fallback
    );
  }

  function getInitial(name) {
    return String(name || "?").trim().charAt(0).toUpperCase() || "?";
  }

  function getLocalPosts() {
    try {
      const saved = localStorage.getItem(LOCAL_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Could not read local social posts:", error);
      return [];
    }
  }

  function saveLocalPosts(posts) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(posts));
    } catch (error) {
      console.error("Could not save local social posts:", error);
    }
  }

  function escapeSearchTerm(value) {
    return String(value || "").replace(/[,%()]/g, "");
  }

  function getFollowRelationship(userId) {
    return followRelationships.find(
      (relationship) =>
        relationship.following_id === userId ||
        relationship.follower_id === userId
    );
  }

  function getFollowButtonLabel(userId, isPrivate) {
    const relationship = getFollowRelationship(userId);

    if (!relationship) return "Follow";

    if (relationship.follower_id === currentUser?.id) {
      return relationship.status === "pending"
        ? "Requested"
        : "Following";
    }

    return isPrivate ? "Private profile" : "Follow";
  }

  function mergePosts(serverPosts, localPosts) {
    const combined = [...serverPosts];

    localPosts.forEach((localPost) => {
      const alreadyExists = combined.some(
        (post) => post.id === localPost.id
      );

      if (!alreadyExists) {
        combined.push(localPost);
      }
    });

    return combined.sort(
      (a, b) =>
        new Date(b.created_at || 0) -
        new Date(a.created_at || 0)
    );
  }

  function makeSafeFileName(file) {
    const extension = file.name.split(".").pop() || "file";

    return (
      Date.now() +
      "-" +
      Math.random().toString(36).slice(2, 10) +
      "." +
      extension.toLowerCase()
    );
  }

  function isVideoType(type) {
    return String(type || "").startsWith("video/");
  }

  // =========================================
  // STORAGE HELPERS
  // =========================================

  async function createSignedMediaUrl(bucket, path) {
    if (!path) return null;

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_SECONDS);

    if (error) {
      console.error("Could not create signed media URL:", error);
      return null;
    }

    return data?.signedUrl || null;
  }

  async function uploadAvatar(file) {
    if (!currentUser) {
      throw new Error("Please sign in before uploading a profile picture.");
    }

    if (!AVATAR_TYPES.includes(file.type)) {
      throw new Error("Please choose a JPG, PNG, WEBP, or GIF image.");
    }

    if (file.size > AVATAR_MAX_SIZE) {
      throw new Error("Your profile picture must be 5 MB or smaller.");
    }

    const path =
      currentUser.id + "/" + makeSafeFileName(file);

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    const { error: profileError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          id: currentUser.id,
          avatar_path: path,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: "id"
        }
      );

    if (profileError) {
      await supabase.storage
        .from(AVATAR_BUCKET)
        .remove([path]);

      throw profileError;
    }

    if (currentProfile?.avatar_path) {
      await supabase.storage
        .from(AVATAR_BUCKET)
        .remove([currentProfile.avatar_path]);
    }

    currentProfile = {
      ...currentProfile,
      id: currentUser.id,
      avatar_path: path
    };

    await renderProfileAvatar();
    return path;
  }

  async function uploadPostMedia(file, postId) {
    if (!currentUser) {
      throw new Error("Please sign in to upload photos or videos.");
    }

    if (!MEDIA_TYPES.includes(file.type)) {
      throw new Error(
        "Choose a JPG, PNG, WEBP, GIF, MP4, WEBM, or MOV file."
      );
    }

    if (file.size > MEDIA_MAX_SIZE) {
      throw new Error("Your attachment must be 50 MB or smaller.");
    }

    const path =
      currentUser.id +
      "/" +
      postId +
      "/" +
      makeSafeFileName(file);

    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      throw error;
    }

    return {
      path,
      type: file.type
    };
  }

  // =========================================
  // AVATAR RENDERING
  // =========================================

  function createAvatarElement(name, className = "social-post-avatar") {
    const avatar = createElement("div", className, getInitial(name));
    avatar.setAttribute("aria-label", name + " profile picture");
    return avatar;
  }

  async function applyAvatar(element, path, name, bucket = AVATAR_BUCKET) {
    if (!element) return;

    element.textContent = getInitial(name);

    if (!path) return;

    const url = await createSignedMediaUrl(bucket, path);

    if (!url) return;

    const image = document.createElement("img");

    image.src = url;
    image.alt = name + " profile picture";
    image.loading = "lazy";

    image.addEventListener("error", () => {
      image.remove();
      element.textContent = getInitial(name);
    });

    element.replaceChildren(image);
  }

  async function renderProfileAvatar() {
    const profileEditor = byId("profileEditor");

    if (!profileEditor || !currentProfile) return;

    const avatar = profileEditor.querySelector(
      ".everyday-profile-avatar"
    );

    if (!avatar) return;

    await applyAvatar(
      avatar,
      currentProfile.avatar_path,
      getNickname(currentProfile, "You")
    );
  }

  // =========================================
  // COMMUNITY INTERFACE
  // =========================================

  function buildCommunityInterface() {
    const communityPage = document.querySelector(
      '[data-page="community"]'
    );

    if (!communityPage) return;

    const oldCommunity = byId("community");

    if (oldCommunity) {
      oldCommunity.style.display = "none";
    }

    let root = byId("everydaySocial");

    if (!root) {
      root = createElement("div", "everyday-social");
      root.id = "everydaySocial";
      communityPage.appendChild(root);
    }

    root.innerHTML = "";

    // Composer

    const composerCard = createElement("section", "social-card");
    const heading = createElement("div", "social-section-heading");

    const headingText = createElement("div");
    headingText.appendChild(
      createElement("p", "eyebrow", "COMMUNITY")
    );
    headingText.appendChild(
      createElement("h2", "", "Any thoughts?")
    );

    heading.appendChild(headingText);
    composerCard.appendChild(heading);

    composerCard.appendChild(
      createElement(
        "p",
        "muted",
        "Share an idea, an observation, or something worth discussing."
      )
    );

    const form = createElement("form", "social-compose-form");
    form.id = "socialComposeForm";

    const textarea = document.createElement("textarea");
    textarea.id = "socialPostInput";
    textarea.maxLength = MAX_POST_LENGTH;
    textarea.placeholder = "Write something worth sharing...";
    textarea.required = true;
    textarea.setAttribute("aria-label", "Write a community post");

    form.appendChild(textarea);

    // Media attachment

    const attachmentArea = createElement(
      "div",
      "social-attachment-area"
    );

    const attachmentLabel = createElement(
      "label",
      "social-attachment-button",
      "＋ Add photo or video"
    );

    attachmentLabel.htmlFor = "socialMediaInput";

    const mediaInput = document.createElement("input");
    mediaInput.type = "file";
    mediaInput.id = "socialMediaInput";
    mediaInput.accept =
      "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
    mediaInput.hidden = true;

    const mediaPreview = createElement(
      "div",
      "social-media-preview"
    );
    mediaPreview.id = "socialMediaPreview";

    attachmentArea.appendChild(attachmentLabel);
    attachmentArea.appendChild(mediaInput);
    attachmentArea.appendChild(mediaPreview);

    form.appendChild(attachmentArea);

    // Footer

    const footer = createElement("div", "social-compose-footer");

    const characterCount = createElement(
      "span",
      "social-character-count",
      "0/1000"
    );

    characterCount.id = "socialCharacterCount";

    const submit = createElement(
      "button",
      "primary-button",
      "Save thought"
    );

    submit.type = "submit";

    footer.appendChild(characterCount);
    footer.appendChild(submit);

    form.appendChild(footer);

    composerCard.appendChild(form);

    const notice = createElement(
      "p",
      "social-notice",
      "Your public nickname is shown with your posts. Your email address is not displayed."
    );

    notice.id = "socialGuestNotice";

    composerCard.appendChild(notice);
    root.appendChild(composerCard);

    // Feed

    const feedCard = createElement(
      "section",
      "social-card social-feed-card"
    );

    const feedHeading = createElement(
      "div",
      "social-section-heading"
    );

    feedHeading.appendChild(
      createElement("h2", "", "Community")
    );

    const refreshButton = createElement(
      "button",
      "text-button",
      "Refresh"
    );

    refreshButton.type = "button";
    refreshButton.id = "socialRefreshButton";

    feedHeading.appendChild(refreshButton);
    feedCard.appendChild(feedHeading);

    const status = createElement("p", "social-status");
    status.id = "socialStatus";

    const feed = createElement("div", "social-feed");
    feed.id = "socialFeed";

    feedCard.appendChild(status);
    feedCard.appendChild(feed);

    root.appendChild(feedCard);

    // Member discovery

    const memberSection = createElement(
      "section",
      "social-member-section"
    );

    memberSection.appendChild(
      createElement("h2", "", "Find people")
    );

    memberSection.appendChild(
      createElement(
        "p",
        "muted",
        "Discover members by their public nickname."
      )
    );

    const search = document.createElement("input");
    search.id = "socialMemberSearch";
    search.type = "search";
    search.placeholder = "Search nicknames...";
    search.autocomplete = "off";

    memberSection.appendChild(search);

    const memberResults = createElement(
      "div",
      "social-member-results"
    );

    memberResults.id = "socialMemberResults";

    memberSection.appendChild(memberResults);

    const requestHeading = createElement(
      "div",
      "social-request-heading"
    );

    requestHeading.appendChild(
      createElement("h3", "", "Follow requests")
    );

    memberSection.appendChild(requestHeading);

    const requestList = createElement(
      "div",
      "social-request-list"
    );

    requestList.id = "socialRequestList";

    memberSection.appendChild(requestList);
    root.appendChild(memberSection);

    // Events

    textarea.addEventListener("input", () => {
      characterCount.textContent =
        textarea.value.length + "/" + MAX_POST_LENGTH;
    });

    mediaInput.addEventListener("change", previewSelectedMedia);

    form.addEventListener("submit", handleNewPost);

    refreshButton.addEventListener("click", loadFeed);

    search.addEventListener("input", () => {
      clearTimeout(searchTimer);

      searchTimer = setTimeout(() => {
        searchMembers(search.value);
      }, 350);
    });

    mediaPreview.addEventListener("click", (event) => {
      if (event.target.closest("[data-remove-media]")) {
        mediaInput.value = "";
        mediaPreview.replaceChildren();
      }
    });

    feed.addEventListener("click", handleFeedClick);

    feed.addEventListener("submit", handleReply);

    memberSection.addEventListener("click", handleMemberClick);
  }

  // =========================================
  // MEDIA PREVIEW
  // =========================================

  function previewSelectedMedia() {
    const input = byId("socialMediaInput");
    const preview = byId("socialMediaPreview");

    if (!input || !preview) return;

    preview.replaceChildren();

    const file = input.files?.[0];

    if (!file) return;

    if (!MEDIA_TYPES.includes(file.type)) {
      input.value = "";
      setStatus("That file type is not supported.", true);
      return;
    }

    if (file.size > MEDIA_MAX_SIZE) {
      input.value = "";
      setStatus("Your attachment must be 50 MB or smaller.", true);
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    let media;

    if (isVideoType(file.type)) {
      media = document.createElement("video");
      media.controls = true;
      media.preload = "metadata";
    } else {
      media = document.createElement("img");
      media.alt = "Selected post attachment preview";
    }

    media.src = objectUrl;

    media.addEventListener("error", () => {
      setStatus("Could not preview this attachment.", true);
    });

    const removeButton = createElement(
      "button",
      "social-remove-media",
      "Remove"
    );

    removeButton.type = "button";
    removeButton.dataset.removeMedia = "true";

    preview.appendChild(media);
    preview.appendChild(removeButton);

    setStatus("");
  }

  // =========================================
  // CREATE COMMUNITY POST
  // =========================================

  async function handleNewPost(event) {
    event.preventDefault();

    const input = byId("socialPostInput");
    const mediaInput = byId("socialMediaInput");
    const button = event.currentTarget.querySelector(
      'button[type="submit"]'
    );

    if (!input) return;

    const text = input.value.trim();
    const file = mediaInput?.files?.[0] || null;

    if (!text && !file) {
      setStatus("Write something or attach a photo or video.", true);
      return;
    }

    if (text.length > MAX_POST_LENGTH) {
      setStatus("Your post is too long.", true);
      return;
    }

    // Guest posts are local text-only posts.

    if (!currentUser) {
      if (file) {
        setStatus(
          "Please sign in to upload photos and videos. Guest posts can be text-only.",
          true
        );
        return;
      }

      const localPost = {
        id: "local-" + Date.now(),
        text,
        author: "Guest",
        user_id: null,
        parent_id: null,
        media_path: null,
        media_type: null,
        created_at: new Date().toISOString(),
        is_local: true
      };

      const posts = getLocalPosts();
      posts.unshift(localPost);
      saveLocalPosts(posts);

      input.value = "";
      byId("socialCharacterCount").textContent = "0/1000";

      await loadFeed();
      setStatus("Your thought has been saved on this device.");
      return;
    }

    setButtonLoading(button, true, "Sharing...");
    setStatus("");

    let uploadedPath = null;

    try {
      const postId = crypto.randomUUID();

      let mediaPath = null;
      let mediaType = null;

      if (file) {
        const uploaded = await uploadPostMedia(file, postId);

        mediaPath = uploaded.path;
        mediaType = uploaded.type;
        uploadedPath = uploaded.path;
      }

      const nickname = getNickname(
        currentProfile,
        "Everyday member"
      );

      const { error } = await supabase
        .from("community_thoughts")
        .insert({
          id: postId,
          user_id: currentUser.id,
          text: text || (
            isVideoType(mediaType)
              ? "Shared a video."
              : "Shared a photo."
          ),
          author: nickname,
          parent_id: null,
          media_path: mediaPath,
          media_type: mediaType
        });

      if (error) {
        if (uploadedPath) {
          await supabase.storage
            .from(MEDIA_BUCKET)
            .remove([uploadedPath]);
        }

        throw error;
      }

      input.value = "";

      if (mediaInput) {
        mediaInput.value = "";
      }

      byId("socialCharacterCount").textContent = "0/1000";

      byId("socialMediaPreview")?.replaceChildren();

      await loadFeed();

      setStatus("Your thought has been shared.");
    } catch (error) {
      console.error("Could not create community post:", error);

      setStatus(
        error.message || "Could not share your post. Please try again.",
        true
      );
    } finally {
      setButtonLoading(button, false);
    }
  }

  // =========================================
  // LOAD FEED
  // =========================================

  async function loadFeed() {
    const feed = byId("socialFeed");

    if (!feed) return;

    setStatus("Loading community posts...");

    const localPosts = getLocalPosts();

    if (!currentUser) {
      feedPosts = localPosts;
      await renderFeed();
      setStatus("");
      return;
    }

    const { data, error } = await supabase
      .from("community_thoughts")
      .select(
        "id,user_id,text,author,parent_id,created_at,media_path,media_type"
      )
      .order("created_at", {
        ascending: false
      })
      .limit(500);

    if (error) {
      console.error("Could not load community feed:", error);

      feedPosts = localPosts;

      await renderFeed();

      setStatus(
        "Could not load shared posts. Showing locally saved posts.",
        true
      );

      return;
    }

    feedPosts = mergePosts(data || [], localPosts);

    await renderFeed();

    setStatus("");
  }

  // =========================================
  // RENDER FEED
  // =========================================

  async function renderFeed() {
    const feed = byId("socialFeed");

    if (!feed) return;

    feed.replaceChildren();

    const rootPosts = feedPosts.filter(
      (post) => !post.parent_id
    );

    if (!rootPosts.length) {
      feed.appendChild(
        createElement(
          "p",
          "muted",
          "No posts yet. Be the first to share a thought."
        )
      );

      return;
    }

    for (const post of rootPosts) {
      const postElement = await renderPost(post, 0);

      feed.appendChild(postElement);
    }
  }

  async function renderPost(post, depth = 0) {
    const wrapper = createElement(
      "article",
      depth > 0
        ? "social-post social-reply"
        : "social-post"
    );

    wrapper.dataset.postId = post.id;

    const header = createElement("div", "social-post-header");

    const author = post.author || "Everyday member";

    const avatar = createAvatarElement(author);

    header.appendChild(avatar);

    const authorDetails = createElement(
      "div",
      "social-post-author"
    );

    authorDetails.appendChild(
      createElement("strong", "", author)
    );

    authorDetails.appendChild(
      createElement(
        "span",
        "",
        formatDate(post.created_at)
      )
    );

    header.appendChild(authorDetails);
    wrapper.appendChild(header);

    await applyAvatar(
      avatar,
      post.avatar_path,
      author
    );

    const text = createElement(
      "p",
      "social-post-text",
      post.text || ""
    );

    wrapper.appendChild(text);

    // Media attachment

    if (post.media_path && post.media_type) {
      const mediaUrl = await createSignedMediaUrl(
        MEDIA_BUCKET,
        post.media_path
      );

      if (mediaUrl) {
        const mediaContainer = createElement(
          "div",
          "social-post-media"
        );

        if (isVideoType(post.media_type)) {
          const video = document.createElement("video");

          video.src = mediaUrl;
          video.controls = true;
          video.preload = "metadata";
          video.playsInline = true;

          mediaContainer.appendChild(video);
        } else {
          const image = document.createElement("img");

          image.src = mediaUrl;
          image.alt = "Community post attachment";
          image.loading = "lazy";

          mediaContainer.appendChild(image);
        }

        wrapper.appendChild(mediaContainer);
      }
    }

    if (post.is_local) {
      wrapper.appendChild(
        createElement(
          "span",
          "social-local-label",
          "Saved on this device"
        )
      );
    }

    // Actions

    const actions = createElement(
      "div",
      "social-post-actions"
    );

    if (!post.is_local && currentUser) {
      const replyButton = createElement(
        "button",
        "text-button",
        "Reply"
      );

      replyButton.type = "button";
      replyButton.dataset.replyTo = post.id;

      actions.appendChild(replyButton);
    }

    wrapper.appendChild(actions);

    // Reply form

    if (
      !post.is_local &&
      currentUser &&
      depth < 4
    ) {
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

      const replySubmit = createElement(
        "button",
        "primary-button",
        "Reply"
      );

      replySubmit.type = "submit";

      replyForm.appendChild(replyInput);
      replyForm.appendChild(replySubmit);

      wrapper.appendChild(replyForm);
    }

    // Nested replies

    const children = feedPosts.filter(
      (item) => item.parent_id === post.id
    );

    if (children.length) {
      const replies = createElement(
        "div",
        "social-replies"
      );

      for (const child of children) {
        const childElement = await renderPost(
          child,
          depth + 1
        );

        replies.appendChild(childElement);
      }

      wrapper.appendChild(replies);
    }

    return wrapper;
  }

  // =========================================
  // FEED INTERACTIONS
  // =========================================

  function handleFeedClick(event) {
    const replyButton = event.target.closest(
      "[data-reply-to]"
    );

    if (!replyButton) return;

    const post = replyButton.closest(".social-post");

    const form = post?.querySelector(
      ".social-reply-form"
    );

    if (!form) return;

    form.classList.toggle("is-visible");

    if (form.classList.contains("is-visible")) {
      form.querySelector("input")?.focus();
    }
  }

  async function handleReply(event) {
    const form = event.target.closest(
      ".social-reply-form"
    );

    if (!form) return;

    event.preventDefault();

    if (!currentUser) {
      setStatus("Please sign in to reply.", true);
      return;
    }

    const input = form.querySelector("input");
    const button = form.querySelector("button");

    const text = input.value.trim();

    if (!text) return;

    const parentId = form.dataset.parentId;

    setButtonLoading(button, true, "Sending...");

    try {
      const nickname = getNickname(
        currentProfile,
        "Everyday member"
      );

      const { error } = await supabase
        .from("community_thoughts")
        .insert({
          user_id: currentUser.id,
          text,
          author: nickname,
          parent_id: parentId
        });

      if (error) throw error;

      await loadFeed();
      setStatus("Your reply has been shared.");
    } catch (error) {
      console.error("Could not send reply:", error);

      setStatus(
        error.message || "Could not send your reply.",
        true
      );
    } finally {
      setButtonLoading(button, false);
    }
  }

  // =========================================
  // PROFILE PICTURE INTERFACE
  // =========================================

  function buildProfileAvatarInterface() {
    const profileEditor = byId("profileEditor");

    if (!profileEditor) return;

    let avatarArea = byId("everydayAvatarSettings");

    if (!avatarArea) {
      avatarArea = createElement(
        "div",
        "everyday-avatar-settings"
      );

      avatarArea.id = "everydayAvatarSettings";

      const heading = createElement(
        "h3",
        "",
        "Profile picture"
      );

      const avatar = createAvatarElement(
        "You",
        "everyday-profile-avatar"
      );

      avatar.id = "everydayProfileAvatar";

      const label = createElement(
        "label",
        "social-attachment-button",
        "Change profile picture"
      );

      label.htmlFor = "everydayAvatarInput";

      const input = document.createElement("input");

      input.type = "file";
      input.id = "everydayAvatarInput";
      input.accept = "image/jpeg,image/png,image/webp,image/gif";
      input.hidden = true;

      const feedback = createElement(
        "p",
        "feedback"
      );

      feedback.id = "everydayAvatarFeedback";

      avatarArea.appendChild(heading);
      avatarArea.appendChild(avatar);
      avatarArea.appendChild(label);
      avatarArea.appendChild(input);
      avatarArea.appendChild(feedback);

      profileEditor.prepend(avatarArea);

      input.addEventListener("change", handleAvatarSelection);
    }
  }

  async function handleAvatarSelection(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) return;

    const feedback = byId("everydayAvatarFeedback");

    if (!currentUser) {
      if (feedback) {
        feedback.textContent =
          "Please sign in to upload a profile picture.";
      }

      input.value = "";
      return;
    }

    if (feedback) {
      feedback.textContent = "Uploading profile picture...";
    }

    try {
      await uploadAvatar(file);

      if (feedback) {
        feedback.textContent =
          "Your profile picture has been updated.";
      }
    } catch (error) {
      console.error("Avatar upload failed:", error);

      if (feedback) {
        feedback.textContent =
          error.message || "Could not upload your picture.";
      }
    } finally {
      input.value = "";
    }
  }

  // =========================================
  // PROFILE PRIVACY INTERFACE
  // =========================================

  function buildProfileSocialInterface() {
    const profileEditor = byId("profileEditor");

    if (!profileEditor) return;

    let settings = byId("socialPrivacySettings");

    if (settings) return;

    settings = createElement(
      "section",
      "social-privacy-settings"
    );

    settings.id = "socialPrivacySettings";

    settings.appendChild(
      createElement("h3", "", "Profile visibility")
    );

    settings.appendChild(
      createElement(
        "p",
        "muted",
        "Choose who can view your community profile and posts."
      )
    );

    const label = createElement(
      "label",
      "",
      "Who can see your profile?"
    );

    label.htmlFor = "socialProfilePrivacy";

    const select = document.createElement("select");
    select.id = "socialProfilePrivacy";

    const publicOption = document.createElement("option");
    publicOption.value = "public";
    publicOption.textContent = "Public";

    const privateOption = document.createElement("option");
    privateOption.value = "private";
    privateOption.textContent = "Private";

    select.appendChild(publicOption);
    select.appendChild(privateOption);

    const saveButton = createElement(
      "button",
      "primary-button",
      "Save privacy settings"
    );

    saveButton.type = "button";
    saveButton.id = "socialSavePrivacy";

    const feedback = createElement("p", "feedback");
    feedback.id = "socialPrivacyFeedback";

    settings.appendChild(label);
    settings.appendChild(select);
    settings.appendChild(saveButton);
    settings.appendChild(feedback);

    profileEditor.appendChild(settings);

    saveButton.addEventListener(
      "click",
      saveProfilePrivacy
    );
  }

  async function saveProfilePrivacy() {
    if (!currentUser) return;

    const select = byId("socialProfilePrivacy");
    const button = byId("socialSavePrivacy");
    const feedback = byId("socialPrivacyFeedback");

    if (!select) return;

    const isPrivate = select.value === "private";

    setButtonLoading(button, true, "Saving...");

    try {
      const { error } = await supabase
        .from("user_profiles")
        .upsert(
          {
            id: currentUser.id,
            is_private: isPrivate,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: "id"
          }
        );

      if (error) throw error;

      currentProfile = {
        ...currentProfile,
        is_private: isPrivate
      };

      if (feedback) {
        feedback.textContent = "Privacy settings saved.";
      }

      await loadFeed();
    } catch (error) {
      console.error("Could not save privacy settings:", error);

      if (feedback) {
        feedback.textContent =
          error.message || "Could not save settings.";
      }
    } finally {
      setButtonLoading(button, false);
    }
  }

  // =========================================
  // LOAD PROFILE
  // =========================================

  async function loadCurrentProfile() {
    if (!currentUser) return;

    const { data, error } = await supabase
      .from("user_profiles")
      .select(
        "id,nickname,bio,is_private,avatar_path"
      )
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) {
      console.error("Could not load profile:", error);
    }

    currentProfile = data || {
      id: currentUser.id,
      nickname: "Everyday member",
      bio: "",
      is_private: false,
      avatar_path: null
    };

    const privacySelect = byId("socialProfilePrivacy");

    if (privacySelect) {
      privacySelect.value = currentProfile.is_private
        ? "private"
        : "public";
    }

    await renderProfileAvatar();
  }

  // =========================================
  // MEMBER SEARCH
  // =========================================

  async function searchMembers(query) {
    const results = byId("socialMemberResults");

    if (!results) return;

    const search = escapeSearchTerm(query).trim();

    const requestNumber = ++searchRequestNumber;

    results.replaceChildren();

    if (!search) return;

    if (!currentUser) {
      results.appendChild(
        createElement(
          "p",
          "muted",
          "Sign in to discover and follow members."
        )
      );

      return;
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("id,nickname,bio,is_private,avatar_path")
      .ilike("nickname", "%" + search + "%")
      .neq("id", currentUser.id)
      .limit(15);

    if (requestNumber !== searchRequestNumber) return;

    if (error) {
      console.error("Member search failed:", error);
      results.appendChild(
        createElement("p", "muted", "Could not search members.")
      );
      return;
    }

    if (!data?.length) {
      results.appendChild(
        createElement("p", "muted", "No members found.")
      );

      return;
    }

    for (const profile of data) {
      const row = await renderMember(profile);
      results.appendChild(row);
    }
  }

  async function renderMember(profile) {
    const row = createElement(
      "div",
      "social-member-row"
    );

    const avatar = createAvatarElement(
      profile.nickname,
      "social-post-avatar"
    );

    row.appendChild(avatar);

    await applyAvatar(
      avatar,
      profile.avatar_path,
      profile.nickname
    );

    const details = createElement(
      "div",
      "social-member-details"
    );

    details.appendChild(
      createElement(
        "strong",
        "",
        profile.nickname || "Everyday member"
      )
    );

    details.appendChild(
      createElement(
        "span",
        "",
        profile.is_private ? "Private profile" : "Public profile"
      )
    );

    row.appendChild(details);

    if (currentUser) {
      const button = createElement(
        "button",
        "secondary-button social-follow-button",
        getFollowButtonLabel(
          profile.id,
          profile.is_private
        )
      );

      button.type = "button";
      button.dataset.followUser = profile.id;
      button.disabled =
        getFollowButtonLabel(
          profile.id,
          profile.is_private
        ) !== "Follow";

      row.appendChild(button);
    }

    return row;
  }

  // =========================================
  // FOLLOW RELATIONSHIPS
  // =========================================

  async function loadFollowRelationships() {
    if (!currentUser) return;

    const { data, error } = await supabase
      .from("user_follows")
      .select("id,follower_id,following_id,status")
      .or(
        "follower_id.eq." +
        currentUser.id +
        ",following_id.eq." +
        currentUser.id
      );

    if (error) {
      console.error("Could not load follow relationships:", error);
      return;
    }

    followRelationships = data || [];
  }

  async function followMember(userId) {
    if (!currentUser || !userId) return;

    const existing = followRelationships.find(
      (relationship) =>
        relationship.follower_id === currentUser.id &&
        relationship.following_id === userId
    );

    if (existing) {
      return;
    }

    const { error } = await supabase
      .from("user_follows")
      .insert({
        follower_id: currentUser.id,
        following_id: userId
      });

    if (error) {
      console.error("Could not follow member:", error);
      setStatus(
        error.message || "Could not follow this member.",
        true
      );
      return;
    }

    await loadFollowRelationships();

    setStatus("Your follow request has been sent.");

    const search = byId("socialMemberSearch");

    if (search?.value) {
      await searchMembers(search.value);
    }
  }

  // =========================================
  // FOLLOW REQUESTS
  // =========================================

  async function loadIncomingRequests() {
    if (!currentUser) return;

    const { data, error } = await supabase
      .from("user_follows")
      .select("id,follower_id,following_id,status")
      .eq("following_id", currentUser.id)
      .eq("status", "pending");

    if (error) {
      console.error("Could not load follow requests:", error);
      return;
    }

    incomingRequests = data || [];

    await renderIncomingRequests();
  }

  async function renderIncomingRequests() {
    const list = byId("socialRequestList");

    if (!list) return;

    list.replaceChildren();

    if (!currentUser || !incomingRequests.length) {
      list.appendChild(
        createElement(
          "p",
          "muted",
          currentUser
            ? "No pending follow requests."
            : "Sign in to manage follow requests."
        )
      );

      return;
    }

    const ids = incomingRequests.map(
      (request) => request.follower_id
    );

    const { data, error } = await supabase
      .from("user_profiles")
      .select("id,nickname")
      .in("id", ids);

    if (error) {
      console.error("Could not load requester profiles:", error);
      return;
    }

    for (const request of incomingRequests) {
      const profile = data?.find(
        (item) => item.id === request.follower_id
      );

      const row = createElement(
        "div",
        "social-request-row"
      );

      row.appendChild(
        createElement(
          "strong",
          "",
          profile?.nickname || "Everyday member"
        )
      );

      const actions = createElement(
        "div",
        "social-request-actions"
      );

      const approve = createElement(
        "button",
        "primary-button",
        "Approve"
      );

      approve.type = "button";
      approve.dataset.approveRequest = request.id;

      const decline = createElement(
        "button",
        "secondary-button",
        "Decline"
      );

      decline.type = "button";
      decline.dataset.declineRequest = request.id;

      actions.appendChild(approve);
      actions.appendChild(decline);

      row.appendChild(actions);
      list.appendChild(row);
    }
  }

  async function approveRequest(requestId) {
    const request = incomingRequests.find(
      (item) => item.id === requestId
    );

    if (!request) return;

    const { error } = await supabase
      .from("user_follows")
      .update({
        status: "accepted"
      })
      .eq("id", requestId)
      .eq("following_id", currentUser.id);

    if (error) {
      console.error("Could not approve request:", error);
      setStatus("Could not approve this request.", true);
      return;
    }

    await loadIncomingRequests();
    await loadFollowRelationships();

    setStatus("Follow request approved.");
  }

  async function declineRequest(requestId) {
    const { error } = await supabase
      .from("user_follows")
      .delete()
      .eq("id", requestId)
      .eq("following_id", currentUser.id);

    if (error) {
      console.error("Could not decline request:", error);
      setStatus("Could not decline this request.", true);
      return;
    }

    await loadIncomingRequests();
    setStatus("Follow request declined.");
  }

  async function handleMemberClick(event) {
    const followButton = event.target.closest(
      "[data-follow-user]"
    );

    const approveButton = event.target.closest(
      "[data-approve-request]"
    );

    const declineButton = event.target.closest(
      "[data-decline-request]"
    );

    if (followButton) {
      await followMember(followButton.dataset.followUser);
      return;
    }

    if (approveButton) {
      await approveRequest(
        approveButton.dataset.approveRequest
      );
      return;
    }

    if (declineButton) {
      await declineRequest(
        declineButton.dataset.declineRequest
      );
    }
  }

  // =========================================
  // AUTHENTICATION
  // =========================================

  async function getCurrentSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Could not retrieve session:", error);
      return;
    }

    await handleAuthChange(data.session);
  }

  async function handleAuthChange(session) {
    currentUser = session?.user || null;

    const notice = byId("socialGuestNotice");

    if (!currentUser) {
      currentProfile = null;
      followRelationships = [];
      incomingRequests = [];

      if (notice) {
        notice.textContent =
          "You're browsing as a guest. Your text-only posts are saved on this device. Sign in to upload media and follow members.";
      }

      await loadFeed();
      await renderIncomingRequests();

      return;
    }

    if (notice) {
      notice.textContent =
        "Share your thoughts, upload photos and videos, and connect with the community.";
    }

    await loadCurrentProfile();
    await loadFollowRelationships();
    await loadIncomingRequests();
    await loadFeed();

    const search = byId("socialMemberSearch");

    if (search?.value) {
      await searchMembers(search.value);
    }
  }

  // =========================================
  // STARTUP
  // =========================================

  function initialize() {
    buildCommunityInterface();
    buildProfileAvatarInterface();
    buildProfileSocialInterface();

    getCurrentSession();

    supabase.auth.onAuthStateChange(
      async (_event, session) => {
        await handleAuthChange(session);
      }
    );
  }

  initialize();
})();
