import React, { useState, useEffect } from 'react';
import { User, MediaItem, UserRole, TalentProfile } from '../types';
import { api } from '../services/api';
import { ShieldCheck, Video, Users, PlusCircle, Edit, Trash2, X, Save, Settings, Star, MapPin, UploadCloud } from 'lucide-react';
import AdminBulkImport from './AdminUpload';

interface AdminDashboardProps {
  user: User;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'media' | 'users' | 'settings' | 'import'>('media');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [talent, setTalent] = useState<TalentProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [siteSettings, setSiteSettings] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isTalentModalOpen, setIsTalentModalOpen] = useState(false);
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingTalent, setEditingTalent] = useState<TalentProfile | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
        const [m, u, t, s] = await Promise.all([
            api.media.getAll(),
            api.users.getAll(),
            api.talent.getAll(),
            api.settings.get()
        ]);
        setMedia(m);
        setUsers(u);
        setTalent(t);
        setSiteSettings(s);
    } catch(e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleMediaSubmit = async (formData: any) => { 
      try {
        if (editingMedia) await api.media.update(editingMedia.id, formData); 
        else await api.media.create({ ...formData, userId: user.id }); 
        fetchData(); 
        closeMediaModal(); 
      } catch (e) { alert('Operation failed'); }
  };
  
  const handleUserSubmit = async (formData: any) => { 
      try {
        if (editingUser) await api.auth.updateProfile(editingUser.id, formData); 
        else await api.auth.register(formData); 
        fetchData(); 
        closeUserModal(); 
      } catch (e) { alert('Operation failed'); }
  };

  const handleTalentSubmit = async (formData: any) => { 
      try {
        if (editingTalent) await api.talent.update(editingTalent.id, formData); 
        else await api.talent.create(formData); 
        fetchData(); 
        closeTalentModal(); 
      } catch (e) { alert('Operation failed'); }
  };

  const handleDeleteMedia = async (id: string) => { if (window.confirm('Are you sure?')) { await api.media.delete(id); fetchData(); } };
  const handleDeleteTalent = async (id: string) => { if (window.confirm('Are you sure?')) { await api.talent.delete(id); fetchData(); } };
  
  const handleDeleteUser = (id: string) => { 
      // User deletion not yet implemented in API/Store for safety, just mock
      if (id === user.id) { alert("Cannot delete self."); return; } 
      if (window.confirm('Are you sure?')) { alert('User deletion restricted in demo.'); } 
  };
  
  const openMediaModal = (m: MediaItem | null = null) => { setEditingMedia(m); setIsMediaModalOpen(true); };
  const closeMediaModal = () => { setIsMediaModalOpen(false); setEditingMedia(null); };
  const openUserModal = (u: User | null = null) => { setEditingUser(u); setIsUserModalOpen(true); };
  const closeUserModal = () => { setIsUserModalOpen(false); setEditingUser(null); };
  const openTalentModal = (t: TalentProfile | null = null) => { setEditingTalent(t); setIsTalentModalOpen(true); };
  const closeTalentModal = () => { setIsTalentModalOpen(false); setEditingTalent(null); };

  const handleSettingsChange = (e: React.ChangeEvent<HTMLSelectElement>) => { setSiteSettings(prev => ({ ...prev, [e.target.name]: e.target.value })); };
  const saveSettings = async () => { await api.settings.update(siteSettings); alert('Site settings saved!'); };

  const getFilteredData = () => {
      const term = searchTerm.toLowerCase();
      switch(activeTab) {
          case 'media': return media.filter(m => m.title.toLowerCase().includes(term));
          case 'users': return users.filter(u => u.name.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term));
          case 'settings': return talent.filter(t => t.name.toLowerCase().includes(term));
          default: return [];
      }
  };
  const filteredData = getFilteredData();

  if (isLoading && media.length === 0) return <div className="p-8 text-center text-zinc-500">Loading admin data...</div>;

  return (
    <div className="space-y-8">
      <div><h1 className="text-3xl font-bold text-white flex items-center"><ShieldCheck className="w-8 h-8 mr-3 text-red-500" /> Site Administration</h1><p className="text-zinc-400 mt-1">Manage platform content, users, and site settings.</p></div>
      <div className="flex space-x-1 bg-zinc-900/50 p-1 rounded-xl w-fit border border-zinc-800 overflow-x-auto">
          <button type="button" onClick={() => setActiveTab('media')} className={`px-4 md:px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center whitespace-nowrap ${activeTab === 'media' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}><Video className="w-4 h-4 mr-2" /> Media</button>
          <button type="button" onClick={() => setActiveTab('users')} className={`px-4 md:px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center whitespace-nowrap ${activeTab === 'users' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}><Users className="w-4 h-4 mr-2" /> Users</button>
          <button type="button" onClick={() => setActiveTab('settings')} className={`px-4 md:px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center whitespace-nowrap ${activeTab === 'settings' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}><Settings className="w-4 h-4 mr-2" /> Site Settings</button>
          <button type="button" onClick={() => setActiveTab('import')} className={`px-4 md:px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center whitespace-nowrap ${activeTab === 'import' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}><UploadCloud className="w-4 h-4 mr-2" /> Import/Export</button>
      </div>
      
      {['media', 'users', 'settings'].includes(activeTab) && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <input type="text" placeholder={`Search ${activeTab === 'settings' ? 'talent...' : activeTab + '...'}`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-full py-2 px-4 text-sm text-zinc-200 focus:outline-none focus:border-red-600 w-full sm:w-auto" />
            {activeTab === 'media' && <button type="button" onClick={() => openMediaModal()} className="flex items-center bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-sm font-bold w-full sm:w-auto justify-center"><PlusCircle className="w-4 h-4 mr-2" /> Add Media</button>}
            {activeTab === 'users' && <button type="button" onClick={() => openUserModal()} className="flex items-center bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-sm font-bold w-full sm:w-auto justify-center"><PlusCircle className="w-4 h-4 mr-2" /> Add User</button>}
        </div>
      )}
      
      {activeTab === 'import' ? (
        <AdminBulkImport />
      ) : (
        <div className="bg-black/30 border border-zinc-800 rounded-2xl overflow-hidden">
          {activeTab === 'media' && <MediaTable media={filteredData} onEdit={openMediaModal} onDelete={handleDeleteMedia} />}
          {activeTab === 'users' && <UserTable users={filteredData} onEdit={openUserModal} onDelete={handleDeleteUser} />}
          {activeTab === 'settings' && <SiteSettingsPanel talent={filteredData as TalentProfile[]} media={media} settings={siteSettings} onEditTalent={openTalentModal} onDeleteTalent={handleDeleteTalent} onAddTalent={() => openTalentModal()} onSettingsChange={handleSettingsChange} onSaveSettings={saveSettings} />}
        </div>
      )}

      {isMediaModalOpen && <MediaFormModal media={editingMedia} onClose={closeMediaModal} onSubmit={handleMediaSubmit} currentUser={user}/>}
      {isUserModalOpen && <UserFormModal user={editingUser} onClose={closeUserModal} onSubmit={handleUserSubmit} />}
      {isTalentModalOpen && <TalentFormModal talent={editingTalent} onClose={closeTalentModal} onSubmit={handleTalentSubmit} />}
    </div>
  );
};

// --- Responsive Tables & Panels ---
const renderActions = (onEdit: () => void, onDelete: () => void, itemType: string, itemName: string) => (
  <div className="flex justify-end space-x-2 pt-2 md:pt-0">
    <button type="button" onClick={onEdit} className="p-2 hover:bg-zinc-800 rounded-full" aria-label={`Edit ${itemType} ${itemName}`}><Edit className="w-4 h-4 text-zinc-400"/></button>
    <button type="button" onClick={onDelete} className="p-2 hover:bg-zinc-800 rounded-full" aria-label={`Delete ${itemType} ${itemName}`}><Trash2 className="w-4 h-4 text-red-500"/></button>
  </div>
);

const MediaTable = ({ media, onEdit, onDelete }: any) => (
  <div>
    {/* Desktop View */}
    <table className="w-full text-sm text-left text-zinc-400 hidden md:table">
      <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50"><tr><th scope="col" className="px-6 py-3">Thumbnail</th><th scope="col" className="px-6 py-3">Title</th><th scope="col" className="px-6 py-3">Creator</th><th scope="col" className="px-6 py-3">Status</th><th scope="col" className="px-6 py-3 text-right">Actions</th></tr></thead>
      <tbody>{media.map((item: MediaItem) => (<tr key={item.id} className="border-b border-zinc-800 hover:bg-zinc-900"><td className="px-6 py-4"><img src={item.thumbnailUrl} className="w-20 h-12 object-cover rounded-md"/></td><td className="px-6 py-4 font-medium text-white">{item.title}</td><td className="px-6 py-4">{item.creatorName}</td><td className="px-6 py-4">{item.isPremium ? <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-500/10 text-amber-500">Premium</span> : <span className="px-2 py-1 text-xs font-medium rounded-full bg-zinc-700 text-zinc-300">Free</span>}</td><td className="px-6 py-4 text-right">{renderActions(() => onEdit(item), () => onDelete(item.id), 'media', item.title)}</td></tr>))}</tbody>
    </table>
    {/* Mobile View */}
    <div className="md:hidden space-y-4 p-4">{media.map((item: MediaItem) => (<div key={item.id} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 flex items-start space-x-4"><img src={item.thumbnailUrl} className="w-20 h-20 object-cover rounded-md flex-shrink-0"/><div className="flex-1"><p className="font-bold text-white mb-1">{item.title}</p><p className="text-xs text-zinc-400 mb-2">by {item.creatorName}</p>{item.isPremium ? <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-500/10 text-amber-500">Premium</span> : <span className="px-2 py-1 text-xs font-medium rounded-full bg-zinc-700 text-zinc-300">Free</span>}</div>{renderActions(() => onEdit(item), () => onDelete(item.id), 'media', item.title)}</div>))}</div>
  </div>
);

const UserTable = ({ users, onEdit, onDelete }: any) => (
  <div>
    <table className="w-full text-sm text-left text-zinc-400 hidden md:table">
      <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50"><tr><th scope="col" className="px-6 py-3">User</th><th scope="col" className="px-6 py-3">Role</th><th scope="col" className="px-6 py-3">Status</th><th scope="col" className="px-6 py-3 text-right">Actions</th></tr></thead>
      <tbody>{users.map((user: User) => (<tr key={user.id} className="border-b border-zinc-800 hover:bg-zinc-900"><td className="px-6 py-4 font-medium text-white flex items-center"><img src={user.avatarUrl} className="w-8 h-8 rounded-full mr-3"/>{user.name}</td><td className="px-6 py-4">{user.role}</td><td className="px-6 py-4">{user.verified ? <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-500">Verified</span> : <span className="px-2 py-1 text-xs font-medium rounded-full bg-zinc-700 text-zinc-300">Unverified</span>}</td><td className="px-6 py-4 text-right">{renderActions(() => onEdit(user), () => onDelete(user.id), 'user', user.name)}</td></tr>))}</tbody>
    </table>
    <div className="md:hidden space-y-4 p-4">{users.map((user: User) => (<div key={user.id} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 flex items-center space-x-4"><img src={user.avatarUrl} className="w-12 h-12 rounded-full"/><div className="flex-1"><p className="font-bold text-white">{user.name}</p><p className="text-xs text-zinc-400">{user.role}</p>{user.verified ? <span className="mt-1 px-2 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-500 inline-block">Verified</span> : <span className="mt-1 px-2 py-1 text-xs font-medium rounded-full bg-zinc-700 text-zinc-300 inline-block">Unverified</span>}</div>{renderActions(() => onEdit(user), () => onDelete(user.id), 'user', user.name)}</div>))}</div>
  </div>
);

const TalentTable = ({ talent, onEdit, onDelete }: any) => (
  <div>
    <table className="w-full text-sm text-left text-zinc-400 hidden md:table">
      <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50"><tr><th scope="col" className="px-6 py-3">Name</th><th scope="col" className="px-6 py-3">Location</th><th scope="col" className="px-6 py-3">Rating</th><th scope="col" className="px-6 py-3 text-right">Actions</th></tr></thead>
      <tbody>{talent.map((t: TalentProfile) => (<tr key={t.id} className="border-b border-zinc-800 hover:bg-zinc-900"><td className="px-6 py-4 font-medium text-white flex items-center"><img src={t.imageUrl} className="w-8 h-8 rounded-full mr-3"/>{t.name}</td><td className="px-6 py-4">{t.location}</td><td className="px-6 py-4 flex items-center"><Star className="w-3 h-3 mr-1 text-amber-500 fill-current"/>{t.rating}</td><td className="px-6 py-4 text-right">{renderActions(() => onEdit(t), () => onDelete(t.id), 'talent', t.name)}</td></tr>))}</tbody>
    </table>
    <div className="md:hidden space-y-4 p-4">{talent.map((t: TalentProfile) => (<div key={t.id} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 flex items-center space-x-4"><img src={t.imageUrl} className="w-12 h-12 rounded-full"/><div className="flex-1"><p className="font-bold text-white">{t.name}</p><p className="text-xs text-zinc-400 flex items-center"><MapPin className="w-3 h-3 mr-1"/>{t.location}</p></div>{renderActions(() => onEdit(t), () => onDelete(t.id), 'talent', t.name)}</div>))}</div>
  </div>
);

const SiteSettingsPanel = ({ talent, media, settings, onEditTalent, onDeleteTalent, onAddTalent, onSettingsChange, onSaveSettings }: any) => ( <div className="p-4 md:p-6 space-y-8"> <div> <h3 className="text-xl font-bold text-white mb-2">Page Content</h3> <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 space-y-4"> <div><label htmlFor="featuredMediaId" className="block text-sm font-semibold text-zinc-300 mb-2">Featured Media on Homepage</label> <select id="featuredMediaId" name="featuredMediaId" value={settings.featuredMediaId || ''} onChange={onSettingsChange} className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition"> <option value="">-- Select a Video --</option> {media.map((m: MediaItem) => <option key={m.id} value={m.id}>{m.title}</option>)} </select></div> <div className="flex justify-end pt-2"> <button type="button" onClick={onSaveSettings} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">Save Settings</button> </div> </div> </div> <div> <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4"> <h3 className="text-xl font-bold text-white">Talent Directory</h3> <button type="button" onClick={onAddTalent} className="flex items-center bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-sm font-bold w-full sm:w-auto justify-center"><PlusCircle className="w-4 h-4 mr-2" /> Add Talent</button> </div> <div className="overflow-hidden border border-zinc-800 rounded-lg"> <TalentTable talent={talent} onEdit={onEditTalent} onDelete={onDeleteTalent} /> </div> </div> </div> );

// --- Modals ---
const ModalWrapper = ({ title, onClose, children, onSubmit, submitText }: any) => ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"> <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl"> <div className="p-4 border-b border-zinc-800 flex justify-between items-center"> <h3 className="text-lg font-bold text-white">{title}</h3> <button type="button" aria-label="Close modal" onClick={onClose}><X className="w-5 h-5 text-zinc-400"/></button> </div> <form onSubmit={onSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto"> {children} <div className="pt-4 flex justify-end space-x-2"> <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-zinc-400 hover:bg-zinc-800">Cancel</button> <button type="submit" className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700">{submitText || 'Save'}</button> </div> </form> </div> </div> );
const FormInput = ({ label, name, value, onChange, placeholder, required = false, type = 'text' }: any) => <div><label htmlFor={name} className="block mb-2 text-sm font-semibold text-zinc-300">{label}</label><input id={name} type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} required={required} className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition" /></div>;
const FormTextarea = ({ label, name, value, onChange, placeholder }: any) => <div><label htmlFor={name} className="block mb-2 text-sm font-semibold text-zinc-300">{label}</label><textarea id={name} name={name} value={value} onChange={onChange} placeholder={placeholder} className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 text-white h-24 focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition" /></div>;
const FormSelect = ({ label, name, value, onChange, children }: any) => <div><label htmlFor={name} className="block mb-2 text-sm font-semibold text-zinc-300">{label}</label><select id={name} name={name} value={value} onChange={onChange} className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition">{children}</select></div>;
const FormCheckbox = ({ name, checked, onChange, label }: any) => <label htmlFor={name} className="flex items-center cursor-pointer"><input id={name} type="checkbox" name={name} checked={checked} onChange={onChange} className="w-4 h-4 text-red-600 bg-zinc-700 border-zinc-600 rounded focus:ring-red-500"/> <span className="ml-3 text-zinc-300">{label}</span></label>;

const MediaFormModal = ({ media, onClose, onSubmit, currentUser }: any) => { const [formData, setFormData] = useState({ title: media?.title || '', description: media?.description || '', thumbnailUrl: media?.thumbnailUrl || '', sourceUrl: media?.sourceUrl || '', mediaType: media?.mediaType || 'video', creatorName: media?.creatorName || currentUser.name, tags: media?.tags?.join(', ') || '', isPremium: media?.isPremium || false, price: media?.price || '' }); const handleChange = (e: any) => { const { name, value, type, checked } = e.target; setFormData(p => ({ ...p, [name]: type === 'checkbox' ? checked : value })); }; const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); const tagList = formData.tags.split(',').map(t => t.trim()).filter(Boolean); onSubmit({ ...formData, tags: tagList, price: parseFloat(formData.price) || 0 }); }; return ( <ModalWrapper title={media ? 'Edit Media' : 'Add New Media'} onClose={onClose} onSubmit={handleSubmit}> <FormInput label="Title" name="title" value={formData.title} onChange={handleChange} placeholder="Title" required /> <FormTextarea label="Description" name="description" value={formData.description} onChange={handleChange} placeholder="Description" /> <FormInput label="Source URL" name="sourceUrl" value={formData.sourceUrl} onChange={handleChange} placeholder="e.g., video.mp4" required /> <FormInput label="Thumbnail URL" name="thumbnailUrl" value={formData.thumbnailUrl} onChange={handleChange} placeholder="e.g., image.jpg" required /> <FormSelect label="Media Type" name="mediaType" value={formData.mediaType} onChange={handleChange}><option value="video">Video</option><option value="image">Image</option></FormSelect> <FormInput label="Creator Name" name="creatorName" value={formData.creatorName} onChange={handleChange} placeholder="Creator Name" required /> <FormInput label="Tags (comma-separated)" name="tags" value={formData.tags} onChange={handleChange} placeholder="Tags" /> <div className="flex items-center space-x-4 pt-2"> <FormCheckbox name="isPremium" checked={formData.isPremium} onChange={handleChange} label="Premium Content" /> {formData.isPremium && <FormInput label="Price (R)" type="number" name="price" value={formData.price} onChange={handleChange} placeholder="Price" />} </div> </ModalWrapper> ); };
const UserFormModal = ({ user, onClose, onSubmit }: any) => { const [formData, setFormData] = useState({ name: user?.name || '', email: user?.email || '', password: '', role: user?.role || UserRole.CONSUMER, verified: user?.verified || false }); const handleChange = (e: any) => { const { name, value, type, checked } = e.target; setFormData(p => ({ ...p, [name]: type === 'checkbox' ? checked : value })); }; const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); const submissionData = { ...formData }; if (!submissionData.password) { delete (submissionData as any).password; } onSubmit(submissionData); }; return ( <ModalWrapper title={user ? 'Edit User' : 'Add New User'} onClose={onClose} onSubmit={handleSubmit}> <FormInput label="Full Name" name="name" value={formData.name} onChange={handleChange} placeholder="Full Name" required /> <FormInput label="Email Address" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email Address" required /> <FormInput label="Password" type="password" name="password" value={formData.password} onChange={handleChange} placeholder={user ? "Leave blank to keep unchanged" : "Set user password"} /> <FormSelect label="Role" name="role" value={formData.role} onChange={handleChange}>{Object.values(UserRole).map(role => <option key={role} value={role}>{role}</option>)}</FormSelect> <FormCheckbox name="verified" checked={formData.verified} onChange={handleChange} label="Verified Account" /> </ModalWrapper> ); };
const TalentFormModal = ({ talent, onClose, onSubmit }: any) => { const [formData, setFormData] = useState({ name: talent?.name || '', title: talent?.title || '', location: talent?.location || '', rating: talent?.rating || '4.5', reviewCount: talent?.reviewCount || '0', hourlyRate: talent?.hourlyRate || '1000', imageUrl: talent?.imageUrl || '', verified: talent?.verified || false, online: talent?.online || false, tags: talent?.tags?.join(', ') || '', availability: talent?.availability || 'Available Now' }); const handleChange = (e: any) => { const { name, value, type, checked } = e.target; setFormData(p => ({ ...p, [name]: type === 'checkbox' ? checked : value })); }; const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); const tagList = formData.tags.split(',').map(t => t.trim()).filter(Boolean); onSubmit({ ...formData, tags: tagList, rating: parseFloat(formData.rating), reviewCount: parseInt(formData.reviewCount), hourlyRate: parseInt(formData.hourlyRate) }); }; return ( <ModalWrapper title={talent ? 'Edit Talent' : 'Add New Talent'} onClose={onClose} onSubmit={handleSubmit}> <FormInput label="Full Name" name="name" value={formData.name} onChange={handleChange} placeholder="Full Name" required /> <FormInput label="Title" name="title" value={formData.title} onChange={handleChange} placeholder="e.g., Glamour Model" /> <FormInput label="Location" name="location" value={formData.location} onChange={handleChange} placeholder="e.g., Sandton" /> <FormInput label="Image URL" name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="Image URL" /> <FormInput label="Hourly Rate (R)" name="hourlyRate" type="number" value={formData.hourlyRate} onChange={handleChange} placeholder="Hourly Rate" /> <FormInput label="Tags (comma-separated)" name="tags" value={formData.tags} onChange={handleChange} placeholder="Tags" /> <FormSelect label="Availability" name="availability" value={formData.availability} onChange={handleChange}><option>Available Now</option><option>This Week</option><option>Booked</option></FormSelect> <div className="pt-2 space-y-4"> <FormCheckbox name="verified" checked={formData.verified} onChange={handleChange} label="ID Verified" /> <FormCheckbox name="online" checked={formData.online} onChange={handleChange} label="Online Now" /> </div></ModalWrapper> ); };

export default AdminDashboard;