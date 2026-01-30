'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Upload, Shirt, Search, Sparkles, Loader2, Plus, X, Settings, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';

// Types
interface Analysis {
  category: string;
  sub_category: string;
  color: string;
  style: string;
  season: string;
  tags: string[];
}

interface ClothingItem {
  id: string;
  original_url: string;
  processed_url: string;
  analysis: Analysis;
  category?: string;
  description?: string;
  tags?: string[];
  wardrobe?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const IMAGE_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000';

export default function Home() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [apiKey, setApiKey] = useState('AIzaSyDQz6OHxCTVttBAME0mUNsNxW51nAJnQog');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [filter, setFilter] = useState('全部');
  
  // Wardrobe State
  const [currentWardrobe, setCurrentWardrobe] = useState('我的衣櫃');
  const [wardrobes, setWardrobes] = useState<string[]>(['我的衣櫃']);
  const [isAddingWardrobe, setIsAddingWardrobe] = useState(false);
  const [newWardrobeName, setNewWardrobeName] = useState('');
  
  // Recommendation State
  const [style, setStyle] = useState('日常休閒');
  const [isGenerating, setIsGenerating] = useState(false);
  const [recommendation, setRecommendation] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchItems();
    fetchWardrobes();
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) setApiKey(storedKey);
    const storedWardrobe = localStorage.getItem('current_wardrobe');
    if (storedWardrobe) setCurrentWardrobe(storedWardrobe);
  }, [currentWardrobe]);

  const fetchItems = async () => {
    try {
      const res = await axios.get(`${API_BASE}/items`, {
        params: { wardrobe: currentWardrobe }
      });
      setItems(res.data);
    } catch (err) {
      console.error("Failed to fetch items", err);
    }
  };

  const fetchWardrobes = async () => {
    try {
      const res = await axios.get(`${API_BASE}/wardrobes`);
      if (res.data.length > 0) {
        // Merge with default ensuring uniqueness
        const allWardrobes = Array.from(new Set(['我的衣櫃', ...res.data]));
        setWardrobes(allWardrobes);
      }
    } catch (err) {
      console.error("Failed to fetch wardrobes", err);
    }
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    localStorage.setItem('gemini_api_key', e.target.value);
  };

  const handleWardrobeChange = (name: string) => {
    setCurrentWardrobe(name);
    localStorage.setItem('current_wardrobe', name);
    setFilter('全部');
  };

  const createWardrobe = () => {
    if (!newWardrobeName.trim()) return;
    if (!wardrobes.includes(newWardrobeName)) {
      setWardrobes([...wardrobes, newWardrobeName]);
      handleWardrobeChange(newWardrobeName);
    }
    setNewWardrobeName('');
    setIsAddingWardrobe(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (!apiKey) {
      alert("請先輸入 Gemini API Key");
      return;
    }

    setIsUploading(true);
    setUploadError('');
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('wardrobe', currentWardrobe);

    try {
      const res = await axios.post(`${API_BASE}/upload`, formData);
      setItems(prev => [...prev, res.data]);
    } catch (err) {
      console.error(err);
      setUploadError('上傳失敗，請檢查 API Key 或後端狀態');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRecommend = async () => {
    if (!apiKey) {
      alert("請輸入 Gemini API Key");
      return;
    }
    if (items.length === 0) {
      alert("請先上傳一些衣物！");
      return;
    }

    setIsGenerating(true);
    setRecommendation('');
    
    try {
      const res = await axios.post(`${API_BASE}/recommend`, {
        items: items,
        style: style,
        api_key: apiKey
      }, {
        headers: {
          'Bypass-Tunnel-Reminder': 'true'
        }
      });
      setRecommendation(res.data.recommendation);
    } catch (err) {
      console.error(err);
      alert("生成建議失敗");
    } finally {
      setIsGenerating(false);
    }
  };

  // Filter Logic
  const categories = ['全部', ...Array.from(new Set(items.map(i => i.category || '未分類')))];
  const filteredItems = filter === '全部' 
    ? items 
    : items.filter(i => i.category === filter);

  return (
    <main className="min-h-screen bg-[#F9F8F4] text-[#46413C] pb-20 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#F9F8F4]/90 backdrop-blur-sm border-b border-[#E6E3D8] px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <button className="flex items-center gap-2 text-xl font-bold tracking-tight hover:text-[#8C8273] transition-colors">
                <span className="font-serif">WARDROBE</span>
                <span className="text-sm font-normal text-[#8C8273] ml-1">| {currentWardrobe}</span>
                <ChevronDown className="w-4 h-4 text-[#8C8273]" />
              </button>
              
              {/* Wardrobe Dropdown */}
              <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-[#E6E3D8] shadow-sm rounded-md overflow-hidden hidden group-hover:block hover:block z-50">
                {wardrobes.map(w => (
                  <button
                    key={w}
                    onClick={() => handleWardrobeChange(w)}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-[#F9F8F4] transition-colors ${currentWardrobe === w ? 'bg-[#F5F5F0] font-medium' : ''}`}
                  >
                    {w}
                  </button>
                ))}
                <div className="border-t border-[#E6E3D8] p-2">
                  {isAddingWardrobe ? (
                    <div className="flex gap-2">
                      <input 
                        autoFocus
                        value={newWardrobeName}
                        onChange={(e) => setNewWardrobeName(e.target.value)}
                        placeholder="新衣櫃名稱"
                        className="w-full text-xs px-2 py-1 border border-[#E6E3D8] rounded outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && createWardrobe()}
                      />
                      <button onClick={createWardrobe} className="text-xs bg-[#46413C] text-white px-2 rounded">OK</button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setIsAddingWardrobe(true)}
                      className="w-full text-left px-2 py-1 text-xs text-[#8C8273] hover:text-[#46413C] flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> 新增衣櫃...
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 items-center">
             <div className="hidden md:block">
               <input 
                 type="password" 
                 placeholder="API Key"
                 value={apiKey}
                 onChange={handleApiKeyChange}
                 className="px-3 py-1.5 text-xs border-b border-[#E6E3D8] bg-transparent focus:border-[#46413C] outline-none w-32 transition-all focus:w-48 placeholder-[#D1CEC4]"
               />
             </div>
             <button 
               onClick={() => fileInputRef.current?.click()}
               disabled={isUploading}
               className="flex items-center gap-2 bg-[#46413C] text-white px-5 py-2 rounded-sm hover:bg-[#2C2926] transition-colors disabled:opacity-50 text-sm tracking-wide shadow-sm"
             >
               {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
               新增單品
             </button>
             <input 
               type="file" 
               ref={fileInputRef} 
               className="hidden" 
               accept="image/*"
               onChange={handleUpload}
             />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Left: Wardrobe Gallery */}
        <div className="lg:col-span-8 space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#E6E3D8] pb-4">
            <div className="flex gap-4 overflow-x-auto w-full no-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat!)}
                  className={`px-1 py-1 text-sm whitespace-nowrap transition-colors relative ${
                    filter === cat 
                      ? 'text-[#46413C] font-medium' 
                      : 'text-[#8C8273] hover:text-[#46413C]'
                  }`}
                >
                  {cat}
                  {filter === cat && <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-[#46413C]" />}
                </button>
              ))}
            </div>
            <span className="text-xs text-[#8C8273] whitespace-nowrap">{filteredItems.length} 件單品</span>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-32 bg-white rounded-sm border border-[#E6E3D8]">
              <div className="w-16 h-16 bg-[#F9F8F4] rounded-full flex items-center justify-center mx-auto mb-6">
                <Shirt className="w-6 h-6 text-[#D1CEC4]" />
              </div>
              <p className="text-[#8C8273] font-light text-lg">這個衣櫃還沒有衣服</p>
              <p className="text-sm text-[#D1CEC4] mt-2">點擊右上角「新增單品」開始整理</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map(item => (
                <div key={item.id} className="group relative bg-white rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-all duration-500 aspect-[3/4] border border-transparent hover:border-[#E6E3D8]">
                  <div className="absolute inset-0 p-6 flex items-center justify-center">
                    <Image 
                      src={`${IMAGE_BASE}${item.processed_url}`} 
                      alt={item.description || 'Clothing item'}
                      fill
                      className="object-contain p-4 transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-white/95 backdrop-blur-sm p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 border-t border-[#F5F5F0]">
                    <p className="text-xs font-bold text-[#46413C] uppercase tracking-wider mb-1">{item.category}</p>
                    <p className="text-xs text-[#8C8273] line-clamp-1 font-light">{item.analysis.sub_category} · {item.analysis.color}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: AI Stylist */}
        <div className="lg:col-span-4">
          <div className="sticky top-28 space-y-6">
            <div className="bg-white rounded-sm border border-[#E6E3D8] p-8 shadow-sm">
              <h2 className="text-lg font-serif text-[#46413C] mb-6 flex items-center gap-3 border-b border-[#E6E3D8] pb-4">
                <Sparkles className="w-4 h-4 text-[#8C8273]" />
                搭配顧問
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-medium text-[#8C8273] mb-2 uppercase tracking-wide">今日風格 / 場合</label>
                  <div className="relative">
                    <select 
                      value={style} 
                      onChange={(e) => setStyle(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-[#E6E3D8] rounded-sm bg-[#F9F8F4] focus:border-[#46413C] outline-none appearance-none cursor-pointer"
                    >
                      <option>日常休閒 (Casual)</option>
                      <option>商務簡報 (Business)</option>
                      <option>週末約會 (Date)</option>
                      <option>城市漫遊 (City Boy/Girl)</option>
                      <option>極簡主義 (Minimalist)</option>
                      <option>戶外運動 (Active)</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8273] pointer-events-none" />
                  </div>
                </div>
                
                <button 
                  onClick={handleRecommend}
                  disabled={isGenerating || items.length === 0}
                  className="w-full py-3 bg-[#7F0019] text-white rounded-sm font-medium hover:bg-[#660014] transition-colors disabled:opacity-50 flex justify-center items-center gap-2 text-sm tracking-widest uppercase"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      思考中...
                    </>
                  ) : (
                    <>
                      生成搭配提案
                    </>
                  )}
                </button>
              </div>
            </div>

            {recommendation && (
              <div className="bg-white rounded-sm border border-[#E6E3D8] p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
                <h3 className="font-serif text-[#46413C] mb-4 text-center text-lg">Styling Proposal</h3>
                <div className="prose prose-sm prose-stone max-w-none text-[#595550] leading-relaxed font-light">
                  <ReactMarkdown>{recommendation}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
