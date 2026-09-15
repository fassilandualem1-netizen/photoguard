with open("PhotoGuard_App/frontend/src/App.tsx", "r") as f:
    content = f.read()

import re

# We will just replace everything from `function Login` up to `function PhotographerDashboard`
# by a clean version.

login_function = """function Login({ onLogin }: { onLogin: (user: any) => void }) {
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  const botName = import.meta.env.VITE_TELEGRAM_BOT_NAME || "photoguard_demo_bot";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (token) {
      const user = {
        id: params.get('id'),
        first_name: params.get('name'),
        role: params.get('role'),
        tier: params.get('tier'),
        token: token
      };
      
      window.history.replaceState({}, document.title, window.location.pathname);
      onLogin(user);
      if (user.role === 'admin') {
          navigate('/admin');
      } else {
          navigate('/photographer');
      }
    }
    
    const err = params.get('error');
    if (err) {
      setError(`Authentication Error: ${err}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [navigate, onLogin]);

  const handleTelegramLogin = () => {
    window.location.href = `https://t.me/${botName}?start=auth`;
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-neutral-900 rounded-2xl border border-neutral-800 p-8 shadow-2xl mb-6 text-center">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mb-4">
            <Shield size={32} />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">PhotoGuard Studio</h1>
          <p className="text-neutral-400 mt-2 text-sm text-center">Secure client photo delivery and anti-piracy management platform.</p>
        </div>

        {error && <div className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm mb-6 border border-red-500/20">{error}</div>}

        <div className="mb-6">
          <p className="text-sm text-neutral-300 mb-4 font-medium">Log in to your Dashboard</p>
          
          <button
            type="button"
            onClick={handleTelegramLogin}
            className="w-full flex items-center justify-center gap-3 bg-[#24A1DE] hover:bg-[#1d8dbf] text-white font-medium py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-900/20"
          >
            <Send size={20} />
            <span>Log in with Telegram</span>
          </button>
        </div>
      </div>

      {/* Client Access Removed for Security */}
      <div className="w-full max-w-md mt-6 p-6 bg-neutral-900/50 rounded-2xl border border-neutral-800 text-center">
        <h3 className="text-white font-medium mb-2">Are you a Client?</h3>
        <p className="text-neutral-400 text-sm mb-4">
          To ensure maximum security and privacy, client galleries are only accessible via the PhotoGuard Mobile App.
        </p>
        <div className="flex gap-4 justify-center">
          <span className="text-xs bg-neutral-800 text-neutral-300 px-3 py-1.5 rounded-md">Android</span>
          <span className="text-xs bg-neutral-800 text-neutral-300 px-3 py-1.5 rounded-md">iOS</span>
        </div>
      </div>
    </div>
  );
}
"""

content = re.sub(r'function Login\(\{ onLogin \}: \{ onLogin: \(user: any\) => void \}\) \{.*?(?=\nfunction PhotographerDashboard)', login_function, content, flags=re.DOTALL)

with open("PhotoGuard_App/frontend/src/App.tsx", "w") as f:
    f.write(content)
