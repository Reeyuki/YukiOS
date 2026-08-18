import { getLiveUserId } from "./userIdentity.js";


const NOW = Date.now();
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;


let fakeFriends = [
  {
    userId: "gabe-newell",
    username: "Gabe Newell",
    avatarIndex: 3,
    presence: "online",
    lastSeen: Date.now(),
    nowPlaying: {
      appId: "half-life-3",
      gameTitle: "Half-Life 3"
    }
  },
  {
    userId: "gordon-freeman",
    username: "Gordon Freeman",
    avatarIndex: 9,
    presence: "online",
    lastSeen: Date.now(),
    nowPlaying: {
      appId: "",
      gameTitle: "Staring silently at a crowbar"
    }
  },
  {
    userId: "the-cake",
    username: "The Cake",
    avatarIndex: 17,
    presence: "offline",
    lastSeen: Date.now() - 15 * MINUTE
  },
  {
    userId: "clippy",
    username: "Clippy",
    avatarIndex: 12,
    presence: "online",
    lastSeen: Date.now(),
    nowPlaying: {
      appId: "",
      gameTitle: "Trying to help"
    }
  },
  {
    userId: "doomguy",
    username: "DOOM Guy",
    avatarIndex: 31,
    presence: "online",
    lastSeen: Date.now(),
    nowPlaying: {
      appId: "",
      gameTitle: "DOOM"
    }
  }
];


let fakeRequests = [
  {
    userId: "demoman-tf2",
    username: "Demoman",
    avatarIndex: 27,
    note: "I have a bucket of problems"
  },
  {
    userId: "rick-astley",
    username: "Rick Astley",
    avatarIndex: 18,
    note: "Never gonna give you up"
  }
];


let fakeSentRequests = [
  {
    userId: "miyamoto",
    username: "Shigeru Miyamoto",
    avatarIndex: 25,
    note: "Please approve my pipe-related friendship request."
  },
  {
    userId: "gabe-newell",
    username: "Gabe Newell",
    avatarIndex: 3,
    note: "Just checking if the number 3 is real."
  }
];


let fakeMessageStore = {
  "gabe-newell": [
    {
      body: "So I finally decided to count to 3.",
      fromId: "gabe-newell",
      sentAt: NOW - 20 * MINUTE
    },
    {
      body: "Wait. Actually?",
      fromId: null,
      sentAt: NOW - 19 * MINUTE
    },
    {
      body: "Half-Life 3 is in development.",
      fromId: "gabe-newell",
      sentAt: NOW - 18 * MINUTE
    },
    {
      body: "You actually said it.",
      fromId: null,
      sentAt: NOW - 17 * MINUTE
    },
    {
      body: "I didn't say when.",
      fromId: "gabe-newell",
      sentAt: NOW - 16 * MINUTE
    },
    {
      body: "Gabe.",
      fromId: null,
      sentAt: NOW - 15 * MINUTE
    },
    {
      body: "Gabe please.",
      fromId: null,
      sentAt: NOW - 14 * MINUTE
    }
  ],

  "gordon-freeman": [
    {
      body: "Hey Gordon.",
      fromId: null,
      sentAt: NOW - 9 * MINUTE
    },
    {
      body: "...",
      fromId: "gordon-freeman",
      sentAt: NOW - 8 * MINUTE
    },
    {
      body: "You good?",
      fromId: null,
      sentAt: NOW - 7 * MINUTE
    },
    {
      body: "...",
      fromId: "gordon-freeman",
      sentAt: NOW - 6 * MINUTE
    },
    {
      body: "Fair enough.",
      fromId: null,
      sentAt: NOW - 5 * MINUTE
    }
  ],
  "clippy": [
    {
      body: "It looks like you're trying to open YukiOS.",
      fromId: "clippy",
      sentAt: NOW - 2 * HOUR
    },
    {
      body: "Would you like help?",
      fromId: "clippy",
      sentAt: NOW - 119 * MINUTE
    },
    {
      body: "No.",
      fromId: null,
      sentAt: NOW - 118 * MINUTE
    },
    {
      body: "Are you sure?",
      fromId: "clippy",
      sentAt: NOW - 117 * MINUTE
    },
    {
      body: "Very.",
      fromId: null,
      sentAt: NOW - 116 * MINUTE
    },
    {
      body: "I'll be here.",
      fromId: "clippy",
      sentAt: NOW - 115 * MINUTE
    }
  ],


  "doomguy": [
    {
      body: "hey",
      fromId: null,
      sentAt: NOW - 12 * MINUTE
    },
    {
      body: "DOOM",
      fromId: "doomguy",
      sentAt: NOW - 11 * MINUTE
    },
    {
      body: "yeah",
      fromId: null,
      sentAt: NOW - 10 * MINUTE
    },
    {
      body: "DOOM.",
      fromId: "doomguy",
      sentAt: NOW - 9 * MINUTE
    }
  ],


  "the-cake": [
    {
      body: "You should probably stop looking for me.",
      fromId: "the-cake",
      sentAt: NOW - DAY
    },
    {
      body: "Seriously.",
      fromId: "the-cake",
      sentAt: NOW - DAY + MINUTE
    },
    {
      body: "I'm not in the test chamber.",
      fromId: "the-cake",
      sentAt: NOW - DAY + 2 * MINUTE
    }
  ],

};


export function fakeFriendsEnabled() {
  return  location.hostname === "localhost";
}


export function fakeFriendsResult() {
  return {
    friends: fakeFriends.slice(),
    requests: fakeRequests.slice(),
    sentRequests: fakeSentRequests.slice()
  };
}


export function fakeSendFriendRequest(friendId) {
  const known = fakeFriends.find((f) => f.userId === friendId);
  const username = known ? known.username : "Unknown Player";

  if (!fakeSentRequests.some((r) => r.userId === friendId)) {
    fakeSentRequests.push({
      userId: friendId,
      username,
      avatarIndex: known ? known.avatarIndex : 0,
      note: ""
    });
  }

  return { status: "pending" };
}


export function fakeAcceptFriendRequest(friendId) {
  const request = fakeRequests.find((r) => r.userId === friendId);

  if (request) {
    fakeFriends.push({
      userId: request.userId,
      username: request.username,
      avatarIndex: request.avatarIndex,
      presence: "online",
      lastSeen: Date.now()
    });

    fakeRequests = fakeRequests.filter((r) => r.userId !== friendId);
  }

  return { status: "accepted" };
}


export function fakeRemoveFriend(friendId) {
  fakeFriends = fakeFriends.filter((f) => f.userId !== friendId);
  fakeRequests = fakeRequests.filter((r) => r.userId !== friendId);
  fakeSentRequests = fakeSentRequests.filter((r) => r.userId !== friendId);
  delete fakeMessageStore[friendId];

  return { success: true };
}


export function fakeSendMessage(friendId, body) {
  if (!fakeMessageStore[friendId]) {
    fakeMessageStore[friendId] = [];
  }

  fakeMessageStore[friendId].push({
    body,
    fromId: null,
    sentAt: Date.now()
  });

  return { status: "ok" };
}


export function fakeFetchMessages(friendId) {
  const me = getLiveUserId();

  return (fakeMessageStore[friendId] || []).map((msg) => ({
    ...msg,
    fromId: msg.fromId === null ? me : msg.fromId
  }));
}


export function fakeFetchConversations() {
  const me = getLiveUserId();

  return fakeFriends
    .filter(
      (friend) =>
        fakeMessageStore[friend.userId] &&
        fakeMessageStore[friend.userId].length > 0
    )
    .map((friend) => {
      const messages = fakeMessageStore[friend.userId];
      const last = messages[messages.length - 1];

      return {
        friendId: friend.userId,
        username: friend.username,
        avatarIndex: friend.avatarIndex,
        unreadCount: friend.userId === "gabe-newell" ? 1 : 0,
        lastMessage: {
          body: last.body,
          fromMe: last.fromId === null
        }
      };
    });
}


export function fakeFriendRelation(userId) {
  if (userId === getLiveUserId()) return "self";
  if (fakeFriends.some((f) => f.userId === userId)) return "friend";
  if (fakeRequests.some((r) => r.userId === userId)) return "incoming";
  if (fakeSentRequests.some((r) => r.userId === userId)) return "outgoing";

  return "none";
}