import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Coffee, Lock, ArrowRight, Eye, EyeOff, Crown, ShieldCheck } from 'lucide-react';
import { ButtonLoading } from '@/shared/components/ui';
import {
  isAuthenticated,
  formatLoginSuccessMessage,
  loginAs,
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

const CAFE_NAME = 'Beans & Butter';
const CAFE_NAME_FULL = 'Beans & Butter Cafe';
const PROVIDER_NAME = 'Nexus ERP Solutions';
const SUPPORT_NAME = 'Md. Yeasin';
const SUPPORT_PHONE = '01624269321';
const SUPPORT_TEL = '+8801624269321';

const LOGIN_PARTICLES = Array.from({ length: 20 }, (_, id) => ({
  id,
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  animationDelay: `${Math.random() * 5}s`,
  animationDuration: `${15 + Math.random() * 10}s`,
}));

type SignInRole = StaticUserRole;

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

  return (
    // One locked viewport: phones stay a single screen (thin brand bar + form).
    // Desktop/tablet use a centered split card that never exceeds the window.
    <div
      className="relative h-screen w-full overflow-hidden bg-slate-900 font-sans"
      style={{ height: '100svh', maxHeight: '100svh' }}
    >
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-black">
        <div
          className="absolute inset-0 opacity-30 bg-cover bg-center animate-slow-zoom"
          style={{ backgroundImage: `url(${loginBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent" />

        <div className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block">
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

      <div className="relative z-10 flex h-full w-full items-stretch justify-center md:items-center md:p-4 lg:p-6">
        <div
          className="flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden bg-white shadow-2xl animate-fade-in-up
            max-md:rounded-none
            md:h-auto md:max-h-[calc(100svh-2rem)] md:min-h-[min(600px,calc(100svh-2rem))] md:max-w-5xl md:flex-row md:rounded-3xl
            lg:max-h-[calc(100svh-3rem)] lg:min-h-[min(680px,calc(100svh-3rem))]"
        >
          {/* Brand: compact header on phones, full left panel from md up */}
          <div
            className="relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-800 to-black text-white
              px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]
              max-md:min-h-[3.25rem]
              [@media(max-height:520px)_and_(max-width:767px)]:hidden
              md:w-[46%] md:flex-col md:items-stretch md:justify-between md:p-10
              lg:w-1/2 lg:p-12"
          >
            <div
              className="absolute inset-0 opacity-20 bg-cover bg-center transition-transform duration-700 md:hover:scale-110"
              style={{ backgroundImage: `url(${loginBg})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

            <div className="relative z-10 flex items-center gap-2.5 md:block">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 shadow-lg shadow-amber-500/20 animate-pulse-slow md:mb-6 md:h-12 md:w-12 md:rounded-xl">
                <Coffee size={18} className="text-white md:hidden" />
                <Coffee size={28} className="text-white hidden md:block" />
              </div>
              <h1 className="truncate text-base font-bold tracking-tight sm:text-lg md:mb-4 md:text-4xl">
                {CAFE_NAME} <span className="text-amber-500">Cafe</span>
              </h1>
              <p className="mt-0 hidden text-slate-300 leading-relaxed md:mt-0 md:block md:text-base lg:text-lg animate-slide-in-left animation-delay-200">
                Café ERP for POS orders, daily expenses, inventory, and floor reports — built for{' '}
                {CAFE_NAME_FULL}.
              </p>
            </div>

            <div className="relative z-10 mt-6 hidden space-y-4 md:block animate-slide-in-left animation-delay-400">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-400">
                  Café ERP
                </p>
                <p className="text-sm leading-relaxed text-slate-300">
                  Licensed to {CAFE_NAME_FULL}. Sign in as Owner or Manager to run the counter, record
                  sales, track costs, and close the day.
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <div className="h-px w-8 bg-slate-600" />
                <span>Powered by {PROVIDER_NAME}</span>
              </div>
            </div>
          </div>

          {/* Form: fills remaining height; internal scroll only if the keyboard covers the field */}
          <div
            className="relative flex min-h-0 flex-1 flex-col justify-center overflow-y-auto overscroll-contain bg-white
              px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]
              sm:px-8 sm:py-6
              md:w-[54%] md:p-10
              lg:w-1/2 lg:p-12"
          >
            <div className="mx-auto w-full max-w-sm">
              <h2 className="mb-0.5 text-xl font-bold text-slate-900 sm:text-2xl md:mb-2 md:text-3xl">
                Welcome back
              </h2>
              <p className="mb-4 text-xs text-slate-500 sm:mb-5 sm:text-sm md:mb-6 md:text-base">
                Sign in to the {CAFE_NAME} café dashboard.
              </p>

              <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-5 md:mb-6">
                {SIGN_IN_ROLES.map(({ role, label, icon: Icon, activeClass }) => {
                  const isActive = signInRole === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSignInRole(role)}
                      className={`flex flex-col items-start gap-1 rounded-xl border-2 p-2.5 text-left transition-all sm:gap-1.5 sm:p-3 ${
                        isActive
                          ? activeClass
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Icon size={16} className={isActive ? undefined : 'text-slate-400'} />
                      <span className="text-xs font-bold sm:text-sm">{label}</span>
                      <span className="mt-0.5 hidden text-[10px] leading-snug opacity-80 md:line-clamp-2 md:block">
                        {ROLE_DESCRIPTIONS[role]}
                      </span>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleFormSubmit(handleLogin)} className="space-y-3 sm:space-y-4 md:space-y-5">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-900 sm:mb-2 sm:text-xs">
                    {signInRole === 'owner' ? 'Owner' : 'Manager'} Password
                  </label>
                  <div className="relative group">
                    <Lock
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-amber-500 sm:left-4"
                      size={18}
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...register('password')}
                      className={`w-full rounded-xl border bg-slate-50 py-3 pl-10 pr-10 text-sm font-medium text-slate-700 outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 sm:py-3.5 sm:pl-12 sm:pr-12 sm:text-base ${
                        errors.password ? 'border-red-400' : 'border-slate-200'
                      }`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-amber-500 sm:right-4"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-[10px] text-red-600 sm:text-xs">{errors.password.message}</p>
                  )}
                </div>

                <ButtonLoading
                  type="submit"
                  loading={isSubmitting || loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-xl shadow-slate-200 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-2xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:py-3.5 sm:text-base"
                >
                  Sign In as {signInRole === 'owner' ? 'Owner' : 'Manager'} <ArrowRight size={18} />
                </ButtonLoading>
              </form>

              <p className="mt-4 text-center text-[10px] leading-snug text-slate-500 sm:mt-5 sm:text-sm md:mt-6">
                Need help with this Café ERP?{' '}
                <a href={`tel:${SUPPORT_TEL}`} className="font-bold text-amber-600 hover:underline">
                  {SUPPORT_NAME} · {SUPPORT_PHONE}
                </a>
              </p>
              <p className="mt-1 text-center text-[10px] text-slate-400 sm:text-xs">{PROVIDER_NAME}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
