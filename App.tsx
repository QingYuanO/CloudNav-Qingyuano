import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Plus, Upload, Moon, Sun, Menu, 
  ExternalLink, Trash2, Edit2, Loader2, Cloud, CheckCircle2, AlertCircle
} from 'lucide-react';
import { LinkItem, Category, DEFAULT_CATEGORIES, INITIAL_LINKS } from './types';
import { parseBookmarks } from './services/bookmarkParser';
import Icon from './components/Icon';
import LinkModal from './components/LinkModal';
import AuthModal from './components/AuthModal';

const LOCAL_STORAGE_KEY = 'cloudnav_data_cache';
const AUTH_KEY = 'cloudnav_auth_token';

function App() {
  // --- State ---
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkItem | undefined>(undefined);
  
  // Sync State
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [authToken, setAuthToken] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Helpers ---

  // Check if we are running in a dev environment without backend
  const isBackendAvailable = () => {
    // In a real scenario, we might ping an endpoint. 
    // For now, we assume if we are on localhost and not running via `wrangler pages dev`, api might be missing.
    // But we will try to fetch anyway.
    return true; 
  };

  const loadFromLocal = () => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setLinks(parsed.links || INITIAL_LINKS);
        setCategories(parsed.categories || DEFAULT_CATEGORIES);
      } catch (e) {
        setLinks(INITIAL_LINKS);
        setCategories(DEFAULT_CATEGORIES);
      }
    } else {
      setLinks(INITIAL_LINKS);
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  const syncToCloud = async (newLinks: LinkItem[], newCategories: Category[], token: string) => {
    setSyncStatus('saving');
    try {
        const response = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-password': token
            },
            body: JSON.stringify({ links: newLinks, categories: newCategories })
        });

        if (response.status === 401) {
            setAuthToken('');
            localStorage.removeItem(AUTH_KEY);
            setIsAuthOpen(true);
            setSyncStatus('error');
            return false;
        }

        if (!response.ok) throw new Error('Network response was not ok');
        
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return true;
    } catch (error) {
        console.error("Sync failed", error);
        setSyncStatus('error');
        return false;
    }
  };

  const updateData = (newLinks: LinkItem[], newCategories: Category[]) => {
      // 1. Optimistic UI Update
      setLinks(newLinks);
      setCategories(newCategories);
      
      // 2. Save to Local Cache
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: newLinks, categories: newCategories }));

      // 3. Sync to Cloud (if authenticated)
      if (authToken) {
          syncToCloud(newLinks, newCategories, authToken);
      }
  };

  // --- Effects ---

  // Initial Load & Auth Check
  useEffect(() => {
    // Theme init
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    // Load Token
    const savedToken = localStorage.getItem(AUTH_KEY);
    if (savedToken) setAuthToken(savedToken);

    // Initial Data Fetch
    const initData = async () => {
        try {
            const res = await fetch('/api/storage');
            if (res.ok) {
                const data = await res.json();
                if (data.links && data.links.length > 0) {
                    setLinks(data.links);
                    setCategories(data.categories || DEFAULT_CATEGORIES);
                    // Update cache
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
                    return;
                }
            } 
        } catch (e) {
            console.warn("Failed to fetch from cloud, falling back to local.", e);
        }
        // Fallback
        loadFromLocal();
    };

    initData();
  }, []);

  // Theme Toggle
  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // --- Handlers ---

  const handleLogin = async (password: string): Promise<boolean> => {
      // Verify by trying to save current data (or just a ping if we had one)
      // Here we just try to sync current state to verify password
      try {
        const response = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-password': password
            },
            body: JSON.stringify({ links, categories })
        });
        
        if (response.ok) {
            setAuthToken(password);
            localStorage.setItem(AUTH_KEY, password);
            setIsAuthOpen(false);
            setSyncStatus('saved');
            return true;
        }
        return false;
      } catch (e) {
          return false;
      }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!authToken) {
        setIsAuthOpen(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    try {
      const { links: newLinks, categories: newCats } = await parseBookmarks(file);
      
      const mergedCategories = [...categories];
      newCats.forEach(nc => {
        if (!mergedCategories.find(c => c.name === nc.name)) {
          mergedCategories.push(nc);
        }
      });

      const mergedLinks = [...links, ...newLinks];
      
      updateData(mergedLinks, mergedCategories);
      alert(`成功导入 ${newLinks.length} 个书签!`);
    } catch (err) {
      alert("导入失败，请确保是Chrome导出的HTML文件。");
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    const newLink: LinkItem = {
      ...data,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
    updateData([newLink, ...links], categories);
  };

  const handleEditLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (!editingLink) return;
    const updated = links.map(l => l.id === editingLink.id ? { ...l, ...data } : l);
    updateData(updated, categories);
    setEditingLink(undefined);
  };

  const handleDeleteLink = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authToken) { setIsAuthOpen(true); return; }
    if (confirm('确定删除此链接吗?')) {
      updateData(links.filter(l => l.id !== id), categories);
    }
  };

  // --- Filtering ---

  const filteredLinks = useMemo(() => {
    let result = links;
    if (selectedCategory !== 'all') {
      result = result.filter(l => l.categoryId === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => 
        l.title.toLowerCase().includes(q) || 
        l.url.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [links, selectedCategory, searchQuery]);


  return (
    <div className="flex h-screen overflow-hidden text-slate-900 dark:text-slate-50">
      
      {/* Auth Modal */}
      <AuthModal isOpen={isAuthOpen} onLogin={handleLogin} />

      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out
          bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-700">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              云航 CloudNav
            </span>
          </div>

          {/* Categories */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
            <button
              onClick={() => { setSelectedCategory('all'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                selectedCategory === 'all' 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <div className="p-1"><Icon name="LayoutGrid" size={18} /></div>
              <span>全部链接</span>
              <span className="ml-auto text-xs opacity-60 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                {links.length}
              </span>
            </button>
            
            <div className="pt-4 pb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              分类目录
            </div>

            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group ${
                  selectedCategory === cat.id 
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <div className={`
                   p-1.5 rounded-lg transition-colors
                   ${selectedCategory === cat.id ? 'bg-blue-100 dark:bg-blue-800' : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-600'}
                `}>
                  <Icon name={cat.icon} size={16} />
                </div>
                <span className="truncate">{cat.name}</span>
                {selectedCategory === cat.id && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                )}
              </button>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".html" 
              onChange={handleImport}
            />
            <button 
              onClick={() => {
                  if(!authToken) setIsAuthOpen(true);
                  else fileInputRef.current?.click();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-all mb-2"
            >
              <Upload size={16} />
              <span>导入 Chrome 书签</span>
            </button>
            
            <div className="flex items-center justify-between text-xs text-slate-400 px-2 mt-2">
               <span>v2.0 Cloud</span>
               <div className="flex items-center gap-1">
                 {syncStatus === 'saving' && <Loader2 className="animate-spin w-3 h-3 text-blue-500" />}
                 {syncStatus === 'saved' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                 {syncStatus === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                 {authToken ? <span className="text-green-600 font-medium">已连接</span> : <span className="text-amber-500">离线模式</span>}
               </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
        
        {/* Header */}
        <header className="h-16 px-4 lg:px-8 flex items-center justify-between bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300"
            >
              <Menu size={24} />
            </button>

            <div className="relative w-full max-w-md hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="搜索您的书签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-full bg-slate-100 dark:bg-slate-700/50 border-none focus:ring-2 focus:ring-blue-500 dark:text-white placeholder-slate-400 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="sm:hidden relative">
               <button onClick={() => {}} className="p-2"><Search size={20} className="dark:text-white"/></button>
             </div>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Login Button (if not logged in) */}
            {!authToken && (
                <button
                    onClick={() => setIsAuthOpen(true)}
                    className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-full font-medium transition-all text-sm"
                >
                    <Cloud size={16} />
                    <span className="hidden sm:inline">登录同步</span>
                </button>
            )}

            <button
              onClick={() => { 
                  if(!authToken) setIsAuthOpen(true);
                  else { setEditingLink(undefined); setIsModalOpen(true); }
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full font-medium transition-all shadow-lg shadow-blue-500/30 active:scale-95"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">添加链接</span>
            </button>
          </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
            
            {/* Stats/Welcome Banner */}
            {selectedCategory === 'all' && !searchQuery && (
                <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-xl relative overflow-hidden">
                    <div className="relative z-10">
                        <h1 className="text-3xl font-bold mb-2">欢迎回来 👋</h1>
                        <p className="opacity-90">
                            您收藏了 {links.length} 个精彩网站，{categories.length} 个分类。
                            {authToken ? ' (数据已同步)' : ' (本地模式)'}
                        </p>
                    </div>
                    <div className="absolute right-0 top-0 h-full w-1/3 opacity-10 pointer-events-none">
                         <Icon name="Compass" className="w-full h-full" />
                    </div>
                </div>
            )}

            {/* Grid */}
            {filteredLinks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                        <Search size={48} className="opacity-50" />
                    </div>
                    <p className="text-lg">未找到相关链接</p>
                    <button 
                        onClick={() => { 
                             if(!authToken) setIsAuthOpen(true);
                             else { setEditingLink(undefined); setIsModalOpen(true); }
                        }}
                        className="mt-4 text-blue-500 hover:underline"
                    >
                        添加一个?
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                    {filteredLinks.map(link => (
                    <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative flex flex-col p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg font-bold uppercase shrink-0">
                                {link.icon ? <img src={link.icon} alt="" className="w-6 h-6"/> : link.title.charAt(0)}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingLink(link); setIsModalOpen(true); }}
                                    className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button 
                                    onClick={(e) => handleDeleteLink(link.id, e)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                        
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {link.title}
                        </h3>
                        
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 h-10">
                            {link.description || link.url}
                        </p>

                        <div className="mt-auto flex items-center justify-between text-xs text-slate-400">
                             <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700/50">
                                {categories.find(c => c.id === link.categoryId)?.name || '未分类'}
                             </span>
                             <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </a>
                    ))}
                </div>
            )}
        </div>
      </main>

      {/* Modal */}
      <LinkModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingLink(undefined); }}
        onSave={editingLink ? handleEditLink : handleAddLink}
        categories={categories}
        initialData={editingLink}
      />

    </div>
  );
}

export default App;
