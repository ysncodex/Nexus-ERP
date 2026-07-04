import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Coffee, Lock, ArrowRight, Eye, EyeOff, Crown, ShieldCheck, Compass } from 'lucide-react';
import { ButtonLoading } from '@/shared/components/ui';
import {
  isAuthenticated,
  formatLoginSuccessMessage,
  loginAs,
  loginAsVisitor,
  loginSchema,
  validateRolePassword,
  ROLE_HOME_PATH,
  ROLE_DESCRIPTIONS,
  getStoredUser,
  type LoginFormData,
  type StaticUserRole,
} from '@/shared/utils';
import { authService } from '@/core/api/services';
import loginBg from '@/assets/img/login.jpg';
import loginBg2 from '@/assets/img/login2.gif';

const LOGIN_PARTICLES = Array.from({ length: 20 }, (_, id) => ({
  id,
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  animationDelay: `${Math.random() * 5}s`,
  animationDuration: `${15 + Math.random() * 10}s`,
}));

type SignInRole = Exclude<StaticUserRole, 'visitor'>;

const SIGN_IN_ROLES: {
  role: SignInRole;
  label: string;
  icon: typeof Crown;
  accent: string;
  activeClass: string;
}[] = [
  {
    role: 'owner',
    label: 'Owner',
    icon: Crown,
    accent: 'text-amber-600',
    activeClass: 'border-amber-500 bg-amber-50 text-amber-800 shadow-sm',
  },
  {
    role: 'manager',
    label: 'Manager',
    icon: ShieldCheck,
    accent: 'text-emerald-600',
    activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm',
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signInRole, setSignInRole] = useState<SignInRole>('owner');

  useEffect(() => {
    try {
      const user = getStoredUser();
      if (isAuthenticated() && user) navigate(ROLE_HOME_PATH[user.role]);
    } catch {
      // ignore
    }
  }, [navigate]);

  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: '' },
  });

  const roleLabel = signInRole === 'owner' ? 'Owner' : 'Manager';

  const handleLogin = async (data: LoginFormData) => {
    setLoading(true);

    try {
      // Primary path: authenticate against the backend API.
      const res = await authService.login({ role: signInRole, password: data.password });
      toast.success(formatLoginSuccessMessage(res.user.name));
      navigate(ROLE_HOME_PATH[signInRole]);
    } catch (err) {
      const axiosErr = err as { response?: { status?: number } };
      const status = axiosErr.response?.status;

      // No response → server unreachable: fall back to offline static auth.
      if (!axiosErr.response) {
        if (validateRolePassword(signInRole, data.password)) {
          try {
            const user = loginAs(signInRole);
            toast.success(formatLoginSuccessMessage(user.name));
          } catch {
            // ignore storage errors
          }
          navigate(ROLE_HOME_PATH[signInRole]);
          return;
        }
        toast.error(`Wrong password for ${roleLabel}`);
      } else if (status === 429) {
        toast.error('Too many attempts. Please wait a moment and try again.');
      } else if (status === 401 || status === 400) {
        toast.error(`Wrong password for ${roleLabel}`);
      } else {
        toast.error('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVisitorEntry = async () => {
    setLoading(true);
    try {
      // Preferred: obtain a real read-only JWT so authenticated data loads.
      const res = await authService.loginAsVisitor();
      toast.success(formatLoginSuccessMessage(res.user.name));
    } catch {
      // Server unreachable / older backend → fall back to local visitor mode.
      try {
        const user = loginAsVisitor();
        toast.success(formatLoginSuccessMessage(user.name));
      } catch {
        // ignore storage errors
      }
    } finally {
      setLoading(false);
    }
    navigate(ROLE_HOME_PATH.visitor);
  };

  return (
    // h-dvh (dynamic viewport height) instead of min-h-screen so mobile browser
    // chrome (address bar) doesn't push content into a scrollable overflow.
    <div className="h-dvh w-full bg-slate-900 flex items-center justify-center p-2 sm:p-4 font-sans relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-black">
        <div
          className="absolute inset-0 opacity-30 bg-cover bg-center animate-slow-zoom"
          style={{ backgroundImage: `url(${loginBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent" />

        <div className="absolute inset-0 overflow-hidden">
          {LOGIN_PARTICLES.map((p) => (
            <div
              key={p.id}
              className="absolute w-2 h-2 bg-amber-500/20 rounded-full animate-float"
              style={{
                left: p.left,
                top: p.top,
                animationDelay: p.animationDelay,
                animationDuration: p.animationDuration,
              }}
            />
          ))}
        </div>
      </div>

      {/* Card: full available height on mobile (no scroll), natural height on desktop */}
      <div className="bg-white w-full max-w-4xl h-full md:h-auto rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row md:min-h-[650px] relative z-10 animate-fade-in-up">
        {/* Visual Side (Left) — compact strip on mobile: logo + title only */}
        <div className="shrink-0 md:w-1/2 bg-gradient-to-br from-slate-800 to-black relative flex flex-col items-center justify-center md:items-stretch md:justify-between p-4 sm:p-6 md:p-12 text-white overflow-hidden">
          <div
            className="absolute inset-0 opacity-20 bg-cover bg-center transition-transform duration-700 hover:scale-110"
            style={{ backgroundImage: `url(${loginBg2})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

          {/* Logo + title: horizontal row centered on mobile, original stacked layout on desktop */}
          <div className="relative z-10 flex items-center gap-3 md:block">
            <div className="w-9 h-9 md:w-12 md:h-12 bg-amber-500 rounded-xl flex items-center justify-center shrink-0 mb-0 md:mb-6 shadow-lg shadow-amber-500/20 animate-pulse-slow">
              <Coffee size={20} className="text-white md:hidden" />
              <Coffee size={28} className="text-white hidden md:block" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-4xl font-bold tracking-tight mb-0 md:mb-4 animate-slide-in-left">
              Café ERP <span className="text-amber-500">Pro</span>
            </h1>
            {/* Description hidden on mobile so the phone view jumps straight from
                the logo/title to the "Welcome back" form below */}
            <p className="hidden md:block text-slate-300 text-sm sm:text-base md:text-lg leading-relaxed animate-slide-in-left animation-delay-200">
              Streamline your coffee shop operations with our all-in-one management dashboard.
            </p>
          </div>

          {/* Visitor info card + trust line — desktop/tablet only. */}
          <div className="hidden md:block relative z-10 space-y-4 animate-slide-in-left animation-delay-400">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">
                For Visitors
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">
                Curious about Beans &amp; Butter? Explore every module in read-only preview mode —
                no password needed. Browse orders, finance, inventory, and reports without changing
                any data.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <div className="w-8 h-px bg-slate-600" />
              <span>Trusted by 500+ Cafés</span>
            </div>
          </div>
        </div>

        {/* Form Side (Right) — takes remaining height on mobile, centers its content,
            and scales spacing down so everything fits without scrolling */}
        <div className="flex-1 min-h-0 md:w-1/2 bg-white px-4 py-3 sm:px-8 sm:py-6 md:p-12 flex flex-col justify-center relative overflow-y-auto">
          <div className="max-w-sm mx-auto w-full">
            <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-900 mb-0.5 sm:mb-2">
              Welcome back
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-slate-500 mb-3 sm:mb-6">
              Choose your role and sign in to continue.
            </p>

            {/* Role selector */}
            <div className="grid grid-cols-2 gap-2 mb-3 sm:mb-6">
              {SIGN_IN_ROLES.map(({ role, label, icon: Icon, activeClass }) => {
                const isActive = signInRole === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSignInRole(role)}
                    className={`flex flex-col items-start gap-1 sm:gap-1.5 p-2 sm:p-3 rounded-xl border-2 transition-all text-left ${
                      isActive
                        ? activeClass
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={16} className={isActive ? undefined : 'text-slate-400'} />
                    <span className="text-xs sm:text-sm font-bold">{label}</span>
                    <span className="hidden sm:block text-[10px] leading-snug opacity-80 line-clamp-2">
                      {ROLE_DESCRIPTIONS[role]}
                    </span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleFormSubmit(handleLogin)} className="space-y-3 sm:space-y-5">
              <div>
                <div className="flex justify-between items-center mb-1 sm:mb-2">
                  <label className="block text-[10px] sm:text-xs font-bold text-slate-900 uppercase tracking-wide">
                    {signInRole === 'owner' ? 'Owner' : 'Manager'} Password
                  </label>
                </div>
                <div className="relative group">
                  <Lock
                    className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors"
                    size={18}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...register('password')}
                    className={`w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-2.5 sm:py-3.5 bg-slate-50 border ${
                      errors.password ? 'border-red-400' : 'border-slate-200'
                    } rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium text-sm sm:text-base text-slate-700`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-500 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[10px] sm:text-xs text-red-600 mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <ButtonLoading
                type="submit"
                loading={isSubmitting || loading}
                className="w-full py-2.5 sm:py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm sm:text-base hover:bg-slate-800 hover:shadow-2xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 ease-in-out shadow-xl shadow-slate-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sign In as {signInRole === 'owner' ? 'Owner' : 'Manager'} <ArrowRight size={18} />
              </ButtonLoading>
            </form>

            {/* Visitor entry */}
            <div className="mt-3 sm:mt-8 pt-3 sm:pt-6 border-t border-slate-100">
              <div className="hidden sm:block rounded-2xl bg-slate-50 border border-slate-200 p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
                    <Compass size={18} className="text-sky-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Just browsing?</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {ROLE_DESCRIPTIONS.visitor}
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleVisitorEntry}
                className="w-full py-2 sm:py-3 rounded-xl border-2 border-sky-200 bg-sky-50 text-sky-700 font-bold text-xs sm:text-sm hover:bg-sky-100 hover:border-sky-300 transition-all flex items-center justify-center gap-2"
              >
                <Compass size={14} />
                Continue as Visitor
              </button>
            </div>

            <p className="mt-2 sm:mt-6 text-center text-[10px] sm:text-sm text-slate-500">
              Need full access?
              <a className="text-amber-600 font-bold ml-1 hover:underline">Contact: 01624269321</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
