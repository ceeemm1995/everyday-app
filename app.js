const SUPABASE_URL = 'https://ufzfrhezueypxauppkwy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zRrCIKmSjQ8CIuMc1uq3xw_kpFb6twh';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const activities = {
  Curious: [
    {type:"QUICK TRIVIA",symbol:"✳",title:"A little knowledge goes a long way",description:"Try a quick question and see what you know.",question:"Which planet is known for its prominent rings?",answers:["Earth","Saturn","Mars","Venus"],correct:"Saturn",explain:"Saturn is famous for its extensive ring system."},
    {type:"EVERYDAY KNOWLEDGE",symbol:"⌁",title:"Think about the everyday",description:"A small question about the world around us.",question:"Which material is commonly used to make traditional glass?",answers:["Sand (silica)","Wood","Cotton","Clay only"],correct:"Sand (silica)",explain:"Silica, often sourced from sand, is a primary ingredient in ordinary glass."}
  ],
  Playful: [
    {type:"BRAIN GAME",symbol:"◉",title:"Word detective",description:"A tiny riddle to warm up your thinking.",question:"What has keys but cannot open locks?",answers:["A piano","A map","A door","A clock"],correct:"A piano",explain:"A piano has musical keys, not door keys."},
    {type:"QUICK RIDDLE",symbol:"?",title:"One for your brain",description:"Take a moment and think it through.",question:"What gets wetter the more it dries?",answers:["A towel","A sponge","Rain","A cloud"],correct:"A towel",explain:"A towel absorbs water as it dries something else."}
  ],
  Creative: [
    {type:"CREATIVE CHALLENGE",symbol:"✎",title:"One-minute creator",description:"There is more than one right way to imagine.",question:"Invent a new use for an empty glass bottle.",answers:["A miniature garden","A desk organizer","A lamp","All of these"],correct:"All of these",explain:"Creativity is about seeing possibilities. All are valid ideas!"},
    {type:"IMAGINATION PROMPT",symbol:"✧",title:"Make something from nothing",description:"A small creative exercise for an ordinary day.",question:"If you could redesign one everyday object, what would you choose?",answers:["A backpack","A water bottle","A chair","A kitchen tool"],correct:null,explain:"There is no wrong answer. Pick one and imagine how you would improve it."}
  ],
  Social: [
    {type:"COMMUNITY ACTIVITY",symbol:"◎",title:"Two perspectives",description:"A friendly question to compare different points of view.",question:"What makes a perfect weekend?",answers:["Adventure","Rest and relaxation","Learning something new","Spending time with people"],correct:null,explain:"Everyone has a different idea of a good weekend. Share yours with someone!"},
    {type:"CONVERSATION STARTER",symbol:"♡",title:"Find common ground",description:"A question you can ask a friend or a new acquaintance.",question:"What is something you would love to learn?",answers:["A language","A creative skill","A practical skill","Something completely new"],correct:null,explain:"Use this as a conversation starter. You might discover a shared interest."}
  ],
  Productive: [
    {type:"LIFE CHALLENGE",symbol:"↗",title:"The ten-minute reset",description:"A tiny action can make the day feel lighter.",question:"Choose one small task you can finish in ten minutes.",answers:["Organize my space","Plan tomorrow","Clear my inbox","Learn one useful skill"],correct:null,explain:"Choose one action and give it ten focused minutes."},
    {type:"SMALL STEP",symbol:"✓",title:"Make tomorrow easier",description:"Do one small thing now for your future self.",question:"What would help you tomorrow?",answers:["Prepare what I need","Write a short plan","Tidy one area","Set a reminder"],correct:null,explain:"Small preparation can make tomorrow feel more manageable."}
  ],
  Relaxed: [
    {type:"MINI RESET",symbol:"☼",title:"A moment of calm",description:"Pause for a moment and check in with yourself.",question:"What would help you feel refreshed right now?",answers:["A little quiet","A short walk","Some music","A glass of water"],correct:null,explain:"Choose what feels helpful for you. A short pause counts."},
    {type:"GENTLE PROMPT",symbol:"☁",title:"Notice the little things",description:"A gentle reminder to slow down for a moment.",question:"Which small moment would you like more of?",answers:["A quiet morning","A good conversation","Time outdoors","A creative break"],correct:null,explain:"Noticing what restores you can help you make room for it."}
  ]
};

const thoughts = [
  "Curiosity is a good place to begin.",
  "Small progress is still progress.",
  "A new perspective can start with one good question.",
  "You don't have to do everything today.",
  "There is always something new to notice.",
  "Make room for a little wonder."
];

let mood = "Curious";
let activityIndex = 0;
let completed = Number(localStorage.getItem("everydayCompleted") || 0);
let currentUser = null;
let deferredInstall = null;

const $ = id => document.getElementById(id);

const guestView = $('guest-view');
const userView = $('user-view');
const userEmailTag = $('userEmailTag');
const openAuthModalBtn = $('openAuthModal');
const closeAuthModalBtn = $('closeAuthModal');
const authModal = $('authModal');
const magicLinkForm = $('magicLinkForm');
const authEmailInput = $('authEmailInput');
const authStatusMessage = $('authStatusMessage');
const logoutBtn = $('logoutBtn');
const streakNotice = $('streakNotice');

if (openAuthModalBtn) openAuthModalBtn.addEventListener('click', () => authModal.showModal());
if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', () => authModal.close());

async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  updateAuthUI(session);
}

function updateAuthUI(session) {
  if (session) {
    currentUser = session.user;
    if (guestView) guestView.style.display = 'none';
    if (userView) userView.style.display = 'flex';
    if (userEmailTag) userEmailTag.textContent = currentUser.email;
    if (streakNotice) streakNotice.textContent = 'Your everyday activity is synced to your account.';
    if (authModal && authModal.open) authModal.close();
    
    syncUserCloudData();
  } else {
    currentUser = null;
    if (guestView) guestView.style.display = 'flex';
    if (userView) userView.style.display = 'none';
    if (streakNotice) streakNotice.textContent = 'Your completed activities stay on this device in guest mode.';
  }
}

if (magicLinkForm) {
  magicLinkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmailInput.value;
    authStatusMessage.style.display = 'block';
    authStatusMessage.textContent = 'Sending magic link...';

    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: window.location.origin }
    });

    if (error) {
      authStatusMessage.textContent = `Error: ${error.message}`;
      authStatusMessage.style.color = '#ef4444';
    } else {
      authStatusMessage.textContent = '✨ Check your email! We sent you a magic login link.';
      authStatusMessage.style.color = '#10b981';
      authEmailInput.value = '';
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.reload();
  });
}

supabase.auth.onAuthStateChange((_event, session) => {
  updateAuthUI(session);
});

async function syncUserCloudData() {
  if (!currentUser) return;
  
  const { data } = await supabase
    .from('user_profiles')
    .select('completed_count')
    .eq('id', currentUser.id)
    .single();

  if (data && data.completed_count > completed) {
    completed = data.completed_count;
    localStorage.setItem("everydayCompleted", String(completed));
    $("completedCount").textContent = completed;
  } else {
    
    await supabase
      .from('user_profiles')
      .upsert({ id: currentUser.id, completed_count: completed });
  }
}

function currentActivity() {
  const list = activities[mood];
  return list[activityIndex % list.length];
}

function renderActivity() {
  const a = currentActivity();
  $("activityType").textContent = a.type;
  $("activitySymbol").textContent = a.symbol;
  $("activityTitle").textContent = a.title;
  $("activityDescription").textContent = a.description;
  $("activityQuestion").textContent = a.question;
  $("answerFeedback").textContent = "";
  $("progressText").textContent = "A small moment for yourself";
  $("answerList").innerHTML = "";

  a.answers.forEach(answer => {
    const b = document.createElement("button");
    b.className = "answer";
    b.textContent = answer;
    b.type = "button";
    b.addEventListener("click", () => {
      [...$("answerList").children].forEach(x => { x.disabled = true; x.classList.remove("selected"); });
      b.classList.add("selected");

      if (a.correct === null) {
        $("answerFeedback").textContent = a.explain;
        completeActivity();
      } else if (answer === a.correct) {
        b.classList.add("correct");
        $("answerFeedback").textContent = "That's right! " + a.explain;
        completeActivity();
      } else {
        b.classList.add("wrong");
        $("answerFeedback").textContent = "Good try. " + a.explain;
      }
    });
    $("answerList").appendChild(b);
  });
}

function completeActivity() {
  completed++;
  localStorage.setItem("everydayCompleted", String(completed));
  $("completedCount").textContent = completed;
  $("progressText").textContent = "Completed — nice work!";

  if (currentUser) {
    supabase.from('user_profiles').upsert({ id: currentUser.id, completed_count: completed });
  }
}

function setMood(next) {
  mood = next;
  activityIndex = 0;
  document.querySelectorAll(".mood").forEach(b => b.classList.toggle("active", b.dataset.mood === mood));
  renderActivity();
}

document.querySelectorAll(".mood").forEach(b => b.addEventListener("click", () => setMood(b.dataset.mood)));
$("nextActivity").addEventListener("click", () => { activityIndex++; renderActivity(); });
$("surpriseButton").addEventListener("click", () => {
  const moods = Object.keys(activities).filter(x => x !== mood);
  setMood(moods[Math.floor(Math.random() * moods.length)]);
});

$("newThought").addEventListener("click", () => {
  let next = thoughts[Math.floor(Math.random() * thoughts.length)];
  $("dailyThought").textContent = next;
});

$("completedCount").textContent = completed;

$("thoughtForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $("thoughtInput");
  const value = input.value.trim();
  if (!value) return;

  const authorName = currentUser ? currentUser.email.split('@')[0] : "You";
  
  const saved = JSON.parse(localStorage.getItem("everydayThoughts") || "[]");
  saved.unshift({ text: value, author: authorName, date: new Date().toISOString() });
  localStorage.setItem("everydayThoughts", JSON.stringify(saved.slice(0, 10)));
  
  addWallItem(value, authorName.charAt(0).toUpperCase(), authorName);
  input.value = "";

  if (currentUser) {
    await supabase.from('community_thoughts').insert([{ user_id: currentUser.id, text: value, author: authorName }]);
    $("answerFeedback").textContent = "Your thought has been shared to the community wall!";
  } else {
    $("answerFeedback").textContent = "Your thought has been saved on this device.";
  }
});

function addWallItem(text, letter, name = "You") {
  const row = document.createElement("div");
  row.className = "wall-item";
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.textContent = letter;
  const p = document.createElement("p");
  const strong = document.createElement("strong");
  const message = document.createElement("span");

  strong.textContent = name;
  message.className = "muted";
  message.textContent = text;
  p.append(strong, document.createElement("br"), message);
  row.append(avatar, p);
  $("communityWall").prepend(row);
}

JSON.parse(localStorage.getItem("everydayThoughts") || "[]").forEach(item => addWallItem(item.text, item.author ? item.author.charAt(0).toUpperCase() : "Y", item.author || "You"));

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredInstall = e;
  $("installButton").hidden = false;
});

$("installButton").addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  $("installButton").hidden = true;
});

checkSession();
renderActivity();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}