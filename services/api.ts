import { store } from './store';
import { User, MediaItem, TalentProfile, Comment, Notification, Message } from '../types';

// Helper to simulate network latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  system: {
    init: async (): Promise<void> => {
      await store.initFromServer();
    }
  },
  auth: {
    login: async (email: string, password?: string): Promise<User> => {
      await delay(800);
      const user = store.login(email, password);
      if (!user) throw new Error('Invalid credentials');
      return user;
    },
    register: async (userData: Omit<User, 'id'>): Promise<User> => {
      await delay(1000);
      const existing = store.login(userData.email || '');
      if (existing) throw new Error('User already exists');
      return store.register(userData);
    },
    getSession: async (): Promise<User | null> => {
      // Session check is usually fast/local
      return store.getSession();
    },
    logout: async (): Promise<void> => {
      store.clearSession();
    },
    updateProfile: async (id: string, updates: Partial<User>): Promise<User> => {
       await delay(500);
       const updated = store.updateUser(id, updates);
       if (!updated) throw new Error('User not found');
       return updated;
    }
  },
  
  media: {
    uploadFile: async (file: File): Promise<string> => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      return data.url;
    },
    getAll: async (): Promise<MediaItem[]> => {
      await delay(400);
      return store.getMedia();
    },
    getById: async (id: string): Promise<MediaItem | undefined> => {
      await delay(300);
      return store.getMediaById(id);
    },
    create: async (item: Omit<MediaItem, 'id' | 'views' | 'uploadedAt'>): Promise<MediaItem> => {
      await delay(1500); // Simulate upload time
      return store.addMedia(item);
    },
    update: async (id: string, updates: Partial<MediaItem>): Promise<MediaItem> => {
      await delay(500);
      const updated = store.updateMedia(id, updates);
      if (!updated) throw new Error('Media not found');
      return updated;
    },
    delete: async (id: string): Promise<void> => {
      await delay(600);
      store.deleteMedia(id);
    },
    getRelated: async (id: string): Promise<MediaItem[]> => {
        await delay(200);
        return store.getMedia().filter(m => m.id !== id).slice(0, 6);
    }
  },

  users: {
    getAll: async (): Promise<User[]> => {
      await delay(500);
      return store.getAllUsers();
    },
    getById: async (id: string): Promise<User | undefined> => {
       await delay(300);
       return store.getUser(id);
    },
    subscribe: async (userId: string, creatorId: string): Promise<User> => {
        await delay(2000); // Simulate payment gateway processing
        const updated = store.subscribeUser(userId, creatorId);
        if (!updated) throw new Error('Subscription failed');
        return updated;
    }
  },

  talent: {
    getAll: async (): Promise<TalentProfile[]> => {
      await delay(400);
      return store.getAllTalent();
    },
    create: async (profile: Omit<TalentProfile, 'id'>): Promise<TalentProfile> => {
      await delay(800);
      return store.addTalent(profile);
    },
    update: async (id: string, updates: Partial<TalentProfile>): Promise<TalentProfile> => {
       await delay(500);
       const updated = store.updateTalent(id, updates);
       if (!updated) throw new Error('Talent not found');
       return updated;
    },
    delete: async (id: string): Promise<void> => {
        await delay(500);
        store.deleteTalent(id);
    }
  },

  notifications: {
     getAll: async (userId: string): Promise<Notification[]> => {
         // Polling usually doesn't need fake delay
         return store.getNotifications(userId);
     },
     markRead: async (id: string): Promise<void> => {
         store.markNotificationRead(id);
     },
     markAllRead: async (userId: string): Promise<void> => {
         store.markAllNotificationsRead(userId);
     }
  },

  messages: {
    getConversation: async (userId1: string, userId2: string): Promise<Message[]> => {
      await delay(200);
      return store.getMessages(userId1, userId2);
    },
    send: async (senderId: string, receiverId: string, text: string): Promise<Message> => {
      await delay(300);
      return store.sendMessage(senderId, receiverId, text);
    }
  },

  settings: {
      get: async () => store.getSiteSettings(),
      update: async (settings: any) => {
          await delay(300);
          store.updateSiteSettings(settings);
      }
  }
};