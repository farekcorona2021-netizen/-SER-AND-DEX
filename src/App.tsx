import { useState, useEffect } from 'react';
import { Settings, Zap, BookOpenText, MessageSquareText, ShieldCheck, Globe, HelpCircle, ExternalLink, Moon } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [lang, setLang] = useState('ar');
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedStatus, setSavedStatus] = useState(false);
  
  const [settings, setSettings] = useState({
    subdlKey: '',
    subsourceKey: '',
    geminiKey: '',
    openSubtitles: false,
    sourceLang: 'en',
    targetLang: 'ar'
  });

  const copyToClipboard = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Clipboard access failed, selecting fallback instead:", err);
    }
  };

  // Calculate current host location at client runtime safely
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('ser_dex_settings');
        if (saved) {
          setSettings(JSON.parse(saved));
        }
      }
    } catch (e) {
      console.warn("Unable to load settings from localStorage:", e);
    }
  }, []);

  const t = (ar: string, en: string) => (lang === 'ar' ? ar : en);

  const saveSettings = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('ser_dex_settings', JSON.stringify(settings));
      }
    } catch (e) {
      console.warn("Unable to save settings to localStorage:", e);
    }
    setSavedStatus(true);
    setTimeout(() => setSavedStatus(false), 3000);
  };

  // Safe Base64 configuration encoder
  const getEncodedConfig = () => {
    try {
      const jsonStr = JSON.stringify(settings);
      const utf8Bytes = new TextEncoder().encode(jsonStr);
      let binary = '';
      const len = utf8Bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(utf8Bytes[i]);
      }
      const base64 = btoa(binary);
      // Make it URL safe by replacing characters that are problematic in paths
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (e) {
      return '';
    }
  };

  const encodedConfig = getEncodedConfig();
  const getPublicAddonUrl = () => {
    if (!origin) return '';
    const cleanOrigin = origin.includes('-dev-') ? origin.replace('-dev-', '-pre-') : origin;
    return `${cleanOrigin}/c/${encodedConfig}/manifest.json`;
  };
  const addonUrl = getPublicAddonUrl();
  const installUrl = addonUrl ? addonUrl.replace(/^https?:\/\//i, 'stremio://') : '';

  return (
    <div className={`min-h-screen text-slate-100 font-sans transition-colors duration-1000 relative flex flex-col ${activeTab === 'home' ? 'bg-[#020617]' : 'bg-[#0b031c]'}`}>
      
      {/* Dev Environment Security Cookie Bypass Warning Banner */}
      {origin.includes('-dev-') && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-200 py-3 px-4 text-center text-xs font-semibold flex flex-wrap items-center justify-center gap-2 z-50">
          <span>⚠️ {t('لتجنب مشكلة شاشة التحميل في Stremio، يفضل فتح الرابط العام ومتابعة التثبيت منه:', 'Warning: To prevent loading hurdles in Stremio, open the public shared app link to configure:')}</span>
          <a href={origin.replace('-dev-', '-pre-')} target="_blank" rel="noreferrer" className="underline text-emerald-400 hover:text-emerald-300 font-bold ml-1 inline-flex items-center gap-1 transition-all">
            <span>{origin.replace('-dev-', '-pre-')}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Dynamic Theme Glow Gradients depending on Selected Tab */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className={`absolute top-[-10%] left-[-5%] w-[450px] h-[450px] rounded-full blur-[120px] transition-all duration-1000 ${
            activeTab === 'home' ? 'bg-indigo-600/20' : 'bg-purple-600/20'
          }`}
        />
        <div 
          className={`absolute bottom-[10%] right-[-5%] w-[400px] h-[400px] rounded-full blur-[120px] transition-all duration-1000 ${
            activeTab === 'home' ? 'bg-emerald-600/20' : 'bg-fuchsia-600/20'
          }`}
        />
      </div>

      {/* Primary Header Segment */}
      <header className="flex justify-between items-center px-10 py-8 z-10 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-emerald-400 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <span className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            SER AND DEX SUBTITLE
          </span>
        </div>

        {/* Dynamic Nav Tabs */}
        <div className="flex gap-4 items-center">
          <button 
            onClick={() => setActiveTab('home')} 
            className={`px-6 py-2 rounded-full transition-all duration-350 text-sm font-medium border ${
              activeTab === 'home' 
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10' 
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            {t('الرئيسية / التخصيص', 'Control Panel')}
          </button>
          
          <button 
            onClick={() => setActiveTab('install')} 
            className={`px-6 py-2 rounded-full transition-all duration-350 text-sm font-medium border ${
              activeTab === 'install' 
                ? 'bg-purple-500/15 border-purple-500 text-purple-400 shadow-lg shadow-purple-500/10' 
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            {t('كيفية التثبيت', 'How to Install')}
          </button>

          {/* Bilingual Language Selector */}
          <button 
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} 
            className="px-4 py-2 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 transition-all text-xs font-bold tracking-wider flex items-center gap-1.5"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-10 grid grid-cols-12 gap-8 z-10 pb-12 items-center">
        
        {activeTab === 'home' ? (
          <>
            {/* Left Column Description */}
            <div className="col-span-12 lg:col-span-5 flex flex-col justify-center gap-8">
              <div className="space-y-4">
                <h1 className="text-5xl font-extrabold leading-tight text-white select-none">
                  {t('ترجمة ذكية', 'Smart Translation')} <br /> 
                  <span className="text-emerald-400 font-serif italic">{t('بلمسة تقنية فائقة', 'With Adaptive AI')}</span>
                </h1>
                <p className="text-lg text-slate-400 leading-relaxed max-w-md">
                  {t(
                    'ترجمة إنجليزية إلى عربية باحترافية، مع مزامنة تلقائية للصوت وتحسين النص بالذكاء الاصطناعي.',
                    'Professional English to Arabic subtitle translation, featuring autonomous timing alignment and cutting-edge Google AI Studio enhancements.'
                  )}
                </p>
              </div>

              {/* Functional Attributes Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all duration-300">
                  <div className="text-indigo-400 mb-2"><BookOpenText className="w-6 h-6" /></div>
                  <h3 className="font-bold text-sm mb-1">{t('ترجمة دقيقة', 'Precise Context')}</h3>
                  <p className="text-xs text-slate-500">{t('ترجمة سياقية تعتمد على المعنى لا الكلمات.', 'Translates semantic meaning rather than plain literal words.')}</p>
                </div>
                
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all duration-300">
                  <div className="text-emerald-400 mb-2"><Zap className="w-6 h-6" /></div>
                  <h3 className="font-bold text-sm mb-1">{t('مزامنة تلقائية', 'Auto-Sync')}</h3>
                  <p className="text-xs text-slate-500">{t('تعديل التوقيت ليتناسب تماماً مع الصوت وسرعة الفيلم.', 'Corrects delays to seamlessly match characters voice paths.')}</p>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all duration-300">
                  <div className="text-indigo-400 mb-2"><MessageSquareText className="w-6 h-6" /></div>
                  <h3 className="font-bold text-sm mb-1">{t('تحسين AI المتقدم', 'Smart Text Tuning')}</h3>
                  <p className="text-xs text-slate-500">{t('تصحيح لغوي ونحوي شامل باستخدام خوادم Google AI Studio.', 'Deep linguistic and spelling validation via Google AI Studio.')}</p>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all duration-300">
                  <div className="text-emerald-400 mb-2"><ShieldCheck className="w-6 h-6" /></div>
                  <h3 className="font-bold text-sm mb-1">{t('مجاني بالكامل', 'Entirely Free')}</h3>
                  <p className="text-xs text-slate-500">{t('خدمة مفتوحة المصدر بدون اشتراكات أو نوافذ منبثقة مزعجة.', 'An open-source service without premium walls or ads.')}</p>
                </div>
              </div>
            </div>

            {/* Right Settings Form Block */}
            <div className="col-span-12 lg:col-span-7 flex flex-col justify-center">
              <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 shadow-2xl relative">
                <div className="absolute -top-3 right-6 bg-emerald-500 text-slate-950 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                  {t('بوابة الإدارة والتخصيص', 'Control Room')}
                </div>

                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-gradient-to-b from-emerald-400 to-indigo-500 rounded-full"></span>
                  {t('إعدادات مصادر الترجمة والقنوات', 'Source & Translation Settings')}
                </h2>

                <div className="space-y-5">
                  {/* Row of SubDL and Google AI Studio */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs text-slate-400 px-1">
                        <label className="font-medium text-slate-300">SubDL API Key</label>
                        <a href="https://subdl.com/" target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-0.5 text-[11px]">
                          <span>{t('احصل على مفتاح', 'Get Key')}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <input 
                        type="password" 
                        value={settings.subdlKey} 
                        onChange={(e) => setSettings({...settings, subdlKey: e.target.value})} 
                        placeholder="••••••••••••••••" 
                        className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs text-slate-400 px-1">
                        <label className="font-medium text-slate-300">{t('مفتاح Google AI Studio', 'Google AI Studio Key')}</label>
                        <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-0.5 text-[11px]">
                          <span>{t('احصل على مفتاح', 'Get Key')}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <input 
                        type="password" 
                        value={settings.geminiKey} 
                        onChange={(e) => setSettings({...settings, geminiKey: e.target.value})} 
                        placeholder="••••••••••••••••" 
                        className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
                      />
                    </div>
                  </div>

                  {/* Subsource API key input */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs text-slate-400 px-1">
                      <label className="font-medium text-slate-300">Subsource API Key</label>
                      <a href="https://subsource.net/" target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-0.5 text-[11px]">
                        <span>{t('احصل على مفتاح', 'Get Key')}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <input 
                      type="password" 
                      value={settings.subsourceKey} 
                      onChange={(e) => setSettings({...settings, subsourceKey: e.target.value})} 
                      placeholder="••••••••••••••••" 
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
                    />
                  </div>

                  {/* OpenSubtitles Integration Switch */}
                  <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{t('تفعيل OpenSubtitles', 'Enable OpenSubtitles Integration')}</span>
                    </div>
                    <button 
                      onClick={() => setSettings({...settings, openSubtitles: !settings.openSubtitles})} 
                      className={`w-12 h-6 rounded-full relative transition duration-300 focus:outline-none ${
                        settings.openSubtitles ? 'bg-emerald-600' : 'bg-gray-700'
                      }`}
                    >
                      <div 
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${
                          settings.openSubtitles ? 'right-7' : 'right-1'
                        }`} 
                      />
                    </button>
                  </div>

                  {/* Language selectors */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-extrabold tracking-widest text-slate-500 px-1">{t('اللغة المصدر', 'SOURCE LANGUAGE')}</label>
                      <select 
                        value={settings.sourceLang} 
                        onChange={(e) => setSettings({...settings, sourceLang: e.target.value})} 
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
                      >
                        <option value="en">English (الإنجليزية)</option>
                        <option value="fr">French (الفرنسية)</option>
                        <option value="es">Spanish (الإسبانية)</option>
                        <option value="de">German (الألمانية)</option>
                        <option value="it">Italian (الإيطالية)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-extrabold tracking-widest text-slate-500 px-1">{t('اللغة المستهدفة', 'TARGET LANGUAGE')}</label>
                      <select 
                        value={settings.targetLang} 
                        onChange={(e) => setSettings({...settings, targetLang: e.target.value})} 
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
                      >
                        <option value="ar">Arabic (العربية)</option>
                        <option value="en">English (الإنجليزية)</option>
                        <option value="fr">French (الفرنسية)</option>
                        <option value="es">Spanish (الإسبانية)</option>
                      </select>
                    </div>
                  </div>

                  {/* Submission and installer sections */}
                  <button 
                    onClick={saveSettings} 
                    className={`w-full py-4 mt-2 rounded-2xl text-white font-bold tracking-wide shadow-xl active:scale-[0.99] transition-all duration-300 ${
                      savedStatus 
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-emerald-500/20 ring-2 ring-emerald-300' 
                        : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-500/10'
                    }`}
                  >
                    {savedStatus 
                      ? t('✓ تم حفظ الإعدادات بنجاح!', '✓ Settings saved successfully!') 
                      : t('حفظ الإعدادات', 'Save Settings')
                    }
                  </button>

                  <div className="space-y-3 mt-6 pt-6 border-t border-white/5">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-xs text-slate-400">{t('رابط الإضافة المباشر في Stremio', 'Your Custom Stremio Addon URL')}</label>
                        <button 
                          onClick={() => copyToClipboard(addonUrl)}
                          className="text-xs text-emerald-400 hover:text-emerald-300 font-bold tracking-tight transition-colors active:scale-95"
                        >
                          {copied ? t('✓ تم النسخ!', '✓ Copied!') : t('نسخ الرابط', 'Copy Link')}
                        </button>
                      </div>
                      <input 
                        type="text" 
                        readOnly 
                        value={addonUrl || 'Generating link...'} 
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-emerald-400 font-mono focus:outline-none cursor-copy" 
                      />
                    </div>
                    <a 
                      href={installUrl} 
                      className="block text-center w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] rounded-2xl text-white font-bold tracking-wide shadow-lg shadow-indigo-600/20 transition-all duration-200"
                    >
                      {t('تثبيت الإضافة في Stremio', 'Install Addon in Stremio')}
                    </a>
                  </div>

                </div>
              </div>
            </div>
          </>
        ) : (
          /* Installation Manual Tab */
          <div className="col-span-12 flex flex-col items-center justify-center text-center gap-8 py-10">
            <h2 className="text-4xl font-extrabold text-white tracking-tight">
              {t('كيفية التثبيت والإعداد في Stremio', 'How to Configure & Build in Stremio')}
            </h2>
            
            <div className="max-w-3xl bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-[32px] p-10 shadow-2xl space-y-8">
              <div className="grid md:grid-cols-2 gap-8 text-right">
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-purple-600/30 text-purple-400 flex items-center justify-center font-bold text-lg">1</div>
                  <h3 className="font-bold text-white text-lg">{t('تجهيز مفاتيح API', 'Prepare API Keys')}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {t(
                      'أدخل مفاتيح API الخاصة بك من SubDL و Google AI Studio. هذه العملية تفعل البحث الفوري والترجمة بالذكاء الاصطناعي.',
                      'Configure your private SubDL and Google AI Studio keys. This triggers automated searches and context translation.'
                    )}
                  </p>
                </div>

                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-purple-600/30 text-purple-400 flex items-center justify-center font-bold text-lg">2</div>
                  <h3 className="font-bold text-white text-lg">{t('حفظ الإعدادات والتوليد', 'Save & Generate')}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {t(
                      'اضغط على زر حفظ الإعدادات لتثبيت البيانات محلياً. سيتم تحديث الرابط المشفر تلقائياً.',
                      'Press Save Settings to lock configurations. Your personal direct installer path updates automatically on screen.'
                    )}
                  </p>
                </div>

                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-purple-600/30 text-purple-400 flex items-center justify-center font-bold text-lg">3</div>
                  <h3 className="font-bold text-white text-lg">{t('تثبيت بضغطة واحدة', 'One-Click Installation')}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {t(
                      'اضغط على زر "تثبيت الإضافة في Stremio" لفتح التطبيق تلقائياً وتفعيل الخدمة على جهازك.',
                      'Click "Install Addon in Stremio" to direct Stremio to bind this Arabic translator container to your feeds.'
                    )}
                  </p>
                </div>

                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-purple-600/30 text-purple-400 flex items-center justify-center font-bold text-lg">4</div>
                  <h3 className="font-bold text-white text-lg">{t('الاستمتاع بالمشاهدة', 'Watch Seamlessly')}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {t(
                      'عند تشغيل أي فيلم في Stremio، ستظهر خيارات الترجمة بمسمى "SER & DEX: Arabic AI" تلقائياً وبأداء مبهر.',
                      'Start playing your movies! A high-performance translated stream will auto-populate under subtitle options.'
                    )}
                  </p>
                </div>
              </div>

              {/* Install and URL direct box duplicated here in purple theme for ultimate styling and usability as user explicitly requested */}
              <div className="bg-[#120a24]/80 p-6 rounded-2xl border border-purple-500/20 text-left space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-purple-400 block uppercase tracking-wider">{t('رابط الإضافة المولد', 'Generated Addon Endpoint')}</span>
                    <button 
                      onClick={() => copyToClipboard(addonUrl)}
                      className="text-xs text-purple-300 hover:text-purple-200 font-bold tracking-tight transition-colors active:scale-95 animate-pulse"
                    >
                      {copied ? t('✓ تم النسخ!', '✓ Copied!') : t('نسخ الرابط', 'Copy Link')}
                    </button>
                  </div>
                  <input 
                    type="text" 
                    readOnly 
                    value={addonUrl || 'Generating...'} 
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full bg-purple-950/40 border border-purple-500/20 rounded-xl px-4 py-3 text-xs text-purple-300 font-mono focus:outline-none" 
                  />
                </div>
                <div className="flex gap-4">
                  <a 
                    href={installUrl} 
                    className="flex-1 block text-center py-3 bg-purple-600 hover:bg-purple-500 hover:shadow-lg hover:shadow-purple-500/20 active:scale-[0.99] rounded-xl text-white font-bold text-sm transition-all"
                  >
                    {t('تثبيت مباشر الآن', 'Direct Install in Stremio')}
                  </a>
                  <button 
                    onClick={() => setActiveTab('home')}
                    className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all"
                  >
                    {t('العودة للتخصيص', 'Back to Customize')}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* Footer Area */}
      <footer className="px-10 py-6 border-t border-white/5 z-10 flex justify-between items-center bg-slate-950/50 backdrop-blur-md">
        <p className="text-xs text-slate-500">© 2026 SER AND DEX SUBTITLE. {t('جميع الحقوق محفوظة.', 'All Rights Reserved.')}</p>
        <div className="flex gap-6 text-xs text-slate-500">
          <a href="#" className="hover:text-emerald-400 transition-colors">{t('شروط الاستخدام', 'Terms of Use')}</a>
          <a href="#" className="hover:text-emerald-400 transition-colors">{t('سياسة الخصوصية', 'Privacy Policy')}</a>
          <span className="font-mono text-slate-600">v1.2.0-stable</span>
        </div>
      </footer>
    </div>
  );
}
