import { MediaItem, User, Comment, UserRole, Notification, TalentProfile, Message, ActivityLog } from '../types';

// Seed Data Generators
const generateId = () => Math.random().toString(36).substr(2, 9);

export const generateAvatar = (name: string): string => {
  const getInitials = (name: string) => {
    if (!name) return '';
    const parts = name.split(' ');
    if (parts.length > 1 && parts[1]) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const hash = (name || '').split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const color = `hsl(${hash % 360}, 75%, 50%)`;
  const initials = getInitials(name);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${color}" /><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="48" font-family="Poppins, sans-serif" fill="#ffffff">${initials}</text></svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

interface SiteSettings {
  featuredMediaId: string | null;
}

const generateBlankImage = (text: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="#27272a" /><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="24" font-family="sans-serif" fill="#71717a">${text}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const SEED_MEDIA: MediaItem[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `seed-${i}`,
  userId: 'admin-user',
  title: [
    "Uncensored: Backstage at the Awards",
    "Private Bedroom Session - Full 4K",
    "Late Night VIP Room [Exclusive]",
    "Boudoir Masterclass: Tease & Reveal",
    "Cape Town Model: Beach Photoshoot BTS",
    "Johanna's Private Cam Recording",
    "The Red Room: Uncut Scenes",
    "Luxury Escort Diaries: Dubai Trip",
    "Sultry Jazz Lounge Performance",
    "Morning Routine - Nothing to Hide",
    "Shower Thoughts with Lexi",
    "Studio 69: The Casting Tape"
  ][i],
  description: "Exclusive access to my latest content session. Join my VIP fan club for the full uncensored experience. 18+ Only.",
  thumbnailUrl: generateBlankImage('Explicit Content Hidden'),
  sourceUrl: '', // Mock video
  mediaType: 'video',
  duration: `${Math.floor(Math.random() * 40) + 5}:${Math.floor(Math.random() * 59).toString().padStart(2, '0')}`,
  views: Math.floor(Math.random() * 150000) + 5000,
  creatorName: [`Candy V.`, `Roxy Red`, `Mistress J`, `David L.`, `Velvet Rooms`, `ArtHouse XXX`, `VogueCam`, `IndieLens`][i % 8],
  creatorAvatar: generateAvatar([`Candy V.`, `Roxy Red`, `Mistress J`, `David L.`, `Velvet Rooms`, `ArtHouse XXX`, `VogueCam`, `IndieLens`][i % 8]),
  tags: ['Glamour', 'Uncensored', '4K', 'SouthAfrican', 'Verified'],
  isPremium: Math.random() > 0.4,
  uploadedAt: `${Math.floor(Math.random() * 10) + 1} days ago`,
  price: Math.random() > 0.4 ? 150 : undefined // Rands
}));

const SEED_TALENT: TalentProfile[] = [
  {
    id: 't1',
    name: "Aria Thorne",
    title: "Glamour Model & Performer",
    location: "Sandton, Johannesburg",
    rating: 4.9,
    reviewCount: 128,
    hourlyRate: 4500,
    imageUrl: generateBlankImage('Profile Image Hidden'),
    verified: true,
    online: true,
    tags: ["Photoshoot", "Private Events", "VIP Hosting"],
    availability: 'Available Now'
  },
  {
    id: 't2',
    name: "Liam K.",
    title: "Male Entertainer",
    location: "Camps Bay, Cape Town",
    rating: 4.8,
    reviewCount: 93,
    hourlyRate: 3500,
    imageUrl: generateBlankImage('Profile Image Hidden'),
    verified: true,
    online: false,
    tags: ["Bachelor Parties", "Modeling", "Escort"],
    availability: 'This Week'
  },
];


class StoreService {
  private media: MediaItem[] = [];
  private users: User[] = [];
  private comments: Comment[] = [];
  private notifications: Notification[] = [];
  private talentProfiles: TalentProfile[] = [];
  private messages: Message[] = [];
  private activityLogs: ActivityLog[] = [];
  private siteSettings: SiteSettings = { featuredMediaId: 'seed-0' };

  constructor() {
    this.loadFromStorage();
    if (this.media.length === 0) {
      this.media = SEED_MEDIA;
    }
     if (this.talentProfiles.length === 0) {
      this.talentProfiles = SEED_TALENT;
    }
    // Add admin user if not present - WITH COMPLEX CREDENTIALS
    let adminUser = this.users.find(u => u.role === UserRole.ADMIN);
    if (!adminUser) {
        adminUser = {
            id: 'admin-user',
            name: 'kamogelomosia',
            email: 'kamogelomosia',
            role: UserRole.ADMIN,
            verified: true,
            avatarUrl: generateAvatar('kamogelomosia'),
            password: '#Eightmillionby30$',
            subscriptions: []
        };
        this.users.push(adminUser);
    } else {
        adminUser.name = 'kamogelomosia';
        adminUser.email = 'kamogelomosia';
        adminUser.password = '#Eightmillionby30$';
    }
    // Seed generic notifications if empty
    if (this.notifications.length === 0) {
        this.seedNotifications();
    }
    this.saveToLocalStorageOnly();
  }

  async initFromServer() {
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const data = await res.json();
        if (data && Object.keys(data).length > 0) {
          if (data.media) this.media = data.media;
          if (data.users) this.users = data.users;
          if (data.comments) this.comments = data.comments;
          if (data.notifications) this.notifications = data.notifications;
          if (data.talentProfiles) this.talentProfiles = data.talentProfiles;
          if (data.messages) this.messages = data.messages;
          if (data.activityLogs) this.activityLogs = data.activityLogs;
          if (data.siteSettings) this.siteSettings = data.siteSettings;
          
          let adminUser = this.users.find(u => u.role === UserRole.ADMIN);
          if (adminUser) {
              adminUser.name = 'kamogelomosia';
              adminUser.email = 'kamogelomosia';
              adminUser.password = '#Eightmillionby30$';
          }
          this.saveToLocalStorageOnly();
        } else {
          // If server is empty, initialize it with seeded data
          this.saveToStorage();
        }
      }
    } catch (e) {
      console.warn("Failed to init from server", e);
    }
  }

  private saveToLocalStorageOnly() {
    try {
      localStorage.setItem('ac_media', JSON.stringify(this.media));
      localStorage.setItem('ac_users', JSON.stringify(this.users));
      localStorage.setItem('ac_comments', JSON.stringify(this.comments));
      localStorage.setItem('ac_notifications', JSON.stringify(this.notifications));
      localStorage.setItem('ac_talent', JSON.stringify(this.talentProfiles));
      localStorage.setItem('ac_activityLogs', JSON.stringify(this.activityLogs));
      localStorage.setItem('ac_settings', JSON.stringify(this.siteSettings));
    } catch (e) {
      console.error("Failed to save locally", e);
    }
  }

  private loadFromStorage() {
    try {
      const storedMedia = localStorage.getItem('ac_media');
      const storedUsers = localStorage.getItem('ac_users');
      const storedComments = localStorage.getItem('ac_comments');
      const storedNotifs = localStorage.getItem('ac_notifications');
      const storedTalent = localStorage.getItem('ac_talent');
      const storedLogs = localStorage.getItem('ac_activityLogs');
      const storedSettings = localStorage.getItem('ac_settings');

      if (storedMedia) this.media = JSON.parse(storedMedia);
      if (storedUsers) this.users = JSON.parse(storedUsers);
      if (storedComments) this.comments = JSON.parse(storedComments);
      if (storedNotifs) this.notifications = JSON.parse(storedNotifs);
      if (storedTalent) this.talentProfiles = JSON.parse(storedTalent);
      if (storedLogs) this.activityLogs = JSON.parse(storedLogs);
      if (storedSettings) this.siteSettings = JSON.parse(storedSettings);
    } catch (e) {
      console.error("Failed to load store", e);
    }
  }

  private saveToStorage() {
    const dataToSave = {
      media: this.media.map(m => ({
        ...m,
        sourceUrl: m.sourceUrl.startsWith('blob:') ? '' : m.sourceUrl
      })),
      users: this.users,
      comments: this.comments,
      notifications: this.notifications,
      talentProfiles: this.talentProfiles,
      messages: this.messages,
      activityLogs: this.activityLogs,
      siteSettings: this.siteSettings
    };

    localStorage.setItem('ac_media', JSON.stringify(dataToSave.media));
    localStorage.setItem('ac_users', JSON.stringify(dataToSave.users));
    localStorage.setItem('ac_comments', JSON.stringify(dataToSave.comments));
    localStorage.setItem('ac_notifications', JSON.stringify(dataToSave.notifications));
    localStorage.setItem('ac_talent', JSON.stringify(dataToSave.talentProfiles));
    localStorage.setItem('ac_activityLogs', JSON.stringify(dataToSave.activityLogs));
    localStorage.setItem('ac_settings', JSON.stringify(dataToSave.siteSettings));

    // Save to server asynchronously
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataToSave)
    }).catch(e => console.warn('Failed to save to server:', e));
  }
  
  private seedNotifications() {
      this.notifications = [
          { id: 'n1', userId: 'guest', type: 'system', message: 'Welcome to Elysian! Please verify your age to view explicit content.', read: false, createdAt: '2 mins ago' },
          { id: 'n2', userId: 'guest', type: 'upload', message: 'Roxy Red uploaded a new exclusive video.', read: false, createdAt: '1 hour ago' }
      ];
  }

  // --- Activity Logging ---
  getActivityLogs = (): ActivityLog[] => [...this.activityLogs].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  logActivity = (actionType: ActivityLog['actionType'], details: string, userId?: string) => {
    const newLog: ActivityLog = {
      id: generateId(),
      actionType,
      details,
      userId,
      timestamp: new Date().toISOString()
    };
    this.activityLogs.unshift(newLog);
    if (this.activityLogs.length > 500) this.activityLogs.pop(); // Keep last 500
    this.saveToStorage();
  }

  // --- Session Management ---
  saveSession = (user: User) => localStorage.setItem('ac_session', JSON.stringify(user));
  getSession = (): User | null => {
      const session = localStorage.getItem('ac_session');
      return session ? JSON.parse(session) : null;
  }
  clearSession = () => localStorage.removeItem('ac_session');

  // --- Site Settings ---
  getSiteSettings = (): SiteSettings => this.siteSettings;
  updateSiteSettings = (settings: Partial<SiteSettings>) => {
    this.siteSettings = { ...this.siteSettings, ...settings };
    this.saveToStorage();
  }

  // --- Media ---
  getMedia = (): MediaItem[] => [...this.media].sort((a, b) => new Date(b.uploadedAt === 'Just now' ? Date.now() : 0).getTime() - new Date(a.uploadedAt === 'Just now' ? Date.now() : 0).getTime());
  getMediaById = (id: string): MediaItem | undefined => this.media.find(m => m.id === id);
  addMedia = (item: Omit<MediaItem, 'id' | 'views' | 'uploadedAt'>): MediaItem => {
    const newItem: MediaItem = { ...item, id: generateId(), views: 0, uploadedAt: 'Just now', likes: [], dislikes: [] };
    this.media.unshift(newItem);
    this.addNotification({ userId: 'guest', type: 'upload', message: `${item.creatorName} just uploaded: ${item.title}` });
    this.saveToStorage(); 
    this.logActivity('upload', `User ${item.userId} uploaded media: ${item.title}`, item.userId);
    return newItem;
  }
  updateMedia = (id: string, updates: Partial<MediaItem>): MediaItem | undefined => {
    let updatedItem: MediaItem | undefined;
    this.media = this.media.map(item => {
        if (item.id === id) {
            updatedItem = { ...item, ...updates };
            return updatedItem;
        }
        return item;
    });
    this.saveToStorage();
    return updatedItem;
  }
  deleteMedia = (id: string) => { this.media = this.media.filter(item => item.id !== id); this.saveToStorage(); }
  importMedia = (items: MediaItem[]) => {
    const mediaMap = new Map(this.media.map(item => [item.id, item]));
    items.forEach(item => {
        // Simple merge: new item overwrites old one with same ID
        mediaMap.set(item.id, item);
    });
    this.media = Array.from(mediaMap.values());
    this.saveToStorage();
    this.logActivity('import', `Mass imported ${items.length} media items`);
  }

  rateMedia = (mediaId: string, userId: string, isLike: boolean) => {
    this.media = this.media.map(item => {
      if (item.id === mediaId) {
        let likes = item.likes || [];
        let dislikes = item.dislikes || [];
        
        // Remove existing rating from this user
        likes = likes.filter(id => id !== userId);
        dislikes = dislikes.filter(id => id !== userId);
        
        // Add new rating
        if (isLike) {
          likes.push(userId);
        } else {
          dislikes.push(userId);
        }
        
        return { ...item, likes, dislikes };
      }
      return item;
    });
    this.saveToStorage();
    this.logActivity('rating', `User rated media ${mediaId} (${isLike ? 'thumbs up' : 'thumbs down'})`, userId);
  }

  // --- Users ---
  getAllUsers = (): User[] => [...this.users];
  getUser = (id: string): User | undefined => this.users.find(u => u.id === id);
  
  login = (email: string, password?: string): User | undefined => {
    const user = this.users.find(u => u.email === email || u.name === email);
    if (!user) return undefined;
    
    // Simple password check for all users
    if (user.password && user.password !== password) {
        return undefined;
    }
    
    this.logActivity('login', `User logged in`, user.id);
    return user;
  };

  register = (user: Omit<User, 'id'>): User => {
    const newUser = { ...user, id: generateId(), subscriptions: [] };
    this.users.push(newUser);
    this.saveToStorage();
    this.logActivity('signup', `New user registered: ${user.name}`, newUser.id);
    return newUser;
  }

  updateUser = (id: string, updates: Partial<User>): User | undefined => {
    let updatedUser: User | undefined;
    this.users = this.users.map(user => {
        if (user.id === id) {
            updatedUser = { ...user, ...updates };
            return updatedUser;
        }
        return user;
    });
    this.saveToStorage();
    return updatedUser;
  }
  deleteUser = (id: string) => { this.users = this.users.filter(user => user.id !== id); this.saveToStorage(); }
  
  // --- Subscriptions ---
  subscribeUser = (userId: string, creatorId: string): User | undefined => {
      const user = this.getUser(userId);
      if (!user) return undefined;
      
      const currentSubs = user.subscriptions || [];
      if (!currentSubs.includes(creatorId)) {
          const updatedUser = this.updateUser(userId, { subscriptions: [...currentSubs, creatorId] });
          return updatedUser;
      }
      return user;
  }


  // --- Messages ---
  getMessages = (userId1: string, userId2: string): Message[] => {
    return this.messages.filter(m => 
      (m.senderId === userId1 && m.receiverId === userId2) ||
      (m.senderId === userId2 && m.receiverId === userId1)
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  sendMessage = (senderId: string, receiverId: string, text: string): Message => {
    const newMessage: Message = { id: generateId(), senderId, receiverId, text, createdAt: new Date().toISOString() };
    this.messages.push(newMessage);
    this.saveToStorage();
    return newMessage;
  }

  // --- Talent ---
  getAllTalent = (): TalentProfile[] => [...this.talentProfiles];
  addTalent = (profile: Omit<TalentProfile, 'id'>): TalentProfile => {
    const newProfile = { ...profile, id: generateId() };
    this.talentProfiles.push(newProfile);
    this.saveToStorage();
    return newProfile;
  }
  updateTalent = (id: string, updates: Partial<TalentProfile>): TalentProfile | undefined => {
    let updatedProfile: TalentProfile | undefined;
    this.talentProfiles = this.talentProfiles.map(p => {
        if (p.id === id) {
            updatedProfile = { ...p, ...updates };
            return updatedProfile;
        }
        return p;
    });
    this.saveToStorage();
    return updatedProfile;
  }
  deleteTalent = (id: string) => { this.talentProfiles = this.talentProfiles.filter(p => p.id !== id); this.saveToStorage(); }


  // --- Comments ---
  getComments = (mediaId: string): Comment[] => this.comments.filter(c => c.mediaId === mediaId).sort((a,b) => b.id.localeCompare(a.id));
  addComment = (comment: Omit<Comment, 'id' | 'createdAt' | 'likes'>): Comment => {
    const newComment: Comment = { ...comment, id: generateId(), createdAt: 'Just now', likes: 0 };
    this.comments = [newComment, ...this.comments];
    const media = this.getMediaById(comment.mediaId);
    if (media) this.addNotification({ userId: media.userId, type: 'comment', message: `${comment.userName} commented on your post: "${comment.text.substring(0, 20)}..."` });
    this.saveToStorage();
    return newComment;
  }

  // --- Notifications ---
  getNotifications = (userId: string): Notification[] => this.notifications.filter(n => n.userId === userId || n.userId === 'guest').reverse();
  markNotificationRead = (id: string) => { this.notifications = this.notifications.map(n => n.id === id ? { ...n, read: true } : n); this.saveToStorage(); }
  markAllNotificationsRead = (userId: string) => { this.notifications = this.notifications.map(n => (n.userId === userId || n.userId === 'guest') ? { ...n, read: true } : n); this.saveToStorage(); }
  addNotification = (notif: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
      const newNotif = { ...notif, id: generateId(), read: false, createdAt: 'Just now' };
      this.notifications.push(newNotif);
      this.saveToStorage();
  }
}

export const store = new StoreService();